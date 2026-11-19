// Точка входа. ВАЖНО: сначала узнаём аккаунт Telegram, ПОТОМ рисуем игру.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// «Умное хранилище» с привязкой к аккаунту Telegram (см. lib/storage.ts)
import { initTelegramUser, restoreFromCloud } from "./lib/storage";

// Список базовых имён ключей данных игры. Добавляй сюда новые ключи,
// если придумаешь новую страницу с сохранением (например, копить монеты).
const DATA_KEYS = ["mb-goals-v1", "mb-habits-v1", "mb-wallet-v1"];

// 1) ЖДЁМ определения id пользователя Telegram (await!).
//    Это гарантирует: ни одна страница не запишет данные «в общий котёл»,
//    потому что без id storage сам запретит запись.
const userId = await initTelegramUser();

const root = createRoot(document.getElementById("root")!);

if (!userId) {
  // 2) Аккаунт неизвестен (например, открыли сайт в обычном браузере или
  //    TG-клиент не передал данные) — показываем заглушку вместо игры,
  //    чтобы два разных пользователя точно не делили один список целей.
  root.render(
    <div style={{ padding: 40, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
      <h2>Откройте игру внутри Telegram 🐈</h2>
      <p>Чтобы сохранить ваши личные цели и кристаллы, нужно запустить
         «Мур-мур бистро» как мини-приложение Telegram.</p>
    </div>
  );
} else {
  // 3) Восстанавливаем данные аккаунта из облака Telegram (если кэш был пуст).
  await restoreFromCloud(DATA_KEYS);
  // 4) Только теперь рисуем приложение — все модули уже знают, ЧЬИ данные грузить.
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

Object.keys(localStorage)
  .filter(k => k.startsWith("mb-goals-v1") || k.startsWith("mb-habits-v1") || k.startsWith("mb-wallet-v1"))
  .filter(k => !k.includes(":tg-"))           // удаляем только НЕперсональные ключи
  .forEach(k => localStorage.removeItem(k));
location.reload();