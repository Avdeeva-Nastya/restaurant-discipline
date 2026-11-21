// Точка входа: берёт компонент App и «вставляет» его в <div id="root">.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Наше «умное хранилище» с привязкой к аккаунту Telegram (см. lib/storage.ts)
import { initTelegramUser, migrateLegacyKeys, restoreFromCloud } from "./lib/storage";

// Список базовых имён ключей данных игры. Добавляй сюда новые ключи,
// если придумаешь новую страницу с сохранением (например, копить монеты).
const DATA_KEYS = ["mb-goals-v1", "mb-habits-v1", "mb-wallet-v1", "mb-rating-v1"];

const root = createRoot(document.getElementById("root")!);

// 1) Узнаём id пользователя Telegram. ВАЖНО: функция теперь async —
//    она ждёт готовности данных запуска и возвращает id или null.
//    Без id мы НЕ рендерим игру: иначе данные обоих аккаунтов легли бы
//    в один общий ключ и «смешались» (баг, который вы наблюдали).
const userId = await initTelegramUser();

if (!userId && window.location.search.includes("tgWebAppData")) {
  // Мы внутри Telegram (параметр запуска есть), но id не достали —
  // показываем понятную заглушку вместо общего хранилища.
  root.render(
    <div style={{ padding: 40, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
      <h2>Откройте игру заново 🐈</h2>
      <p>Не удалось определить ваш аккаунт Telegram.<br />
         Закройте мини-приложение и откройте его снова.</p>
    </div>,
  );
} else {
  // 2) Если у игрока уже были данные без привязки — переносим их под его аккаунт.
  migrateLegacyKeys(DATA_KEYS);
  // 3) Пробуем восстановить данные из облака Telegram (на случай чистки кэша).
  //    Делаем это ДО первого рендера, чтобы страницы сразу увидели цели/привычки.
  await restoreFromCloud(DATA_KEYS);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}