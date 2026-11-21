// ============================================================================
// rating.ts — рейтинг бистро ⭐, привязанный к аккаунту Telegram.
//
<<<<<<< HEAD
// ПРАВИЛА (новая концепция):
//   • Стартовый рейтинг каждого пользователя — 0.0.
//   • Пока рейтинг — ПРОСТАЯ ПЕРЕМЕННАЯ: никакие события (цели, привычки,
//     покупки) его НЕ меняют. Правила начисления появятся позже.
//   • Значение сохраняется при каждом изменении (localStorage + облако TG).
=======
// ПРАВИЛА:
//   • Стартовый рейтинг каждого пользователя — 0.0.
//   • Рейтинг динамичный: каждое изменение сразу сохраняется
//     (localStorage + облако Telegram — делает lib/storage).
//   • Выполнена цель из «призовой зоны»        -> +0.2
//   • Просроченная цель закрыта с опозданием   -> +0.1
//   • День привычки выполнен                   -> +0.1
//   • Серия привычки закрыта (7/14/21 дней)    -> +0.5
//   • Снятие отметки дня привычки откатывает и рейтинг (-0.1).
>>>>>>> f1af2975fa9b7f40336c8c264e5472925536b812
//
// ХРАНЕНИЕ: персональный ключ "mb-rating-v1:tg-<id>" — каждый аккаунт
// видит только свой рейтинг.
// ============================================================================

import { loadJSON, saveJSON } from "./storage";

const RATING_KEY = "mb-rating-v1"; // базовое имя ключа (к нему приклеивается id TG)

<<<<<<< HEAD
=======
// Прибавки к рейтингу за разные события
export const RATING_GOAL_REWARD = 0.2;   // призовая цель выполнена вовремя
export const RATING_GOAL_LATE = 0.1;     // просроченная цель закрыта с опозданием
export const RATING_HABIT_DAY = 0.1;     // один выполненный день привычки
export const RATING_HABIT_SERIES = 0.5;  // полностью закрытая серия привычки

>>>>>>> f1af2975fa9b7f40336c8c264e5472925536b812
type RatingStore = { rating: number };

// Читаем рейтинг из хранилища; если данных нет — новый пользователь, 0.0
export function loadRating(): number {
  const parsed = loadJSON<RatingStore>(RATING_KEY);
  if (!parsed || typeof parsed.rating !== "number") return 0;
<<<<<<< HEAD
  return Math.max(0, round1(parsed.rating));
}

/* Установить рейтинг и сразу сохранить. Пока это основной способ
   изменить значение — вызывается вручную (будущими правилами). */
export function setRating(value: number): void {
  const next = Math.max(0, round1(value));
  saveJSON(RATING_KEY, { rating: next });
  console.log(`[rating] рейтинг → ${formatRating(next)}`);
  emitRating(next); // шапка/профиль узнают о новом значении
}

// Изменить текущий рейтинг на дельту (пока не используется нигде)
export function addRating(amount: number): void {
  if (amount === 0) return;
  setRating(loadRating() + amount);
=======
  return Math.max(0, parsed.rating);
}

/* ГЛАВНАЯ ФУНКЦИЯ: изменить рейтинг на amount и сразу сохранить.
   Вызывается из wallet.addGems — то есть любое начисление кристаллов
   автоматически двигает и рейтинг (правила пересчёта — внутри addGems). */
export function addRating(amount: number, reason = ""): void {
  if (amount === 0) return;
  const next = Math.max(0, round1(loadRating() + amount));
  saveJSON(RATING_KEY, { rating: next });
  console.log(`[rating] ${amount >= 0 ? "+" : ""}${amount} ⭐ (${reason}) → рейтинг ${formatRating(next)}`);
  emitRating(next);                       // шапка/профиль узнают о новом рейтинге
>>>>>>> f1af2975fa9b7f40336c8c264e5472925536b812
}

// Округление до десятых (иначе 0.1+0.2 = 0.30000000000000004)
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Красивый вывод: всегда одна цифра после точки — «0.0», «1.3», «12.0»
export function formatRating(r: number): string {
  return r.toFixed(1);
}

<<<<<<< HEAD
/* СОБЫТИЙНАЯ ШИНА рейтинга — как в wallet.ts, чтобы плашка ⭐
   обновлялась сразу после setRating(). */
=======
/* СОБЫТИЙНАЯ ШИНА рейтинга — как в wallet.ts, чтобы плашка ⭐ в шапке
   обновлялась сразу после каждого выполнения цели/привычки. */
>>>>>>> f1af2975fa9b7f40336c8c264e5472925536b812
type RatingListener = (rating: number) => void;
const ratingListeners = new Set<RatingListener>();

export function onRatingChange(fn: RatingListener): () => void {
  ratingListeners.add(fn);
  return () => ratingListeners.delete(fn);
}

function emitRating(rating: number): void {
  ratingListeners.forEach(fn => fn(rating));
<<<<<<< HEAD
}
=======
}
>>>>>>> f1af2975fa9b7f40336c8c264e5472925536b812
