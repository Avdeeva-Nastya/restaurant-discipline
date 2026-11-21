// ============================================================================
// rating.ts — рейтинг бистро ⭐, привязанный к аккаунту Telegram.
//
// ПРАВИЛА (новая концепция):
//   • Стартовый рейтинг каждого пользователя — 0.0.
//   • Пока рейтинг — ПРОСТАЯ ПЕРЕМЕННАЯ: никакие события (цели, привычки,
//     покупки) его НЕ меняют. Правила начисления появятся позже.
//   • Значение сохраняется при каждом изменении (localStorage + облако TG).
//
// ХРАНЕНИЕ: персональный ключ "mb-rating-v1:tg-<id>" — каждый аккаунт
// видит только свой рейтинг.
// ============================================================================

import { loadJSON, saveJSON } from "./storage";

const RATING_KEY = "mb-rating-v1"; // базовое имя ключа (к нему приклеивается id TG)

type RatingStore = { rating: number };

// Читаем рейтинг из хранилища; если данных нет — новый пользователь, 0.0
export function loadRating(): number {
  const parsed = loadJSON<RatingStore>(RATING_KEY);
  if (!parsed || typeof parsed.rating !== "number") return 0;
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
}

// Округление до десятых (иначе 0.1+0.2 = 0.30000000000000004)
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// Красивый вывод: всегда одна цифра после точки — «0.0», «1.3», «12.0»
export function formatRating(r: number): string {
  return r.toFixed(1);
}

/* СОБЫТИЙНАЯ ШИНА рейтинга — как в wallet.ts, чтобы плашка ⭐
   обновлялась сразу после setRating(). */
type RatingListener = (rating: number) => void;
const ratingListeners = new Set<RatingListener>();

export function onRatingChange(fn: RatingListener): () => void {
  ratingListeners.add(fn);
  return () => ratingListeners.delete(fn);
}

function emitRating(rating: number): void {
  ratingListeners.forEach(fn => fn(rating));
}