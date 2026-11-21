// ============================================================================
// wallet.ts — кошелёк кристаллов 💎, привязанный к аккаунту Telegram.
//
// ПРАВИЛА (новая концепция):
//   • Стартовый баланс каждого пользователя — 0 кристаллов.
//   • Выполнена цель из «призовой зоны»        -> +3 💎 (REWARD_GEMS).
//   • Просроченная цель закрыта с опозданием   -> +1 💎 (LATE_REWARD_GEMS).
//   • Награда выдаётся ОДИН РАЗ: id цели попадает в список paid.
//     Сняли галочку и поставили снова — деньги НЕ начисляются повторно.
//   • Идеальный день (все сегодняшние цели закрыты) -> +5 💎, тоже один раз
//     за день (дата хранится в perfectDays).
//
// ХРАНЕНИЕ: через lib/storage — данные лежат в localStorage под персональным
// ключом "mb-wallet-v1:tg-<id>" и дублируются в облако Telegram.
// Каждый аккаунт видит ТОЛЬКО свой баланс.
// ============================================================================

import { loadJSON, saveJSON } from "./storage";
import { addRating, RATING_GOAL_REWARD, RATING_GOAL_LATE, RATING_HABIT_DAY, RATING_HABIT_SERIES } from "./rating";

const WALLET_KEY = "mb-wallet-v1"; // базовое имя ключа (к нему приклеивается id TG)

export type Wallet = {
  gems: number;
  paid: string[];
};

// Пустой кошелёк нового пользователя: 0 кристаллов
const EMPTY: Wallet = { gems: 0, paid: [] };

// Читаем кошелёк из хранилища; если данных нет — новый пользователь, 0 💎
export function loadWallet(): Wallet {
  const parsed = loadJSON<Wallet>(WALLET_KEY);
  if (!parsed || typeof parsed.gems !== "number") return { ...EMPTY, paid: [] };
  return {
    gems: Math.max(0, parsed.gems),          // защита: баланс не может быть отрицательным
    paid: Array.isArray(parsed.paid) ? parsed.paid : []
  };
}

// Сохраняем кошелёк (localStorage + облако Telegram — делает lib/storage)
export function saveWallet(w: Wallet): void {
  saveJSON(WALLET_KEY, w);
}

/* ============================================================================
   СОБЫТИЙНАЯ ШИНА — как баланс попадает в шапку приложения.

   Проблема: кошелёк меняет страница «Цели» (Goals.tsx), а показывает его
   шапка (App.tsx). Это разные компоненты. Чтобы не тащить состояние через
   кучу props, используем простой подписчик-слушатель:

   • Goals вызывает addGems(3, "цель") — это:
       1) читает кошелёк, увеличивает gems, сохраняет;
       2) рассылает новое число всем слушателям.
   • App.tsx при загрузке подписывается через onWalletChange() и перерисовывает
     пилюлю 💎 в шапке. Плюс слушаем нативное событие "storage" — так баланс
     обновится даже в другой вкладке браузера.
   ========================================================================== */

type Listener = (gems: number) => void;
const listeners = new Set<Listener>(); // набор подписчиков (шапка, профиль...)

// Подписаться на изменения баланса. Возвращает функцию «отписаться».
export function onWalletChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Разослать текущий баланс всем подписчикам
function emit(gems: number): void {
  listeners.forEach(fn => fn(gems));
}

/* ГЛАВНАЯ ФУНКЦИЯ НАЧИСЛЕНИЯ: начислить n кристаллов и оповестить интерфейс. */
export function addGems(amount: number, reason = ""): void {
  const w = loadWallet();                 // всегда читаем свежие данные аккаунта
  w.gems = Math.max(0, w.gems + amount);  // защита от ухода в минус
  saveWallet(w);                          // localStorage + облако TG
  console.log(`[wallet] ${amount >= 0 ? "+" : ""}${amount} 💎 (${reason}) → баланс ${w.gems}`);
  emit(w.gems);                           // шапка узнаёт о новом балансе
  bumpRating(amount, reason);             // рейтинг растёт вместе с наградами
}

/* РЕЙТИНГ ⭐ — динамичная «звёздочка» бистро (см. lib/rating.ts).
   Определяем тип события по тексту причины и меняем рейтинг:
     • призовая цель (+3 💎)            -> +0.2
     • просроченная цель (+1 💎)        -> +0.1
     • день привычки (+2 💎 / −2 💎)    -> +0.1 / −0.1
     • серия привычки (+5/+10/+15 💎)   -> +0.5
     • прочее (покупки в магазине и т.п.)-> рейтинг не меняется */
function bumpRating(amount: number, reason: string): void {
  if (amount === 0) return;
  let delta = 0;
  if (reason.startsWith("цель")) {
    delta = amount >= RATING_GOAL_REWARD * 10 ? RATING_GOAL_REWARD : RATING_GOAL_LATE;
  } else if (reason.startsWith("просроченная цель")) {
    delta = RATING_GOAL_LATE;
  } else if (reason.startsWith("серия")) {
    delta = amount > 0 ? RATING_HABIT_SERIES : -RATING_HABIT_SERIES;
  } else if (reason.startsWith("день привычки") || reason.startsWith("отмена дня")) {
    delta = amount > 0 ? RATING_HABIT_DAY : -RATING_HABIT_DAY;
  }
  if (delta !== 0) addRating(delta, reason);
}





/* Отметить цель как «оплаченную». Вызывается в момент ПЕРВОГО выполнения.
   Если id уже в списке paid — возвращаем false: награду выдавать нельзя
   (защита от «снял галочку → поставил снова»). */
export function markGoalPaid(goalId: string): boolean {
  const w = loadWallet();
  if (w.paid.includes(goalId)) return false; // ⛔ повторная награда запрещена
  w.paid.push(goalId);
  saveWallet(w);
  return true; // ✅ можно начислять
}