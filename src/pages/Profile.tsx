/* ============================================================
   Profile.tsx — страница «Профиль»: достижения 🏆.

   Правила:
   • Пока два достижения: первая выполненная цель и первая
     выполненная привычка; за каждое игрок получает 5 💎.
   • Выдаёт их автоматически lib/achievements.ts (в моментах
     выполнения целей/привычек); здесь мы только показываем статус.
   • Статус хранится под персональным ключом аккаунта Telegram,
     поэтому виден на любом устройстве того же аккаунта.
   ============================================================ */

import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  ACH_GEMS,
  loadAchievements,
  onAchievementsChange,
} from "../lib/achievements";
import "./Profile.css";

export default function Profile() {
  const [unlocked, setUnlocked] = useState<string[]>(() => loadAchievements());

  // Мгновенно реагируем на новые достижения (событийная шина)
  useEffect(() => onAchievementsChange(setUnlocked), []);

  return (
    <div className="pf-page">
      <h2 className="pf-title">🏆 Достижения</h2>
      <p className="pf-sub">
        Выполняй цели и привычки — награда {ACH_GEMS} 💎 за каждое.
      </p>

      <div className="pf-list">
        {ACHIEVEMENTS.map(a => {
          const done = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`pf-card${done ? " done" : ""}`}>
              <span className="pf-emoji">{a.emoji}</span>
              <div className="pf-mid">
                <span className="pf-name">{a.title}</span>
                <span className="pf-desc">{a.desc}</span>
              </div>
              <span className="pf-reward">💎{ACH_GEMS}</span>
              <span className="pf-state">{done ? "✔" : "🔒"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
