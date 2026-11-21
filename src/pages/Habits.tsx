/* ============================================================
   Habits.tsx — страница «Привычки».

   НОВЫЕ ПРАВИЛА (по дизайну):
   • Одновременно можно держать НЕ БОЛЕЕ 3 активных привычек.
   • Панель создания — СВЕРХУ, список привычек — ниже.
   • Убраны «идеальный день» и предупреждающие плашки.
   • Убрана надпись «новые привычки появятся завтра».
   • Награды в кристаллах 💎 (через общий кошелёк lib/wallet):
       - за каждый выполненный день серии      -> +2 💎;
       - бонус за серию 7 / 14 / 21 дней       -> +5 / +10 / +15 💎.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import "./Habits.css";
// Общий кошелёк кристаллов: начисление + подписка шапки (см. src/lib/wallet.ts)
import { addGems, markGoalPaid } from "../lib/wallet";

/* ---------- Правила игры (константы) ---------- */
const MAX_ACTIVE = 3;      // максимум ОДНОВРЕМЕННЫХ активных привычек
const DAILY_GEM = 2;       // +2 💎 за каждый выполненный день серии
const MAX_LEN = 40;        // защита: длина названия привычки
// Бонусы за полное закрытие серии: target -> crystals
const STREAK_BONUS: Record<number, number> = { 7: 5, 14: 10, 21: 15 };
// Эмодзи, между которыми «крутится» кнопка выбора иконки
const EMOJIS = ["💪", "📚", "💧", "🧘", "🌅", "🦷", "🚶", "🥗"];

/* ---------- Тип «привычка» ----------
   target   — длительность серии (7 / 14 / 21 день),
   streak   — сколько дней подряд уже закрыто,
   lastMark — последний отмеченный день 'ГГГГ-ММ-ДД',
   created  — день создания. */
type Habit = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  streak: number;
  lastMark: string | null;
  created: string;
};

/* ---------- Хелперы про даты ---------- */

// Локальная дата 'ГГГГ-ММ-ДД' (не UTC — чтобы «день» совпадал с днём игрока)
function dateStr(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
const todayStr = () => dateStr(new Date());

// Серия считается ЖИВОЙ, если последний день отметки — сегодня или вчера.
function isAlive(h: Habit, today: string): boolean {
  if (!h.lastMark) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return h.lastMark === today || h.lastMark === dateStr(y);
}

/* Сколько кристаллов привычка уже «заработала»: дни × 2 + бонус за закрытую серию */
function earnedFor(h: Habit): number {
  const done = Math.min(h.streak, h.target);
  return done * DAILY_GEM + (done >= h.target ? (STREAK_BONUS[h.target] ?? 0) : 0);
}

/* Ключ хранилища. Версия v2 — новые правила наград/лимита. */
const STORAGE_KEY = "mb-habits-v2";

/* Читаем привычки из localStorage; битые данные → пустой список. */
function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Habit[]) : [];
  } catch {
    return [];
  }
}

export default function Habits() {
  /* ---------- СОСТОЯНИЯ (useState) ---------- */
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [draft, setDraft] = useState("");        // набранный текст новой привычки
  const [emoji, setEmoji] = useState(EMOJIS[0]); // выбранная иконка
  const [target, setTarget] = useState(7);       // выбранный цикл 7/14/21

  /* ---------- СОХРАНЕНИЕ: любое изменение пишем в localStorage ---------- */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  /* ---------- ВЫЧИСЛЯЕМЫЕ ВЕЛИЧИНЫ (useMemo) ---------- */
  const today = todayStr();

  // Активные = серия ещё не закрыта до конца. Именно их лимит: 3 шт.
  const activeCount = useMemo(
    () => habits.filter(h => h.streak < h.target).length,
    [habits],
  );
  const canAdd = activeCount < MAX_ACTIVE;

  /* ---------- ДЕЙСТВИЯ (обработчики) ---------- */

  // Создание привычки: проверяем лимит активных привычек и длину названия
  function addHabit() {
    const name = draft.trim();
    if (!name || !canAdd) return;          // 🔒 главный фильтр: не более 3 активных
    const habit: Habit = {
      id: crypto.randomUUID(),             // уникальные id без внешних библиотек
      name: name.slice(0, MAX_LEN),
      emoji,                               // фиксируем выбранную иконку
      target,                              // фиксируем выбранный цикл 7/14/21
      streak: 0,
      lastMark: null,
      created: today,
    };
    setHabits(prev => [...prev, habit]);
    setDraft("");
  }

  // Отметка «сделано сегодня»: +1 к серии (+2 💎) либо честный откат (−2 💎)
  function markToday(id: string) {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      if (h.lastMark === today) {
        // Уже отмечено сегодня → снимаем отметку и забираем дневную награду
        if (h.streak > 0) addGems(-DAILY_GEM, `отмена дня привычки «${h.name}»`);
        return { ...h, streak: Math.max(0, h.streak - 1), lastMark: null };
      }
      // Не отмечено: если вчерашний день пропущен — серия начинается заново
      const alive = isAlive(h, today);
      const base = alive ? h.streak : 0;
      const next = Math.min(base + 1, h.target);
      // Дневная награда: +2 💎 за каждый выполненный день
      addGems(DAILY_GEM, `день привычки «${h.name}»`);
      // Бонус за полностью закрытую серию: 7→+5, 14→+10, 21→+15 💎 (один раз)
      if (next >= h.target) {
        const bonus = STREAK_BONUS[h.target] ?? 0;
        if (bonus > 0 && markGoalPaid(`${h.id}:streak:${h.target}`)) {
          addGems(bonus, `серия ${h.target} дней «${h.name}»`);
        }
      }
      return { ...h, streak: next, lastMark: today };
    }));
  }

  // Удаление привычки из списка
  function deleteHabit(id: string) {
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  // Кнопка-эмодзи: по клику «крутит» иконку на следующую в списке
  function nextEmoji() {
    const i = EMOJIS.indexOf(emoji);
    setEmoji(EMOJIS[(i + 1) % EMOJIS.length]);
  }

  /* ---------- РАЗМЕТКА ---------- */
  return (
    <div className="hb-wrap">

      {/* Шапка: название + живой счётчик «активных / лимит» */}
      <div className="hb-head">
        <h2 className="hb-title">🔥 Привычки</h2>
        <span className="hb-counter" title={`Одновременно можно держать не более ${MAX_ACTIVE} привычек`}>
          активных {activeCount}/{MAX_ACTIVE}
        </span>
      </div>

      {/* ══ ПАНЕЛЬ СОЗДАНИЯ — СВЕРХУ ══ */}
      <div className="hb-form">
        {/* Кнопка-эмодзи: клик меняет иконку будущей привычки */}
        <button type="button" className="hb-pick" title="Выбрать иконку" onClick={nextEmoji}>
          {emoji}
        </button>
        <input
          className="hb-input"
          value={draft}
          maxLength={MAX_LEN}
          placeholder="Новая привычка…"
          disabled={!canAdd}                 /* лимит достигнут — поле неактивно */
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addHabit(); }} /* Enter = добавить */
        />
        {/* ГЛАВНЫЙ «ПЛЮСИК»: большая зелёная кнопка добавления */}
        <button
          type="button"
          className="hb-add"
          title={canAdd ? "Добавить привычку" : `Лимит ${MAX_ACTIVE} активных привычек`}
          onClick={addHabit}
          disabled={!canAdd || draft.trim() === ""}
        >+</button>
      </div>

      {/* Выбор цикла серии: 7 / 14 / 21 день */}
      <div className="hb-form hb-cycles">
        {[7, 14, 21].map(t => (
          <button
            key={t}
            type="button"
            className={"hb-cycle" + (target === t ? " on" : "")}
            title={`Серия на ${t} дней — бонус +${STREAK_BONUS[t]} 💎`}
            onClick={() => setTarget(t)}
          >{t} дн.</button>
        ))}
      </div>

      {/* Подсказка про награды */}
      <div className="hb-hint">
        За каждый день серии — +{DAILY_GEM} 💎, бонус за серию 7/14/21 дней — +5/+10/+15 💎.
      </div>

      {/* Список привычек — НИЖЕ панели создания */}
      <div className="hb-list">
        {habits.length === 0 && (
          <div className="hb-empty">
            <span className="big">🌱</span>
            Пока нет ни одной привычки.<br />
            Придумай первую!
          </div>
        )}

        {/* .map превращает каждую привычку в карточку */}
        {habits.map(h => {
          const markedToday = h.lastMark === today;
          const complete = h.streak >= h.target;
          const pct = Math.round((Math.min(h.streak, h.target) / h.target) * 100);
          return (
            <div key={h.id} className={"hb-card" + (complete ? " complete" : "")}>
              {/* Иконка привычки */}
              <span className="hb-emoji">{h.emoji}</span>

              <div className="hb-mid">
                <span className="hb-name">{h.name}</span>
                {/* Полоска прогресса серии: ширина = процент закрытых дней */}
                <div className="hb-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="hb-meta">
                  <span className="hb-streak">🔥 {h.streak}/{h.target} дн.</span>
                  {/* Награда: сколько 💎 принесла серия (дни×2 + бонус) */}
                  <span className="hb-reward">💎 {earnedFor(h)}</span>
                  {complete && <span>🏆 Серия закрыта!</span>}
                </div>
              </div>

              {/* Правая колонка: чекбокс и крестик стоят вертикально */}
              <div className="hb-actions">
                {/* Круглая кнопка отметки дня: ✔ = сегодня закрыто */}
                <button
                  type="button"
                  className={"hb-mark" + (markedToday ? " on" : "")}
                  title={markedToday ? "Снять отметку за сегодня" : "Отметить: сделано сегодня"}
                  onClick={() => markToday(h.id)}
                >✔</button>

                {/* Крестик: удалить привычку */}
                <button
                  type="button"
                  className="hb-del"
                  title="Удалить привычку"
                  onClick={() => deleteHabit(h.id)}
                >✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
