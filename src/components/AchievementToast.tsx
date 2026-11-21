/* ============================================================
   AchievementToast.tsx — плашка-уведомление о новом достижении 🏆.

   Как это работает:
   • Вешается один раз в App.tsx (над всеми вкладками), поэтому плашку
     видно на любой странице — и «Цели», и «Привычки».
   • Подписывается на событие saveJSON из lib/storage: когда под ключ
     достижений записывается СПИСОК, отличающийся от предыдущего,
     находим новое id и показываем карточку с анимацией.
   • Такой способ ловит достижение НЕЗАВИСИМО от того, какая страница
     его открыла (Goals / Habits / будущие страницы) — ничего больше
     менять не нужно.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { onStorageSave } from "../lib/storage";
import { ACHIEVEMENTS, ACH_GEMS, loadAchievements } from "../lib/achievements";
import "./AchievementToast.css";

const ACH_KEY = "mb-achievements-v1"; // базовое имя ключа (см. achievements.ts)
const SHOW_MS = 3200;                 // сколько плашка висит на экране

type ToastData = { id: string; title: string; desc: string; emoji: string };

export default function AchievementToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  /* Помним, какой список достижений видели последним, чтобы отличить
     «запись тех же данных» (она случается часто) от настоящего нового
     достижения. При монтировании читаем актуальный список. */
  const lastSeen = useRef<string[]>(loadAchievements());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Подписка на все записи «умного хранилища» (см. storage.ts)
    const off = onStorageSave((baseKey, value) => {
      // интересуют только записи списка достижений текущего аккаунта
      if (!baseKey.startsWith(ACH_KEY)) return;
      const unlocked: string[] =
        Array.isArray((value as { unlocked?: string[] })?.unlocked)
          ? (value as { unlocked: string[] }).unlocked
          : [];

      // новые id = те, которых не было в предыдущем списке
      const fresh = unlocked.filter(id => !lastSeen.current.includes(id));
      lastSeen.current = unlocked;
      if (!fresh.length) return;

      const def = ACHIEVEMENTS.find(a => a.id === fresh[0]);
      if (!def) return;

      setToast({ ...def });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), SHOW_MS);
    });
    return () => {
      off();
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="at-toast" role="status" key={toast.id}>
      <span className="at-emoji">{toast.emoji}</span>
      <div className="at-mid">
        <span className="at-label">Достижение получено!</span>
        <span className="at-title">{toast.title}</span>
        <span className="at-desc">{toast.desc}</span>
      </div>
      <span className="at-reward">+{ACH_GEMS} 💎</span>
    </div>
  );
}
