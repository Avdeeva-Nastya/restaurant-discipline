// storage.ts — «умное хранилище» данных игры.
//
// ЗАЧЕМ ЭТОТ ФАЙЛ:
// Раньше цели и привычки лежали просто в localStorage браузера под общим
// ключом ("mb-goals-v1"). Это значит:
//   • если открыть игру с другого телефона/в другом браузере — данные пропадут;
//   • если почистить кэш Telegram — данные тоже пропадут.
//
// Теперь мы привязываем данные к аккаунту пользователя Telegram:
//   1) Берём у Telegram SDK id пользователя (initDataUnsafe.user.id).
//   2) Сохраняем данные в localStorage под ПЕРСОНАЛЬНЫМ ключом, например:
//        "mb-goals-v1:tg-123456789"  ← цели именно этого аккаунта
//      То есть у каждого юзера TG будет СВОЙ набор целей/привычек.
//   3) Дополнительно пишем копию в Telegram Cloud Storage (sdk.storage).
//      Это облако Telegram: даже если пользователь очистит кэш, при следующем
//      открытии мы достанем данные из облака и восстановим их.
//
// Если приложение ОТКРЫТО НЕ В TELEGRAM (например, в обычном браузере для
// разработки) — всё работает по-старому, через общий ключ без суффикса.
// ============================================================================

// Экспортируемые методы облака Telegram из SDK (CloudStorage):
// setCloudStorageItem — сохранить строку в облаке, getCloudStorageItem — прочитать.
import {
  isCloudStorageSupported,
  setCloudStorageItem,
  getCloudStorageItem,
} from "@telegram-apps/sdk"; // облачное хранилище Telegram (CloudStorage)

/** Имя текущего пользователя Telegram или null, если мы не внутри TG. */
let tgUserId: string | null = null;

/**
 * Определяем id пользователя Telegram.
 * Вызываем один раз при старте приложения (см. main.tsx).
 * window.Telegram.WebApp — это объект, который Telegram внедряет в каждую
 * свою мини-игру автоматически.
 */
export function initTelegramUser(): void {
  try {
    // initDataUnsafe.user — данные юзера (без криптопроверки, но id там настоящий)
    const user = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user?.id != null) {
      tgUserId = String(user.id);
      console.log("[storage] Привязано к Telegram-аккаунту, id =", tgUserId);
    } else {
      console.log("[storage] Мы не в Telegram — работаем через обычный localStorage.");
    }
  } catch (e) {
    // Если окна Telegram нет (браузер/девка) — молча продолжаем без привязки
    console.log("[storage] Telegram недоступен:", e);
  }
}

/**
 * Превращает базовое имя ключа в персональное.
 *   makeKey("mb-goals-v1") → "mb-goals-v1:tg-123456789" (в Telegram)
 *   makeKey("mb-goals-v1") → "mb-goals-v1"              (в обычном браузере)
 */
function makeKey(base: string): string {
  return tgUserId ? `${base}:tg-${tgUserId}` : base;
}

/**
 * Прочитать данные. Возвращает уже разобранный объект или null, если данных нет.
 */
export function loadJSON<T>(base: string): T | null {
  const key = makeKey(base);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* повреждённые данные игнорируем — вернём null и начнём с чистого листа */
  }
  return null;
}

/**
 * Записать данные. Делает ДВЕ вещи:
 *   1) быстрая копия в localStorage (мгновенно, работает офлайн);
 *   2) копия в облако Telegram (асинхронно, переживает чистку кэша).
 * Ошибки облака не критичны — игра продолжит работать на localStorage.
 */
export function saveJSON(base: string, value: unknown): void {
  const key = makeKey(base);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] Не удалось записать в localStorage:", e);
  }
  // Облачная копия — только если мы внутри Telegram и метод поддерживается.
  // setCloudStorageItem возвращает Promise; ошибки ловим, чтобы не ронять интерфейс.
  if (tgUserId && isCloudStorageSupported()) {
    try {
      void setCloudStorageItem(key, JSON.stringify(value)).catch(() => {
        /* облако недоступно (нет сети / не токен) — не страшно */
      });
    } catch {
      /* метод вообще недоступен в этой версии клиента — игнорируем */
    }
  }
}

/**
 * Один раз при старте пытаемся вытащить данные из облака Telegram.
 * Если в localStorage пусто, а в облаке есть — восстанавливаем.
 * Так цели «не теряются» после чистки кэша или на новом устройстве.
 */
export async function restoreFromCloud(bases: string[]): Promise<void> {
  if (!tgUserId || !isCloudStorageSupported()) return; // не в Telegram — восстанавливать нечего
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

/**
 * Старые «общие» ключи (до привязки к TG). Если пользователь уже играл без
 * привязки, переносим его данные в персональный ключ, чтобы ничего не пропало.
 */
export function migrateLegacyKeys(bases: string[]): void {
  if (!tgUserId) return;
  for (const base of bases) {
    const legacy = localStorage.getItem(base);
    const personal = localStorage.getItem(makeKey(base));
    if (legacy && !personal) {
      localStorage.setItem(makeKey(base), legacy); // переносим старые данные под аккаунт
      // сам старый ключ оставляем — вдруг приложение откроют вне Telegram
      console.log("[storage] Старые данные перенесены под Telegram-аккаунт:", base);
    }
  }
}