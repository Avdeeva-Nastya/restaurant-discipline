// ============================================================================
// storage.ts — «умное хранилище», привязанное к аккаунту Telegram.
//
// КАК РАБОТАЕТ ПРИВЯЗКА:
// Каждые данные пишутся под ПЕРСОНАЛЬНЫМ ключом: "mb-goals-v1:tg-<id>".
// id берём из Telegram тремя способами по очереди (самый надёжный первым).
// Если мы внутри Telegram, но id получить не удалось — запись и чтение
// ЗАПРЕЩЕНЫ (иначе данные одного пользователя увидит другой).
// ============================================================================

import { retrieveLaunchParams, init } from "@telegram-apps/sdk"; // официальный SDK мини-приложений
import {
  isCloudStorageSupported,
  setCloudStorageItem,
  getCloudStorageItem,
  deleteCloudStorageItem,
} from "@telegram-apps/sdk"; // облачное хранилище Telegram (CloudStorage)

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

/** Отправить свежие локальные данные всех ключей в облако Telegram.
 *  Вызывается из main.tsx после первого рендера — благодаря этому
 *  прогресс, накопленный на этом устройстве (например, на телефоне),
 *  оказывается в облаке и другие устройства (ПК) подтянут его при
 *  следующем запуске. */
export async function pushAllToCloud(bases: string[]): Promise<void> {
  if (!tgUserId || !isCloudStorageSupported()) return;
  for (const base of bases) {
    const key = makeKey(base);
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      await setCloudStorageItem(key, raw);
    } catch { /* облако недоступно — не критично */ }
  }
  console.log("[storage] Локальные данные отправлены в облако Telegram");
}

/**
 * Полная синхронизация с облаком при каждом запуске:
 *   • для каждого ключа сравниваем локальную копию и облачную;
 *   • есть только одна из них — эта копия «новее» (её создало другое
 *     устройство) → сохраняем у себя;
 *   • обе есть и различаются → выбираем ту, где больше данных
 *     (длиннее JSON-строка), и отправляем её в облако, чтобы
 *     устройства сошлись на общем прогрессе.
 * Возвращает true, если из облака удалось что-то заполучить.
 */
export async function syncWithCloud(bases: string[]): Promise<boolean> {
  if (!tgUserId || !isCloudStorageSupported()) return false;
  let restored = false;
  for (const base of bases) {
    const key = makeKey(base);
    const local = localStorage.getItem(key);
    let cloud: string | null = null;
    try {
      cloud = (await getCloudStorageItem(key)) || null; // пусто -> ""
    } catch { continue; } // ключа нет или облако недоступно
    if (!local && cloud) {
      localStorage.setItem(key, cloud);
      restored = true;
      console.log("[storage] Данные восстановлены из облака Telegram:", base);
    } else if (local && cloud && local !== cloud) {
      // Разные копии на разных устройствах — побеждает «богатейшая»
      if (cloud.length > local.length) {
        localStorage.setItem(key, cloud);
        restored = true;
        console.log("[storage] Облачная копия новее локальной:", base);
      } else {
        try { await setCloudStorageItem(key, local); } catch { /* ок */ }
      }
    }
  }
  return restored;
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
  if (isCloudStorageSupported()) {
    try {
      void setCloudStorageItem(key, JSON.stringify(value)).catch(() => {});
    } catch { /* метод недоступен в этом клиенте — не страшно */ }
  }
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
        try { void importCloudDelete(base).catch(() => {}); } catch { /* не страшно */ }
      }
      console.log("[storage] Старые данные перенесены под Telegram-аккаунт:", base);
    }
  }
}

/* Облачное удаление — импортируем лениво, чтобы не менять верхние импорты. */
function importCloudDelete(key: string): Promise<void> {
  return deleteCloudStorageItem(key);
}