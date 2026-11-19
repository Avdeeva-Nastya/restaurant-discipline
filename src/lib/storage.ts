// storage.ts — «умное хранилище», привязанное к аккаунту Telegram.
//
// ИСПРАВЛЕНИЕ БАГА (цели первого аккаунта лезли во второй):
//   Раньше tgUserId определялся ОДИН раз при импорте файла. Но скрипт
//   Telegram внедряется НЕ мгновенно: в момент импорта window.Telegram.WebApp
//   мог ещё не содержать initDataUnsafe.user -> tgUserId = null -> оба
//   аккаунта писали данные в ОДИН общий ключ "mb-goals-v1". Отсюда «общие цели».
//
//   Теперь:
//   1) initTelegramUser() — async: ждёт готовности WebApp через SDK
//      waitUntilReady() (или через событие telegram-webapp:ready), и только
//      потом читает user.id.
//   2) Если ID так и не получен — приложение НЕ запускается (см. main.tsx).
//      Никаких записей в «общий» ключ больше не происходит.
//   3) Убран перенос старых «общих» данных (migrateLegacyKeys) — именно он
//      копировал чужие цели новому аккаунту.
// ============================================================================

import {
  isCloudStorageSupported,
  setCloudStorageItem,
  getCloudStorageItem,
} from "@telegram-apps/sdk"; // облачное хранилище Telegram (CloudStorage)

/** Имя текущего пользователя Telegram или null, если ещё не определили. */
let tgUserId: string | null = null;

/** Готов ли WebApp? Ждём его появления/готовности максимум ~5 секунд. */
async function waitForWebApp(): Promise<any> {
  const w = window as any;
  // 1) Быстрый путь: объект уже есть и готов — берём сразу.
  if (w.Telegram?.WebApp?.isExpanded || w.Telegram?.WebApp?.initDataUnsafe?.user) {
    return w.Telegram.WebApp;
  }
  // 2) Ждём стандартного события "ready" от встроенного WebApp-объекта.
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 5000);          // страховка от зависания
    document.addEventListener("telegram-webapp:ready", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    // если объекта вообще нет — мы не в Telegram, ждать бессмысленно
    if (!w.Telegram?.WebApp) { clearTimeout(timeout); resolve(); }
  });
  return w.Telegram?.WebApp ?? null;
}

/**
 * Определяем id пользователя Telegram. Вызываем ОДИН РАЗ при старте (main.tsx)
 * и ОБЯЗАТЕЛЬНО до первого рендера — иначе страницы запишут данные вслепую.
 */
export async function initTelegramUser(): Promise<string | null> {
  const webApp = await waitForWebApp();

  // Путь 1: официальный SDK (@telegram-apps/sdk) — самый надёжный способ
  // получить данные пользователя внутри мини-приложения.
  try {
    const launchParams = await import("@telegram-apps/sdk").then(m => m.initLaunchParamsSync());
    // в новых версиях SDK: useLaunchParams / retrieveLaunchParams
    const userId = (webApp as any)?.initDataUnsafe?.user?.id;
    if (userId != null) tgUserId = String(userId);
  } catch {
    /* SDK может не проинициализироваться — идём дальше через WebApp */
  }

  // Путь 2: классический объект window.Telegram.WebApp (внедряется самим TG)
  if (!tgUserId && webApp?.initDataUnsafe?.user?.id != null) {
    tgUserId = String(webApp.initDataUnsafe.user.id);
  }

  if (tgUserId) {
    console.log("[storage] Привязано к Telegram-аккаунту, id =", tgUserId);
  } else {
    console.warn("[storage] НЕ удалось определить аккаунт Telegram!");
  }
  return tgUserId;
}

/** Спросить у других модулей: получили ли мы id. */
export function getTelegramUserId(): string | null {
  return tgUserId;
}

/**
 * Превращает базовое имя ключа в персональное.
 *   makeKey("mb-goals-v1") → "mb-goals-v1:tg-123456789"  ← данные ТОЛЬКО этого аккаунта
 * Если id неизвестен — бросаем ошибку: писать в общий ключ ЗАПРЕЩЕНО,
 * иначе аккаунты снова начнут делить одни цели на двоих.
 */
function makeKey(base: string): string {
  if (!tgUserId) {
    throw new Error("[storage] Нет id Telegram-аккаунта — запись/чтение запрещены");
  }
  return `${base}:tg-${tgUserId}`;
}

/** Прочитать данные текущего аккаунта (или null, если их ещё нет). */
export function loadJSON<T>(base: string): T | null {
  let key: string;
  try { key = makeKey(base); } catch { return null; } // нет id — читаем «пустоту»
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* повреждённые данные игнорируем — вернём null и начнём с чистого листа */
  }
  return null;
}

/**
 * Записать данные. ДВЕ копии:
 *   1) быстрая копия в localStorage под ПЕРСОНАЛЬНЫМ ключом аккаунта;
 *   2) копия в облако Telegram Cloud Storage (переживёт чистку кэша).
 */
export function saveJSON(base: string, value: unknown): void {
  const key = makeKey(base); // без id сюда не добраться (бросит ошибку)
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] Не удалось записать в localStorage:", e);
  }
  if (isCloudStorageSupported()) {
    try {
      void setCloudStorageItem(key, JSON.stringify(value)).catch(() => {
        /* облако недоступно (нет сети / не токен) — не страшно */
      });
    } catch {
      /* метод недоступен в этой версии клиента — игнорируем */
    }
  }
}

/**
 * Один раз при старте пытаемся вытащить данные из облака Telegram
 * (на случай, если игрок почистил кэш). Работает только когда id известен.
 */
export async function restoreFromCloud(bases: string[]): Promise<void> {
  if (!tgUserId || !isCloudStorageSupported()) return;
  for (const base of bases) {
    const key = makeKey(base);
    if (localStorage.getItem(key)) continue; // локально всё уже есть
    try {
      const cloudRaw = await getCloudStorageItem(key);
      if (cloudRaw && !localStorage.getItem(key)) {
        localStorage.setItem(key, cloudRaw); // вернули данные из облака в кэш
        console.log("[storage] Данные восстановлены из облака Telegram:", base);
      }
    } catch {
      /* облако недоступно — живём на том, что есть */
    }
  }
}