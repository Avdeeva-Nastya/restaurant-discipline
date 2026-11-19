/* ============================================================
   Goals.tsx — «Цели дня»: рабочие TODO в стиле макета.

   Что умеет страница (и как это устроено):
   1. Создавать цели — НЕ БОЛЕЕ 3 ЗА ДЕНЬ (лимит MAX_PER_DAY).
      Счётчик целей привязан к дате создания, а не к текущему
      списку: удалил цель — слот дня всё равно занят.
   2. Отмечать выполнение кликом по карточке (галочка).
   3. Удалять ещё невыполненную цель (крестик).
   4. Всё хранится в localStorage — после перезагрузки страницы
      цели и счётчик дня остаются на месте.
   5. Вчерашние невыполненные цели помечаются «просрочено».

   Награды (по описанию из макета): за каждую выполненную цель
   игрок зарабатывает валюту; когда закрыты ВСЕ цели, созданные
   сегодня, появляется баннер идеального дня (+5 💎).
   ЯКОРЬ: здесь позже подключится реальный кошелёк игры
   (монеты/кристаллы из App.tsx) — сейчас награды показаны
   на карточках как в дизайне.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import "./Goals.css";
// «Умное хранилище» с привязкой к аккаунту Telegram (см. src/lib/storage.ts)
import { loadJSON, saveJSON } from "../lib/storage";

/* ---------- Правила игры (константы) ---------- */
const MAX_PER_DAY = 3;    // максимум НОВЫХ целей за один день
// ⚠️ ВАЖНО: это константа КОДА, она влияет только на НОВЫЕ цели.
// Уже созданные цели хранят свою награду в localStorage (поле reward),
// поэтому изменение константы не меняет старые карточки на странице.
const REWARD_GEMS = 3;    // дизайн: 3 💎 за каждую новую выполненную цель
const LATE_REWARD_GEMS = 1; // просроченную цель можно закрыть с опозданием — но награда меньше: 1 💎
const PERFECT_BONUS = 5;  // дизайн: +5 💎 за идеальный день
const MAX_LEN = 80;       // защита: длина одной цели не больше 80 символов

/* ---------- Тип «цель» ----------
   date     — день создания 'ГГГГ-ММ-ДД' (по нему считаем лимит),
   done     — выполнена ли,
   reward   — награда, зафиксирована при создании. */
type Goal = {
  id: string;
  text: string;
  date: string;
  done: boolean;
  reward: number;
};

/* Хелпер: сегодняшняя дата в виде 'ГГГГ-ММ-ДД'.
   Локальная дата (не UTC!), чтобы «день» совпадал с днём игрока. */
function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* Ключ хранилища. Версия v1 — если правила изменятся,
   сможем поднять версию и аккуратно сбросить старые данные.
   ВАЖНО: теперь через lib/storage этот ключ автоматически привязывается
   к аккаунту Telegram (реальное имя ключа = "mb-goals-v1:tg-<id>"). */
const STORAGE_KEY = "mb-goals-v1";

/* Читаем цели из нашего «умного хранилища» (localStorage + облако TG).
   Если данных нет или они битые — отдаём пустой список
   (игра не должна падать из-за хранилища). */
function loadGoals(): Goal[] {
  const parsed = loadJSON<Goal[]>(STORAGE_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export default function Goals() {
  /* ---------- СОСТОЯНИЯ (useState) ---------- */
  // Все цели всех дней (сегодняшние + вчерашние просроченные)
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  // Текст, который игрок набрал в поле, но ещё не добавил
  const [draft, setDraft] = useState("");

  /* ---------- СОХРАНЕНИЕ ----------
   Каждый раз, когда список целей меняется, пишем его в «умное хранилище»:
   мгновенная копия в localStorage + облачная копия в Telegram Cloud Storage.
   Так данные переживают перезагрузку, чистку кэша и смену устройства —
   и принадлежат именно текущему аккаунту TG. */
  useEffect(() => {
    saveJSON(STORAGE_KEY, goals);
  }, [goals]);

  /* ---------- СИНХРОНИЗАЦИЯ НАГРАДЫ С КОДОМ ----------
   Старые цели хранят reward в localStorage, поэтому при изменении
   константы REWARD_GEMS в коде они продолжали показывать старое число.
   Этот эффект запускается ОДИН раз при загрузке страницы и обновляет
   reward у невыполненных сегодняшних целей до актуальной константы.
   Выполненные цели не трогаем — их награда уже «выплачена» и зафиксирована. */
  useEffect(() => {
    setGoals(prev => {
      const t = todayStr();
      let changed = false;
      const next = prev.map(g => {
        if (!g.done && g.date === t && g.reward !== REWARD_GEMS) {
          changed = true;
          return { ...g, reward: REWARD_GEMS }; // подтягиваем новую награду из кода
        }
        return g;
      });
      return changed ? next : prev; // если менять нечего — оставляем тот же массив
    });
  }, []); // пустой список зависимостей = только при первом рендере

  /* ---------- ВЫЧИСЛЯЕМЫЕ ВЕЛИЧИНЫ (useMemo) ----------
   Это не новые данные, а «производные» от goals: пересчитываются
   автоматически, когда goals меняются. */

  const today = todayStr();

  // Цели, созданные сегодня — по ним считаем дневной лимит
  const todays = useMemo(() => goals.filter(g => g.date === today), [goals, today]);
  // Просроченные: созданы раньше сегодня и так и не отмечены выполненными
  const overdue = useMemo(() => goals.filter(g => g.date !== today && !g.done), [goals, today]);

  // Сколько новых целей ОСТАЛОСЬ создать сегодня (не может быть < 0)
  const leftToday = Math.max(0, MAX_PER_DAY - todays.length);

  // Идеальный день: сегодня есть хотя бы одна цель И все сегодняшние выполнены
  const perfectDay = todays.length > 0 && todays.every(g => g.done);

  /* ---------- ДЕЙСТВИЯ (обработчики) ---------- */

  // Добавление цели: проверяем лимит и длину, затем дописываем в список
  function addGoal() {
    const text = draft.trim();          // срезаем пробелы по краям
    if (!text) return;                  // пустую цель не создаём
    if (leftToday <= 0) return;         // 🔒 главный фильтр: не более 3 за день
    const goal: Goal = {
      id: crypto.randomUUID(),          // уникальные id без внешних библиотек
      text: text.slice(0, MAX_LEN),     // защита от «простыни» текста
      date: today,                      // фиксируем день создания — он и тратит слот
      done: false,
      reward: REWARD_GEMS,
    };
    setGoals(prev => [...prev, goal]);  // обновляем список через предыдущее значение
    setDraft("");                       // очищаем поле ввода
  }

  // Переключение галочки: кликнули по карточке — цель выполнилась (или снялась)
  function toggleGoal(id: string) {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  // Выполнение ПРОСРОЧЕННОЙ цели с опозданием:
  // отмечаем done=true И понижаем награду до LATE_REWARD_GEMS (1 💎 вместо 2 💎).
  // После этого цель уходит из списка overdue (фильтр "!g.done") и
  // больше не светится оранжевым — игрок честно закрыл «хвост».
  function completeLate(id: string) {
    setGoals(prev => prev.map(g =>
      g.id === id ? { ...g, done: true, reward: LATE_REWARD_GEMS } : g
    ));
  }

  // Удаление ЦЕЛИ ИЗ СПИСКА (кнопка-корзина у просроченных):
  // в отличие от deleteGoal здесь удаляем цель полностью, даже невыполненную —
  // это осознанный выбор игрока («не хочу её», награды нет).
  // ВАЖНО: слот сегодняшнего дня не тратится, т.к. цель создана вчера.
  function removeGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  // Удаление цели. Выполненные не удаляем — иначе можно «переиграть» награду.
  // Слот дня при удалении НЕ возвращается: лимит «3 создания за день» честный.
  function deleteGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id || g.done));
  }

  /* ---------- РАЗМЕТКА ---------- */
  return (
    <div className="gl-wrap">

      {/* Шапка: название + живой счётчик «создано / лимит» */}
      <div className="gl-head">
        <h2 className="gl-title">✅ Цели дня</h2>
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
            {/* Награда — золотая «монетка» справа; цель кликабельна целиком */}
            <span className="gl-reward">💎{g.reward}</span>
            {/* Крестик: stopPropagation — клик по нему НЕ должен включать галочку */}
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

        {/* Вчерашние незакрытые цели — помечены состоянием «late».
            Теперь они тоже интерактивные: можно выполнить с опозданием
            (галочка, награда 1 💎) или удалить совсем (крестик). */}
        {overdue.map(g => (
          <div key={g.id} className="gl-card late" title="Цель из прошлого дня">
            <span className="gl-check">!</span>
            <span className="gl-text">{g.text}</span>
            {/* Награда у просроченных сразу показываем уменьшенную: 1 💎 */}
            <span className="gl-reward">💎{LATE_REWARD_GEMS}</span>
            {/* Кнопка «выполнить с опозданием»: done=true + reward=1 💎 */}
            <button
              type="button"
              className="gl-mark-late"
              title={`Выполнить с опозданием (+${LATE_REWARD_GEMS} 💎)`}
              onClick={() => completeLate(g.id)}
            >✔</button>
            {/* Кнопка «удалить навсегда»: цель просто исчезает из списка */}
            <button
              type="button"
              className="gl-del"
              title="Удалить просроченную цель"
              onClick={() => removeGoal(g.id)}
            >✕</button>
          </div>
        ))}
      </div>

      {/* Баннер идеального дня: все сегодняшние цели выполнены */}
      {perfectDay && (
        <div className="gl-perfect">🌟 Идеальный день! +{PERFECT_BONUS} 💎</div>
      )}

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

      {/* Подсказка под формой: меняет текст в зависимости от ситуации */}
      <div className="gl-hint">
        {leftToday === 0
          ? `Лимит ${MAX_PER_DAY} целей на сегодня исчерпан. Новые появятся завтра.`
          : `За каждую цель — ${REWARD_GEMS} 💎, за идеальный день — +${PERFECT_BONUS} 💎. Осталось целей сегодня: ${leftToday}.`}
      </div>
    </div>
  );
}
