/* ============================================================
   Goals.tsx — «Цели дня»: рабочие TODO в стиле макета.

   Что умеет страница (и как это устроено):
   1. Создавать цели — НЕ БОЛЕЕ 3 ЗА ДЕНЬ (лимит MAX_PER_DAY).
      Счётчик целей привязан к дате создания: удалил цель — слот
      дня всё равно занят.
   2. Отмечать выполнение кликом по карточке (галочка).
   3. Удалять ещё невыполненную цель (крестик).
   4. Всё хранится в localStorage — после перезагрузки цели на месте.
   5. Вчерашние невыполненные цели помечаются «просрочено».

   Награды: 2 💎 за каждую выполненную цель.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import "./Goals.css";

const MAX_PER_DAY = 3;    // максимум НОВЫХ целей за один день
const REWARD_GEMS = 2;    // дизайн: 2 💎 за каждую выполненную цель
const MAX_LEN = 80;       // защита: длина одной цели не больше 80 символов

type Goal = {
  id: string;
  text: string;
  date: string;
  done: boolean;
  reward: number;
};

/* Хелпер: сегодняшняя дата в виде 'ГГГГ-ММ-ДД' (локальная, не UTC). */
function todayStr(): string {
  
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `d.setDate(d.getDate() + 1)`;
}

/* Ключ хранилища. */
const STORAGE_KEY = "mb-goals-v1";

/* Читаем цели из localStorage. Битые данные → пустой список. */
function loadGoals(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Goal[]) : [];
  } catch {
    return [];
  }
}

export default function Goals() {
  /* ---------- СОСТОЯНИЯ (useState) ---------- */
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [draft, setDraft] = useState(""); // текст, набранный но ещё не добавленный

  /* ---------- СОХРАНЕНИЕ: каждое изменение пишем в localStorage ---------- */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  /* ---------- ВЫЧИСЛЯЕМЫЕ ВЕЛИЧИНЫ (useMemo) ---------- */
  const today = todayStr();

  // Цели, созданные сегодня — по ним считаем дневной лимит
  const todays = useMemo(() => goals.filter(g => g.date === today), [goals, today]);
  // Просроченные: созданы раньше сегодня и так и не отмечены выполненными
  const overdue = useMemo(() => goals.filter(g => g.date !== today && !g.done), [goals, today]);

  // Сколько новых целей ОСТАЛОСЬ создать сегодня (не может быть < 0)
  const leftToday = Math.max(0, MAX_PER_DAY - todays.length);



  /* ---------- ДЕЙСТВИЯ (обработчики) ---------- */

  // Добавление цели: проверяем лимит и длину, затем дописываем в список
  function addGoal() {
    const text = draft.trim();          // срезаем пробелы по краям
    if (!text) return;                  // пустую цель не создаём
    if (leftToday <= 0) return;       // 🔒 главный фильтр: не более 3 за день

    const goal: Goal = {
      id: crypto.randomUUID(),          // уникальные id без внешних библиотек
      text: text.slice(0, MAX_LEN),     // защита от «простыни» текста
      date: today,                      // фиксируем день создания — он тратит слот
      done: false,
      reward: REWARD_GEMS,
    };
    setGoals(prev => [...prev, goal]);
    setDraft("");                       // очищаем поле ввода
  }

  // Переключение галочки: кликнули по карточке — цель выполнилась (или снялась)
  function toggleGoal(id: string) {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  // Удаление цели. Выполненные не удаляем — иначе можно «переиграть» награду.
  function deleteGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id || g.done));
  }

  /* ---------- РАЗМЕТКА ---------- */
  return (
    <div className="gl-wrap">

      {/* Шапка: название + живой счётчик «создано / лимит» */}
      <div className="gl-head">
        <h2 className="gl-title"> Цели дня</h2>
        <span className="gl-counter" title={`Можно создавать не более ${MAX_PER_DAY} целей в день`}>
          сегодня {todays.length}/{MAX_PER_DAY}
        </span>
      </div>

      {/* Плашка о просроченных целях из прошлых дней (если такие есть) */}
      {overdue.length > 0 && (
        <div className="gl-overdue">⚠️ Просрочено целей: {overdue.length}</div>
      )}

      {/* Список целей: сначала сегодняшние, потом просроченные */}
      <div className="gl-list">
        {goals.length === 0 && (
          /* Пустой список — крупная подсказка по центру всей зоны */
          <div className="gl-empty">
            <span className="big">✅</span>
            Пока пусто. Придумай цель на сегодня!<br />
            Можно создавать не более {MAX_PER_DAY} целей в день.
          </div>
        )}

        {/* .map превращает каждый объект цели в карточку */}
        {todays.map(g => (
          <div
            key={g.id}
            className={"gl-card" + (g.done ? " done" : "")}
            onClick={() => toggleGoal(g.id)}
          >
            {/* Квадратный чекбокс: галочка появляется, когда done=true */}
            <span className="gl-check">{g.done ? "✔" : ""}</span>
            <span className="gl-text">{g.text}</span>
            {/* Награда справа; цель кликабельна целиком */}
            <span className="gl-reward">💎{g.reward}</span>
            {/* Крестик: stopPropagation — клик по нему НЕ включает галочку */}
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

        {/* Вчерашние незакрытые цели — помечены состоянием «late» */}
        {overdue.map(g => (
          <div key={g.id} className="gl-card late" title="Цель из прошлого дня">
            <span className="gl-check">!</span>
            <span className="gl-text">{g.text}</span>
            <span className="gl-reward">💎{g.reward}</span>
          </div>
        ))}
      </div>

      {/* Панель создания новой цели */}
      <div className="gl-form">
        <input
          className="gl-input"
          value={draft}
          maxLength={MAX_LEN}
          placeholder="Новая цель…"
          disabled={leftToday === 0}          /* исчерпан лимит — поле неактивно */
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addGoal(); }} /* Enter = добавить */
        />
        <button
          type="button"
          className="gl-add"
          onClick={addGoal}
          disabled={leftToday === 0 || draft.trim() === ""}
        >+ цель</button>
      </div>

    </div>
  );
}