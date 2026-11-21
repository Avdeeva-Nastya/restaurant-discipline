// ============================================================================
// achievements.ts — достижения профиля 🏆, привязанные к аккаунту Telegram.
//
// ПРАВИЛА:
//   • Достижение выдаётся ОДИН РАЗ, автоматически, когда событие произошло.
//   • За каждое закрытое достижение игрок получает ACH_GEMS кристаллов.
//   • Факт хранения идёт в персональный ключ "mb-achievements-v1:tg-<id>"
//     (localStorage + облако Telegram через lib/storage).
// ============================================================================

import { loadJSON, saveJSON } from "./storage";
import { loadWallet, saveWallet } from "./wallet";

const ACH_KEY = "mb-achievements-v1"; // базовое имя ключа (приклеивается id TG)

export const ACH_GEMS = 5; // награда за каждое достижение

export type AchievementDef = {
  id: string;
  title: string;
  desc: string;
  emoji: string;
};

/* Пока два достижения: первая выполненная цель и первая выполненная привычка */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-goal",    title: "Первая цель",      desc: "Выполни первую задачу дня",  emoji: "🎯" },
  { id: "first-habit",   title: "Первая привычка",  desc: "Отметь первый день привычки", emoji: "🌱" },
];

type AchStore = { unlocked: string[] };

export function loadAchievements(): string[] {
  const parsed = loadJSON<AchStore>(ACH_KEY);
  return Array.isArray(parsed?.unlocked) ? parsed!.unlocked : [];
}

/* СОБЫТИЙНАЯ ШИНА — профиль мгновенно узнаёт о новом достижении. */
type Listener = (unlocked: string[]) => void;
const listeners = new Set<Listener>();

export function onAchievementsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(unlocked: string[]): void {
  listeners.forEach(fn => fn(unlocked));
}

/* ГЛАВНАЯ ФУНКЦИЯ: засчитать достижение. Возвращает true, если открыто впервые. */
export function unlockAchievement(id: string): boolean {
  const unlocked = loadAchievements();
  if (unlocked.includes(id)) return false; // уже получен — награду не дублируем

  unlocked.push(id);
  saveJSON(ACH_KEY, { unlocked } satisfies AchStore);

  // Начисляем 5 💎 напрямую в кошелёк (без addGems — это не награда цели/привычки)
  const w = loadWallet();
  w.gems = Math.max(0, w.gems + ACH_GEMS);
  saveWallet(w);

  console.log(`[achievements] Открыто достижение «${id}» → +${ACH_GEMS} 💎`);
  emit(unlocked);
  return true;
}