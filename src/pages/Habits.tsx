/* ============================================================
   Habits.tsx — страница «Привычки»: рабочие привычки на 7/14/21 день.

   Что умеет (и как это устроено):
   1. СОЗДАНИЕ ПРИВЫЧЕК — НЕ БОЛЕЕ 3 ЗА ДЕНЬ (константа MAX_PER_DAY).
      Счётчик привязан к дате создания: удалил привычку — слот дня
      всё равно остаётся занятым (обойти лимит нельзя).
   2. КНОПКА «ПЛЮСИК» внизу рабочей области — большое зелёное «+»,
      рядом поле ввода и кнопка-эмодзи для выбора иконки.
   3. ОТМЕТКА ДНЯ: круглая кнопка ✔ на карточке. Отметили сегодня —
      серия (streak) +1; завтра можно отметить снова.
   4. СЕРИЯ ПРОСРОЧЕНА: если вчера не отметили — streak обнуляется,
      а сверху появляется оранжевая плашка-предупреждение.
   5. НАГРАДЫ по дизайну: 💎 за каждый закрытый отрезок серии
      (7 дней → +3💎, 14 → +6💎, 21 → +9💎); когда ВСЕ отметки
      на сегодня закрыты — баннер «идеальный день» (+5💎).
   6. ХРАНЕНИЕ: localStorage — после перезагрузки всё на месте.

   ЯКОРЬ: здесь позже подключится реальный кошелёк игры
   (монеты/кристаллы из App.tsx) — сейчас награды показаны
   на карточках как в дизайне.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import "./Habits.css";
// «Умное хранилище» с привязкой к аккаунту Telegram (см. src/lib/storage.ts)
import { loadJSON, saveJSON } from "../lib/storage";

/* ---------- Правила игры (константы) ---------- */
const MAX_PER_DAY = 3;   // максимум НОВЫХ привычек за один день
const PERFECT_BONUS = 5; // дизайн: +5 💎 за идеальный день
const MAX_LEN = 40;      // защита: длина названия привычки
// Циклы серий: каждые N закрытых дней выдаём порцию кристаллов
const STREAK_STEP = 7;
const GEMS_PER_STEP = 3;
// Эмодзи, между которыми «крутится» кнопка выбора иконки
const EMOJIS = ["💪", "📚", "💧", "🧘", "🌅", "🦷", "🚶", "🥗"];

/* ---------- Тип «привычка» ----------
   target   — длительность серии (7 / 14 / 21 день),
   streak   — сколько дней подряд уже закрыто,
   lastMark — последний отмеченный день 'ГГГГ-ММ-ДД'
              (по нему понимаем: сегодня ещё можно отметить или нет),
   created  — день создания (тратит дневной слот). */
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

// Дата «позавчера»: нужно для проверки просрочки серии
function yesterday2Str(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return dateStr(d);
}

/* Серия считается ЖИВОЙ, если последний день отметки — сегодня или вчера.
   Если lastMark старше вчерашнего дня — цепочка оборвалась. */
function isAlive(h: Habit, today: string): boolean {
  if (!h.lastMark) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return h.lastMark === today || h.lastMark === dateStr(y);
}

/* Сколько кристаллов привычка уже «заработала»: по 3 💎 за каждые 7 дней */
function earnedGems(h: Habit): number {
  return Math.floor(Math.min(h.streak, h.target) / STREAK_STEP) * GEMS_PER_STEP;
}

/* Ключ хранилища. Версия v1 — если правила изменятся,
   поднимем версию и аккуратно сбросим старые данные.
   ВАЖНО: через lib/storage ключ привязывается к аккаунту Telegram
   (реальное имя = "mb-habits-v1:tg-<id>"). */
const STORAGE_KEY = "mb-habits-v1";

/* Читаем привычки из «умного хранилища»; битые данные → пустой список,
   игра не должна падать из-за хранилища. */
function loadHabits(): Habit[] {
  const parsed = loadJSON<Habit[]>(STORAGE_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export default function Habits() {
  /* ---------- СОСТОЯНИЯ (useState) ---------- */
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [draft, setDraft] = useState("");     // набранный текст новой привычки
  const [emoji, setEmoji] = useState(EMOJIS[0]); // выбранная иконка
  const [target, setTarget] = useState(7);    // выбранный цикл 7/14/21

  /* ---------- СОХРАНЕНИЕ ----------
   Любое изменение списка пишем в «умное хранилище»: localStorage +
   облако Telegram. Данные привязаны к аккаунту TG и не теряются. */
  useEffect(() => {
    saveJSON(STORAGE_KEY, habits);
  }, [habits]);

  /* ---------- ВЫЧИСЛЯЕМЫЕ ВЕЛИЧИНЫ (useMemo) ---------- */
  const today = todayStr();

  // Привычки, созданные сегодня — по ним считаем дневной лимит
  const todays = useMemo(() => habits.filter(h => h.created === today), [habits, today]);
  // Просроченные серии: живая цепочка, но сегодня ещё НЕ отмечено
  const dueToday = useMemo(
    () => habits.filter(h => isAlive(h, today) && h.lastMark !== today && h.streak < h.target),
    [habits, today],
  );
  // Оборванные серии: отмечали позавчера и раньше, но не вчера/сегодня
  const broken = useMemo(
    () => habits.filter(h => h.lastMark !== null && h.lastMark !== today && h.lastMark !== yesterday2Str() && !isAlive(h, today)),
    [habits, today],
  );

  // Сколько новых привычек ОСТАЛОСЬ создать сегодня (не может быть < 0)
  const leftToday = Math.max(0, MAX_PER_DAY - todays.length);
  // Идеальный день: есть привычки И все, что надо отметить сегодня, отмечены
  const perfectDay = habits.length > 0 && dueToday.length === 0;

  /* ---------- ДЕЙСТВИЯ (обработчики) ---------- */

  // Создание привычки: проверяем лимит и длину, дописываем в список
  function addHabit() {
    const name = draft.trim();
    if (!name) return;            // пустую привычку не создаём
    if (leftToday <= 0) return;   // 🔒 главный фильтр: не более 3 за день
    const habit: Habit = {
      id: crypto.randomUUID(),    // уникальные id без внешних библиотек
      name: name.slice(0, MAX_LEN),
      emoji,                      // фиксируем выбранную иконку
      target,                     // фиксируем выбранный цикл 7/14/21
      streak: 0,
      lastMark: null,
      created: today,             // день создания — он тратит слот дня
    };
    setHabits(prev => [...prev, habit]);
    setDraft("");
  }

  // Отметка «сделано сегодня»: +1 к серии (или −1 при снятии отметки)
  function markToday(id: string) {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      if (h.lastMark === today) {
        // Уже отмечено сегодня → снимаем отметку (steak назад, честный откат)
        return { ...h, streak: Math.max(0, h.streak - 1), lastMark: null };
      }
      // Не отмечено: если вчерашний день пропущен — серия начинается заново
      const alive = isAlive(h, today);
      const base = alive ? h.streak : 0;
      return { ...h, streak: Math.min(base + 1, h.target), lastMark: today };
    }));
  }

  // Удаление привычки. Слот дня НЕ возвращается: лимит честный.
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

      {/* Шапка: название + живой счётчик «создано / лимит» */}
      <div className="hb-head">
        <h2 className="hb-title">🔥 Привычки</h2>
        <span className="hb-counter" title={`Можно создавать не более ${MAX_PER_DAY} привычек в день`}>
          сегодня {todays.length}/{MAX_PER_DAY}
        </span>
      </div>

      {/* Плашки-предупреждения: просроченные отметки и оборванные серии */}
      {dueToday.length > 0 && (
        <div className="hb-overdue">⏰ Не отмечено сегодня: {dueToday.length}</div>
      )}
      {broken.length > 0 && (
        <div className="hb-overdue">💔 Пропущен день — серия обнулилась: {broken.length}</div>
      )}

      {/* Список привычек: flex:1 тянет зону на всю рабочую область */}
      <div className="hb-list">
        {habits.length === 0 && (
          <div className="hb-empty">
            <span className="big">🌱</span>
            Пока нет ни одной привычки.<br />
            Придумай первую — можно создавать не более {MAX_PER_DAY} в день!
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
                  {/* Награда: сколько 💎 принесла серия (каждые 7 дней +3💎) */}
                  <span className="hb-reward">💎 {earnedGems(h)}</span>
                  {complete && <span>🏆 Серия закрыта!</span>}
                </div>
              </div>

              {/* Круглая кнопка отметки дня: ✔ = сегодня закрыто */}
              <button
                type="button"
                className={"hb-mark" + (markedToday ? " on" : "")}
                title={markedToday ? "Снять отметку за сегодня" : "Отметить: сделано сегодня"}
                onClick={() => markToday(h.id)}
              >✔</button>

              {/* Крестик: удалить можно только привычку, созданную сегодня */}
              {h.created === today && !markedToday && (
                <button
                  type="button"
                  className="hb-del"
                  title="Удалить привычку"
                  onClick={() => deleteHabit(h.id)}
                >✕</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Баннер идеального дня: все сегодняшние отметки закрыты */}
      {perfectDay && habits.length > 0 && dueToday.length === 0 && (
        <div className="hb-perfect">🌟 Все отметки на сегодня закрыты! +{PERFECT_BONUS} 💎</div>
      )}

      {/* ══ ПАНЕЛЬ СОЗДАНИЯ: тот самый «плюсик» ══ */}
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
          disabled={leftToday === 0}          /* исчерпан лимит — поле неактивно */
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addHabit(); }} /* Enter = добавить */
        />
        {/* ГЛАВНЫЙ «ПЛЮСИК»: большая зелёная кнопка добавления */}
        <button
          type="button"
          className="hb-add"
          title={leftToday === 0 ? "Лимит 3 привычки на сегодня исчерпан" : "Добавить привычку"}
          onClick={addHabit}
          disabled={leftToday === 0 || draft.trim() === ""}
        >+</button>
      </div>

      {/* Выбор цикла серии: 7 / 14 / 21 день — как в описании дизайна */}
      <div className="hb-form" style={{ marginTop: 8 }}>
        {[7, 14, 21].map(t => (
          <button
            key={t}
            type="button"
            className="hb-pick"
            style={{
              width: "auto",
              padding: "0 14px",
              fontSize: 14,
              fontWeight: 900,
              borderColor: target === t ? "var(--green)" : "var(--cream3)",
              background: target === t ? "var(--green-soft)" : "#FFFBEE",
            }}
            title={`Серия на ${t} дней`}
            onClick={() => setTarget(t)}
          >{t} дн.</button>
        ))}
      </div>

      {/* Подсказка: меняет текст в зависимости от ситуации с лимитом */}
      <div className="hb-hint">
        {leftToday === 0
          ? `Лимит ${MAX_PER_DAY} привычек на сегодня исчерпан. Новые появятся завтра.`
          : `За каждые ${STREAK_STEP} дней серии — +${GEMS_PER_STEP} 💎, за идеальный день — +${PERFECT_BONUS} 💎. Ещё можно создать сегодня: ${leftToday}.`}
      </div>
    </div>
  );
}
