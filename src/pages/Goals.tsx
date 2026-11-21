/* ============================================================
   Goals.tsx — «Цели дня»: рабочие TODO в стиле макета.

   Правила:
   • до 10 целей в день, награду (💎) дают только первые 3;
   • выполненную цель НЕЛЬЗЯ разотметить и НЕЛЬЗЯ удалить
     (иначе можно «переиграть» награду);
   • просроченные цели: выполнить с опозданием (+1 💎 один раз)
     или удалить совсем;
   • всё хранится через lib/storage (привязка к аккаунту Telegram),
     кристаллы начисляет lib/wallet (стартовый баланс 0, повторных
     выплат нет — список paid).
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import "./Goals.css";
// «Умное хранилище» с привязкой к аккаунту Telegram (см. src/lib/storage.ts)
import { loadJSON, saveJSON } from "../lib/storage";
// Кошелёк кристаллов 💎: начисление, защита от повторов (см. src/lib/wallet.ts)
import { addGems, markGoalPaid } from "../lib/wallet";

/* ---------- Правила игры (константы) ---------- */
const MAX_PER_DAY = 10;     // максимум НОВЫХ целей за один день
const REWARD_SLOTS = 3;     // сколько первых целей дня получают награду
const REWARD_GEMS = 3;      // 3 💎 за каждую выполненную цель из первых трёх
const LATE_REWARD_GEMS = 1; // просроченная цель с опозданием — 1 💎
const MAX_LEN = 80;         // длина одной цели не больше 80 символов

type Goal = {
  id: string;
  text: string;
  date: string;   // 'ГГГГ-ММ-ДД' создания (по нему считаем лимит)
  done: boolean;
  reward: number; // зафиксирована при создании: 3 для первых 3, иначе 0
};

function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const STORAGE_KEY = "mb-goals-v1";

function loadGoals(): Goal[] {
  const parsed = loadJSON<Goal[]>(STORAGE_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export default function Goals() {
  /* ---------- СОСТОЯНИЯ ---------- */
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [draft, setDraft] = useState("");

  /* Любое изменение списка целей пишем в «умное хранилище» (localStorage + облако TG) */
  useEffect(() => {
    saveJSON(STORAGE_KEY, goals);
  }, [goals]);

  /* Синхронизация наград при загрузке: у невыполненных сегодняшних целей
     первые 3 слота = REWARD_GEMS, остальные = 0. Выполненные не трогаем. */
  useEffect(() => {
    setGoals(prev => {
      const t = todayStr();
      let idx = -1;
      let changed = false;
      const next = prev.map(g => {
        if (g.done || g.date !== t) return g;
        idx += 1;
        const want = idx < REWARD_SLOTS ? REWARD_GEMS : 0;
        if (g.reward !== want) {
          changed = true;
          return { ...g, reward: want };
        }
        return g;
      });
      return changed ? next : prev;
    });
  }, []); // пустой массив зависимостей = только при первом рендере

  /* ---------- ВЫЧИСЛЯЕМЫЕ ВЕЛИЧИНЫ ---------- */
  const today = todayStr();
  const todays = useMemo(() => goals.filter(g => g.date === today), [goals, today]);
  const overdue = useMemo(() => goals.filter(g => g.date !== today && !g.done), [goals, today]);
  const leftToday = Math.max(0, MAX_PER_DAY - todays.length);
 



  /* ---------- ДЕЙСТВИЯ ---------- */

  // Добавление цели: проверяем лимит 10/день и длину
  function addGoal() {
    const text = draft.trim();
    if (!text) return;
    if (leftToday <= 0) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      text: text.slice(0, MAX_LEN),
      date: today,
      done: false,
      // награду дают только первым REWARD_SLOTS целям дня
      reward: todays.length < REWARD_SLOTS ? REWARD_GEMS : 0,
    };
    setGoals(prev => [...prev, goal]);
    setDraft("");
  }

  // Переключение галочки: кликнули по карточке — цель выполнилась
  function toggleGoal(id: string) {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      if (g.done) return g;                 // ✅ выполненную цель НЕ переключаем назад
      if (g.reward > 0 && markGoalPaid(g.id)) {
        // ПЕРВОЕ выполнение призовой цели — платим её награду (3 💎)
        addGems(g.reward, `цель «${g.text}»`);
      }
      return { ...g, done: true };          // отмечаем выполненной навсегда
    }));                                     // ← ВОТ ЭТОЙ СКОБКИ У ВАС НЕ ХВАТАЛО
  }                                           // ← и закрывающей скобки самой функции

  /* Просроченная цель: награда падает до 1 💎, платим только при первом
     выполнении (paid). Бесплатные цели (reward=0) остаются без награды. */
  function completeLate(id: string) {
    setGoals(prev => prev.map(g => {
      if (g.id !== id || g.done) return g;
      const lateReward = g.reward > 0 ? LATE_REWARD_GEMS : 0;
      if (lateReward > 0 && markGoalPaid(g.id)) {
        addGems(lateReward, `просроченная цель «${g.text}»`);  // +1 💎 один раз
      }
      return { ...g, done: true, reward: lateReward };
    }));
  }

  // Удаление цели. Выполненные НЕ удаляем — иначе можно «переиграть» награду.
  function deleteGoal(id: string) {
    setGoals(prev => prev.filter(g => !(g.id === id && !g.done)));
  }

  /* ---------- РАЗМЕТКА ---------- */
  return (
    <div className="gl-wrap">

      {/* Шапка: название + живой счётчик «создано / лимит» */}
      <div className="gl-head">
        <h2 className="gl-title"> Цели дня</h2>
        <span className="gl-counter" title={`Можно создавать до ${MAX_PER_DAY} целей в день, но награду дают только за первые ${REWARD_SLOTS}`}>
          сегодня {todays.length}/{MAX_PER_DAY}
        </span>
      </div>

      {/* Плашка о просроченных целях из прошлых дней (если такие есть) */}
      {overdue.length > 0 && (
        <div className="gl-overdue"> Просрочено целей: {overdue.length}</div>
      )}

      {/* Панель создания новой цели */}
      <div className="gl-form">
        <input
          className="gl-input"
          value={draft}
          maxLength={MAX_LEN}
          placeholder="Новая цель…"
          disabled={leftToday === 0}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addGoal(); }}
        />
        <button
          type="button"
          className="gl-add"
          onClick={addGoal}
          disabled={leftToday === 0 || draft.trim() === ""}
        >+</button>
      </div>

      {/* Подсказка под формой: меняет текст в зависимости от ситуации */}
      <div className="gl-hint">
        {leftToday === 0
          ? `Лимит ${MAX_PER_DAY} целей на сегодня исчерпан. Новые появятся завтра.`
          : todays.length >= REWARD_SLOTS
            ? `Призовые места (первые ${REWARD_SLOTS}) уже заняты — новые цели сегодня без 💎`
            : `За каждую из первых ${REWARD_SLOTS} целей — ${REWARD_GEMS} 💎`}
      </div>

      {/* Список целей: сначала сегодняшние, потом просроченные */}
      <div className="gl-list">
        {goals.length === 0 && (
          <div className="gl-empty">
            <span className="big">✅</span>
            Пока пусто. Придумай цель на сегодня!<br />
            Можно создать до {MAX_PER_DAY} целей в день,<br />
            но награду дают только за первые {REWARD_SLOTS}.
          </div>
        )}

        {/* .map превращает каждый объект цели в карточку.
            Индекс i — порядок создания: цели с i >= REWARD_SLOTS (4-я и позже)
            помечаются классом "nofee" — у них награда 0 💎. */}
        {todays.map((g, i) => (
          <div
            key={g.id}
            className={"gl-card" + (g.done ? " done locked" : "") + (i >= REWARD_SLOTS ? " nofee" : "")}
            onClick={() => toggleGoal(g.id)}   // клик внутри сам отфильтрует done-цели
          >
            <span className="gl-check">{g.done ? "✔" : ""}</span>
            <span className="gl-text">{g.text}</span>
            {/* награду показываем только у призовых целей (первые 3);
                остальные — пусто, ничего не пишем */}
            {g.reward > 0 && <span className="gl-reward">💎{g.reward}</span>}
            {!g.done && (
              <button
                type="button"
                className="gl-del"
                title="Удалить цель"
                onClick={e => { e.stopPropagation(); deleteGoal(g.id); }}
              >✕</button>
            )}
          </div>
        ))}

        {/* Вчерашние незакрытые цели: выполняем кликом по чекбоксу (1 💎) или удаляем крестиком */}
        {overdue.map(g => (
          <div
            key={g.id}
            className={"gl-card late" + (g.reward === 0 ? " nofee" : "")}
            title="Цель из прошлого дня"
            onClick={() => completeLate(g.id)}   // клик по карточке = выполнить с опозданием
          >
            {/* обычный чекбокс-кружок слева: пустой → при клике станет ✔ */}
            <span className="gl-check">{g.done ? "✔" : ""}</span>
            <span className="gl-text">{g.text}</span>
            <button
              type="button"
              className="gl-del"
              title="Удалить просроченную цель"
              onClick={e => { e.stopPropagation(); deleteGoal(g.id); }}
            >✕</button>
          </div>
        ))}
      </div>

    </div>
  );
}