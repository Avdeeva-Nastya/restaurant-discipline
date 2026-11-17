// Точка входа: берёт компонент App и «вставляет» его в <div id="root">.
// Этот файл не трогаем — он просто выключатель света в комнате.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);