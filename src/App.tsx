/* ============================================================
   App.tsx — «скелет» экрана: что вообще стоит на странице.
   Это МАКЕТ: только дизайн. Ни состояний, ни таймеров, ни логики.
   Все цифры ниже — нарисованные данные, как на картинке (ищите
   пометку «МАКЕТНЫЕ ДАННЫЕ»). Места для будущей логики помечены
   «ЯКОРЬ» — по ним другой разработчик или ИИ поймёт, куда подключаться.
   ============================================================ */ 
import { useEffect, useState } from "react";
import { loadWallet, onWalletChange } from "./lib/wallet";

// ПРИНОСИМ СТРАНИЦЫ: говорим React, где лежат комнаты
import Habits from "./pages/Habits";
import Goals from "./pages/Goals";
import Shop from "./pages/Shop";
import Profile from "./pages/Profile";
import Restaurant from "./pages/Restaurant";
import "./App.css";




/* ---------- Иконки ----------
   Нарисованы кодом (SVG) — векторные наклейки: не мутнеют при
   увеличении. currentColor — «хамелеон»: иконка берёт цвет текста
   своего родителя, поэтому в активной вкладке она сама станет белой. */
type IconName = "cloche" | "hat" | "book" | "store" | "chart" | "gear" | "coin" | "gem";

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  switch (name) {
    case "cloche": // колпак для блюд — вкладка «Ресторан»
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><path d="M4 17h16" /><path d="M5 17a7 7 0 0 1 14 0" /><path d="M12 10V8" /><circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" /><path d="M3 20h18" /></svg>);
    case "hat": // колпак повара — «Привычки»
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><path d="M7 13.5a3.5 3.5 0 0 1-1.6-6.6 4.5 4.5 0 0 1 8.7-1.4A4 4 0 0 1 18 13.4" /><path d="M7 13.5V18h10v-4.6" /><path d="M7 20.5h10" /><path d="M10 14v2.5M14 14v2.5" /></svg>);
    case "book": // раскрытая книга — «Цели дня»
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><path d="M12 6.5C10.5 5 8.4 4.5 5.5 4.5c-1 0-2 .1-2.5.3v13.7c.5-.2 1.5-.3 2.5-.3 2.9 0 5 .5 6.5 2 1.5-1.5 3.6-2 6.5-2 1 0 2 .1 2.5.3V4.8c-.5-.2-1.5-.3-2.5-.3-2.9 0-5 .5-6.5 2z" fill="#FBEBB8" /><path d="M12 6.5v13.7" /></svg>);
    case "store": // лавка с маркизой — «Магазин»
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><path d="M4 9l1-4.5h14L20 9" /><path d="M4 9a2.6 2.6 0 0 0 5.3 0A2.6 2.6 0 0 0 14.6 9 2.6 2.6 0 0 0 20 9" fill="#D96C4F" stroke="#B4543C" /><path d="M5.5 11.5v8h13v-8" /><path d="M9.5 19.5v-5h5v5" /></svg>);
    case "chart": // столбики — «Профиль»
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><path d="M5 20V13" strokeWidth="3" /><path d="M12 20V6" strokeWidth="3" /><path d="M19 20v-9" strokeWidth="3" /></svg>);
    case "gear": // шестерёнка настроек
      return (<svg width={size} height={size} viewBox="0 0 24 24" {...line}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
    case "coin": // монета с долларом — цветная, не «хамелеон»
      return (<svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#F6C453" stroke="#8A6B2F" strokeWidth="2" /><text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7A5B22" fontFamily="Nunito, sans-serif">$</text></svg>);
    case "gem": // кристалл
      return (<svg width={size} height={size} viewBox="0 0 24 24"><path d="M7 4h10l4 5-9 11L3 9z" fill="#BFE3D2" stroke="#3C716B" strokeWidth="1.8" strokeLinejoin="round" /><path d="M3 9h18M9.5 9L12 20 14.5 9M7 4l2.5 5L12 4l2.5 5L17 4" stroke="#3C716B" strokeWidth="1.2" fill="none" /></svg>);
    default:
      return null;
  }
}

/* ---------- Оглавление вкладок ----------*/

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "restaurant", label: "Ресторан", icon: "cloche" },
  { id: "goals", label: "Цели", icon: "book" },
  { id: "habits", label: "Привычки", icon: "hat" },
  { id: "shop", label: "Магазин", icon: "store" },
  { id: "profile", label: "Профиль", icon: "chart" }
];

/* ---------- Сам экран ---------- */
export default function App() {
  // ЯКОРЬ: здесь позже появится useState для активной вкладки, монет и т.д.
  // В макете активная вкладка задана вручную константой ниже.

  const [activeTab, setActiveTab] = useState("restaurant");
   const [gems, setGems] = useState(() => loadWallet().gems);
  useEffect(() => {
    const off = onWalletChange(setGems);
    const onStorage = () => setGems(loadWallet().gems);
    window.addEventListener("storage", onStorage);
    return () => { off(); window.removeEventListener("storage", onStorage); };
  }, []);

  return (
    
    <div className="mb-root">
      <div className="mb-caption">Мур-мур бистро · Ресторан</div>

      <div className="mb-frame">
        <div className="mb-screen">

          {/* Шапка */}
          <header className="mb-hdr">
            <div className="mb-hrow">
              {/* МАКЕТНЫЕ ДАННЫЕ: уровень 1.6 */}
              <span className="mb-lvl" title="Уровень бистро">1.6</span>
              <h1 className="mb-title">Мур-мур бистро</h1>
              {/* ЯКОРЬ:onClick открытия настроек. Пока кнопка просто выглядитClickable. */}
              <button type="button" className="mb-icobtn" title="Настройки">
                <Icon name="gear" size={18} />
              </button>
            </div>

            {/* Кошелёк. МАКЕТНЫЕ ДАННЫЕ: 12 450 монет, 85 кристаллов, +240/мин */}
            <div className="mb-wallet">
              <span className="mb-pill coin" title="Монеты"><Icon name="coin" size={20} /> 12 450</span>
              <span className="mb-pill gem" title="Кристаллы"><Icon name="gem" size={18} /> {gems}</span>
              <span className="mb-income" title="Пассивный доход">+240 / мин</span>
            </div>
          </header>

          {/* Контент: иллюстрация зала + статичные информационные карточки */}
          <main className="mb-content mb-scroll">
          
{/* ОБЛАСТЬ КОНТЕНТА: показываем ту страницу, что на стикере */}
               <div style={{ minHeight: 200, padding: 10 }}>
                  {activeTab === "restaurant" && <Restaurant />}
                  {activeTab === "habits" && <Habits />}
                  {activeTab === "goals" && <Goals />}
                  {activeTab === "shop" && <Shop />}
                  {activeTab === "profile" && <Profile />}
                </div>
          </main>

      {/* МЕНЮ: кнопки внизу */}
      <nav  className="mb-nav" >
        {TABS.map(tab => (
          <button 
            key={tab.id}
                type="button"
                className ={"mb-tab" + (tab.id === activeTab ? " is-active" : "")}
                aria-current={tab.id === activeTab ? "page" : undefined}
            // КНОПКА ЗВОНКА: при клике переписываем стикер на id этой кнопки
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="ico"><Icon name={tab.icon} size={20} /></span>
            <span className="lbl">{tab.label}</span>
          </button>
        ))}
      </nav>
          <div className="mb-home"><i /></div>

        </div>
      </div>
    </div>
  );
}