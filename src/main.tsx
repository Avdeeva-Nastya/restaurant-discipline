// Точка входа: берёт компонент App и «вставляет» его в <div id="root">.
// Этот файл не трогаем — он просто выключатель света в комнате.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Наше «умное хранилище» с привязкой к аккаунту Telegram (см. lib/storage.ts)
import { initTelegramUser, migrateLegacyKeys, restoreFromCloud } from "./lib/storage";

// Список базовых имён ключей данных игры. Добавляй сюда новые ключи,
// если придумаешь новую страницу с сохранением (например, копить монеты).
const DATA_KEYS = ["mb-goals-v1", "mb-habits-v1"];

// 1) Узнаём id пользователя Telegram (если мы открыты внутри TG).
initTelegramUser();
// 2) Если у игрока уже были данные без привязки — переносим их под его аккаунт.
migrateLegacyKeys(DATA_KEYS);
// 3) Пробуем восстановить данные из облака Telegram (на случай чистки кэша).
//    Делаем это ДО первого рендера, чтобы страницы сразу увидели цели/привычки.
await restoreFromCloud(DATA_KEYS);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);