// ============================================================================
// storage.ts — «умное хранилище», привязанное к аккаунту Telegram.
//
// КАК РАБОТАЕТ ПРИВЯЗКА:
// Каждые данные пишутся под ПЕРСОНАЛЬНЫМ ключом: "mb-goals-v1:tg-<id>".
// id берём из Telegram тремя способами по очереди (самый надёжный первым).
// Если мы внутри Telegram, но id получить не удалось — запись и чтение
// ЗАПРЕЩЕНЫ (иначе данные одного пользователя увидит другой).
//
// ПОЧЕМУ РАНЬШЕ СИНХРОНИЗАЦИЯ МЕЖДУ ПК И ТЕЛЕФОНОМ НЕ РАБОТАЛА:
// 1) Каждое сохранение отправлялось в облако отдельным запросом
//    setCloudStorageItem БЕЗ ожидания ответа. Лимит Telegram — всего
//    ~2 незавершённых запроса: при быстром сохранении нескольких
//    ключей очередь переполнялась, часть записей ОТВАЛИВАЛАСЬ с
//    ошибкой, и устройства видели разные наборы целей. Теперь все
//    данные складываются в ОДНУ общую «свёртку» (cloudblob) и уходят
//    ОДНИМ запросом, строго по очереди, с ожиданием подтверждения.
// 2) Конфликт копий решался по длине строки — теперь строго по метке
//    времени: побеждает то, что сохранено ПОЗЖЕ.
// ============================================================================

import {
  retrieveLaunchParams,
  init,
  isCloudStorageSupported,
  setCloudStorageItem,
  getCloudStorageItem,
  deleteCloudStorageItem,
} from "@telegram-apps/sdk"; // официальный SDK мини-приложений + CloudStorage

/** Имя текущего пользователя Telegram или null, если мы не внутри TG. */
let tgUserId: string | null = null;

/* ---------- СОБЫТИЙНАЯ ШИНА ЗАПИСЕЙ ----------
   Каждый успешный saveJSON() оповещает подписчиков (например, плашку
   о новом достижении в components/AchievementToast). Так уведомление
   появляется мгновенно, без перезагрузки страницы. */
type SaveListener = (baseKey: string, value: unknown) => void;
const saveListeners = new Set<SaveListener>();

export function onStorageSave(fn: SaveListener): () => void {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

/* ---------- ОБЛАКО TELEGRAM: ОДНОРАЗОВЫЕ СИНХРОНИЗАЦИИ ----------
   Важно: методы облака работают ТОЛЬКО после init() всего SDK.
   Без инициализации isCloudStorageSupported() возвращает false, записи
   в облако молча не происходили — поэтому на ПК данные не подтягивались
   к тому же аккаунту, что играл на телефоне. */

/** Отправить все непустые локальные данные в облако (разово, после запуска). */
export async function pushAllToCloud(bases: string[]): Promise<void> {
  if (!tgUserId || !isCloudStorageSupported()) return;
  const blob = await readBlob();
  let pushed = 0;
  for (const base of bases) {
    const raw = localStorage.getItem(makeKey(base));
    if (!raw || isEmptyPayload(raw)) continue; // пустоту в облако не пишем
    if (blob.data[base] === raw) continue;     // в облаке уже наше значение
    blob.data[base] = raw;
    pushed++;
  }
  if (pushed === 0) return;
  blob.ts = Math.max(Date.now(), blob.ts + 1);
  localStorage.setItem(CLOUD_TS_LOCAL, String(blob.ts));
  const ok = await cloudSet(CLOUD_BLOB_KEY, JSON.stringify(blob));
  console.log(`[storage] Стартовые данные в облако: ${ok ? "ОТПРАВЛЕНЫ ✅" : "НЕ ДОШЛО ❌"} (${pushed}/${bases.length})`);
}

/* ---------- ОБЛАЧНЫЙ «БУСЛОБ» (единая свёртка всех данных) ----------
   Все игровые данные одного аккаунта лежат в облаке Telegram под ОДНИМ
   ключом cloudblob-v1: { data: {ключ: значение}, ts: время }.
   Раньше каждый ключ отправлялся отдельным запросом setCloudStorageItem
   БЕЗ ожидания ответа — при быстром сохранении очередь Telegram
   переполнялась (лимит ~2 запроса), часть записей терялась, и ПК с
   телефоном видели разные цели. Теперь одна отправка = один запрос,
   строго по очереди, с ожиданием подтверждения сервера. */
const CLOUD_BLOB_KEY = "cloudblob-v1";
const CLOUD_TS_LOCAL = "mb-cloud-ts-v1"; // локальная метка последней синхронизации

interface Blob {
  data: Record<string, string>;
  ts: number;
}

async function readBlob(): Promise<Blob> {
  try {
    const raw = await getCloudStorageItem(CLOUD_BLOB_KEY);
    if (!raw) return { data: {}, ts: 0 };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.data) {
      return { data: parsed.data, ts: Number(parsed.ts) || 0 };
    }
  } catch { /* нет соединения / первый запуск */ }
  return { data: {}, ts: 0 };
}

/** Запись в облако с повторами и ожиданием ответа сервера. */
async function cloudSet(key: string, value: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await setCloudStorageItem(key, value);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return false;
}

/* ---------- ПРОВЕРКА «ПУСТОТЫ» ДАННЫХ ---------- */

/** Считает ли строку JSON «пустой» (нет ни одного непустого массива/объекта/числа). */
function isEmptyPayload(raw: string): boolean {
  try {
    const v = JSON.parse(raw);
    return !hasContent(v);
  } catch {
    return false; // непарсимое — считаем содержательным
  }
}

function hasContent(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string" || typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.some(hasContent);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(hasContent);
  return false;
}

/**
 * Полная синхронизация с облаком при каждом запуске: если облачный
 * blob новее локальной метки — применяем его данные целиком.
 * Возвращает true, если из облака удалось что-то заполучить.
 */
export async function syncWithCloud(bases: string[]): Promise<boolean> {
  if (!tgUserId || !isCloudStorageSupported()) return false;
  const blob = await readBlob();
  const myTs = Number(localStorage.getItem(CLOUD_TS_LOCAL)) || 0;
  if (blob.ts === 0) return false; // в облаке пока ничего нет
  if (blob.ts < myTs) return false; // локально свежее — трогать нечего
  let restored = false;
  for (const base of bases) {
    const raw = blob.data[base];
    if (raw == null) continue;
    const local = localStorage.getItem(makeKey(base));
    if (local !== raw) {
      localStorage.setItem(makeKey(base), raw);
      restored = true;
    }
  }
  localStorage.setItem(CLOUD_TS_LOCAL, String(blob.ts));
  if (restored) console.log("[storage] Данные восстановлены/обновлены из облачного blob");
  return restored;
}

/* ---------- ФОНОВАЯ СИНХРОНИЗАЦИЯ «НА ЛЕТУ» + PUSH ----------
   Каждые PULL_INTERVAL_MS приложение тихо сверяется с облаком и, если
   там есть более свежий blob, применяет его и оповещает страницы
   событием onCloudUpdate. Локальные изменения уходят в облако пачкой
   через schedulePush (дебаунс 700 мс, одна отправка). */

type CloudListener = (changedBases: string[]) => void;
const cloudListeners = new Set<CloudListener>();

/** Подписаться на обновление данных из облака другим устройством. */
export function onCloudUpdate(fn: CloudListener): () => void {
  cloudListeners.add(fn);
  return () => cloudListeners.delete(fn);
}

const PULL_INTERVAL_MS = 15_000;
let pullTimer: number | undefined;
let pulling = false;
let pushing = false;
let pushTimer: number | undefined;
const pendingPush = new Set<string>(); // base-имена, которые надо отправить

/** Запустить фоновую синхронизацию (вызывается один раз из main.tsx). */
export function startBackgroundSync(bases: string[]): void {
  if (pullTimer != null) return;
  pullTimer = window.setInterval(() => {
    if (document.hidden) return; // страница свёрнута — не тратим запросы
    void pullOnce(bases);
  }, PULL_INTERVAL_MS);
  // И сразу при возврате в окно приложения (после сворачивания TG)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void pullOnce(bases);
  });
}

/** Одна быстрая проверка: не появилось ли в облаке более свежий blob? */
async function pullOnce(bases: string[]): Promise<string[]> {
  if (!tgUserId || !isCloudStorageSupported()) return [];
  if (pulling || pushing) return [];
  pulling = true;
  try {
    const myTs = Number(localStorage.getItem(CLOUD_TS_LOCAL)) || 0;
    const blob = await readBlob();
    if (blob.ts <= myTs) return []; // облако не новее — ничего не делаем
    localStorage.setItem(CLOUD_TS_LOCAL, String(blob.ts));
    const changed: string[] = [];
    for (const base of bases) {
      const raw = blob.data[base];
      if (raw == null) continue;
      let key: string;
      try { key = makeKey(base); } catch { continue; }
      if (localStorage.getItem(key) !== raw) {
        try { localStorage.setItem(key, raw); } catch { /* ок */ }
        changed.push(base);
      }
    }
    if (changed.length) {
      console.log("[storage] Из облака подтянуты свежие данные:", changed.join(", "));
      cloudListeners.forEach(fn => { try { fn(changed); } catch { /* сломанный слушатель не ломает синхронизацию */ } });
    }
    return changed;
  } finally {
    pulling = false;
  }
}

/** Отправить накопившиеся локальные изменения в облако (в фоне, пачкой). */
function schedulePush(base: string): void {
  if (!tgUserId || !isCloudStorageSupported()) return;
  pendingPush.add(base);
  if (pushTimer != null) return; // уже запланировано
  pushTimer = window.setTimeout(async () => {
    pushTimer = undefined;
    if (pushing) return;
    pushing = true;
    try {
      while (pendingPush.size) {
        const bases = [...pendingPush];
        const blob = await readBlob();
        for (const b of bases) {
          pendingPush.delete(b);
          const raw = localStorage.getItem(makeKey(b));
          // пустоту в облако не пишем — иначе свежее устройство затирает прогресс
          if (raw != null && !isEmptyPayload(raw)) blob.data[b] = raw;
        }
        blob.ts = Math.max(Date.now(), blob.ts + 1);
        localStorage.setItem(CLOUD_TS_LOCAL, String(blob.ts));
        const ok = await cloudSet(CLOUD_BLOB_KEY, JSON.stringify(blob));
        console.log(`[storage] Облачная синхронизация: ${ok ? "ОТПРАВЛЕНО ✅" : "НЕ ДОШЛО ❌"} (${bases.join(", ")})`);
      }
    } finally {
      pushing = false;
    }
  }, 700); // дебаунс: несколько сохранений подряд = одна отправка
}

/* ---------- СПОСОБ 1: читаем id прямо из URL запуска ----------
   Telegram открывает мини-апп со ссылкой вида:
     ...?tgWebAppData=...%7B"user"%3A%7B"id"%3A123456789...%7D...
   В параметре tgWebAppData зашит JSON пользователя. Это самый надёжный
   источник — он есть СРАЗУ при загрузке страницы, не нужно ничего ждать. */
function readIdFromUrl(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("tgWebAppData");
    if (!raw) return null;
    const inner = new URLSearchParams(decodeURIComponent(raw)); // распаковываем query-строку
    const userJson = inner.get("user");                          // вытаскиваем JSON пользователя
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    return user?.id != null ? String(user.id) : null;
  } catch {
    return null; // что-то пошло не так — переходим к способу 2
  }
}

/* Ждём готовности window.Telegram.WebApp (способ 3), максимум 5 секунд. */
async function waitForWebApp(): Promise<any> {
  const w = window as any;
  if (w.Telegram?.WebApp?.initDataUnsafe?.user) return w.Telegram.WebApp;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 5000); // не ждём вечно
    document.addEventListener("telegram-webapp:ready", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    if (!w.Telegram?.WebApp) { clearTimeout(timeout); resolve(); } // скрипт TG не подключён
  });
  return w.Telegram?.WebApp ?? null;
}

/**
 * Определяем id пользователя. Пробуем 3 способа по очереди:
 *   1) URL запуска (мгновенно, самый надёжный);
 *   2) SDK retrieveLaunchParams (читает те же данные через библиотеку);
 *   3) классический window.Telegram.WebApp.initDataUnsafe.user.
 */
export async function initTelegramUser(): Promise<string | null> {
  /* Инициализируем SDK (нужен ли он вообще решаем по параметрам запуска).
     БЕЗ init() все методы облачного хранилища Telegram недоступны:
     isCloudStorageSupported() = false и синхронизация молча не работает. */
  if (inTelegram()) {
    try { init(); } catch (e) {
      console.log("[storage] SDK уже инициализирован или недоступен:", e);
    }
  }

  // СПОСОБ 1
  tgUserId = readIdFromUrl();
  if (tgUserId) {
    console.log("[storage] id получен из URL запуска:", tgUserId);
    return tgUserId;
  }

  // СПОСОБ 2
  try {
    const lp = retrieveLaunchParams();
    const uid = lp?.tgWebAppData?.user?.id;
    if (uid != null) {
      tgUserId = String(uid);
      console.log("[storage] id получен через SDK:", tgUserId);
      return tgUserId;
    }
  } catch (e) {
    console.log("[storage] SDK не дал данные:", e);
  }

  // СПОСОБ 3
  const webApp = await waitForWebApp();
  const user = webApp?.initDataUnsafe?.user;
  if (user?.id != null) {
    tgUserId = String(user.id);
    console.log("[storage] id получен через Telegram.WebApp:", tgUserId);
    return tgUserId;
  }

  console.warn("[storage] НЕ удалось определить аккаунт Telegram!");
  return null;
}

/** Текущий id пользователя (или null). */
export function getTelegramUserId(): string | null {
  return tgUserId;
}

/** Мы открыты внутри Telegram? (по наличию параметра запуска в URL) */
function inTelegram(): boolean {
  return window.location.search.includes("tgWebAppData");
}

/**
 * Персональный ключ: "mb-goals-v1" -> "mb-goals-v1:tg-123456789".
 * ВАЖНО: если мы ВНУТРИ Telegram, но id не определён — бросаем ошибку.
 * Это защита от смешивания данных двух аккаунтов в одном общем ключе.
 * Вне Telegram (разработка в обычном браузере) — работаем без суффикса.
 */
function makeKey(base: string): string {
  if (!tgUserId && inTelegram()) {
    throw new Error("[storage] Нет id Telegram-аккаунта — доступ к данным запрещён");
  }
  return tgUserId ? `${base}:tg-${tgUserId}` : base;
}

/** Прочитать данные текущего аккаунта. null, если их ещё нет. */
export function loadJSON<T>(base: string): T | null {
  let key: string;
  try { key = makeKey(base); } catch { return null; }
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* битые данные игнорируем */ }
  return null;
}

/** Записать данные: localStorage (мгновенно) + облако Telegram (в фоне). */
export function saveJSON(base: string, value: unknown): void {
  const key = makeKey(base); // может бросить ошибку — вызывающий решит, что делать
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] Не удалось записать в localStorage:", e);
  }
  /* Оповещаем подписчиков шины (AchievementToast и др.), что под этим
     ключом появились новые данные. БЕЗ этой строки плашка о достижении
     никогда не показывалась: слушатели регистрировались, но событие
     никто не рассылал. */
  saveListeners.forEach(fn => {
    try { fn(base, value); } catch { /* сломанный слушатель не ломает запись */ }
  });
  /* Тихая фоновая отправка в облако — одной пачкой, с ожиданием ответа
     сервера. Именно здесь раньше терялись данные между устройствами. */
  schedulePush(base);
}


/** Достаём данные из облака Telegram, если локально пусто (после чистки кэша).
 *  ⚠️ Устарело: основная логика теперь в syncWithCloud() — она сравнивает
 *  локальную и облачную копии и выбирает «богатейшую». Оставлено для
 *  совместимости со старыми вызовами. */
export async function restoreFromCloud(bases: string[]): Promise<void> {
  if (!tgUserId || !isCloudStorageSupported()) return;
  for (const base of bases) {
    const key = makeKey(base);
    if (localStorage.getItem(key)) continue; // локально всё уже есть
    try {
      const cloudRaw = await getCloudStorageItem(key);
      if (cloudRaw && !localStorage.getItem(key)) {
        localStorage.setItem(key, cloudRaw);
        console.log("[storage] Данные восстановлены из облака Telegram:", base);
      }
    } catch { /* облако недоступно — живём на локальных данных */ }
  }
}

/**
 * РАЗОВЫЙ ПЕРЕНОС СТАРЫХ ДАННЫХ.
 * Раньше цели/привычки лежали под ОБЩИМИ ключами (без ":tg-").
 * Если у игрока есть такие старые данные, а персональных ещё нет —
 * переносим их под его аккаунт, чтобы прогресс не пропал.
 * ⚠️ ОДНОРАЗОВО! Если двумя аккаунтами уже играли в общие ключи,
 * второй перенесёт чужие данные. Поэтому после переноса общий ключ
 * удаляем, а в main.tsx этот вызов можно убрать через пару запусков.
 */
export function migrateLegacyKeys(bases: string[]): void {
  if (!tgUserId) return; // вне Telegram переносить некуда
  for (const base of bases) {
    const legacy = localStorage.getItem(base);
    const personal = localStorage.getItem(makeKey(base));
    if (legacy && !personal) {
      localStorage.setItem(makeKey(base), legacy); // переносим под аккаунт
      localStorage.removeItem(base);               // убираем общий ключ навсегда
      // Удаляем и общую копию из облака TG: иначе на другом устройстве
      // restoreFromCloud может стянуть чужие/устаревшие данные.
      if (isCloudStorageSupported()) {
        try { void deleteCloudStorageItem(base).catch(() => {}); } catch { /* не страшно */ }
      }
      console.log("[storage] Старые данные перенесены под Telegram-аккаунт:", base);
    }
  }
}

