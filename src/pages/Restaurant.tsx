import { useState } from 'react'
import './Restaurant.css'

interface Guest {
  id: number
  x: number
  y: number
  bubble: string
  emoji: string
}

const GUESTS: Guest[] = [
  { id: 1, x: 18, y: 42, bubble: '🍜', emoji: '🧑' },
  { id: 2, x: 52, y: 38, bubble: '😋', emoji: '👩' },
  { id: 3, x: 72, y: 55, bubble: '🍜', emoji: '🧔' },
]

export default function Restaurant() {
  const [served, setServed] = useState(0)

  return (
    <div className="rs-wrap">

      {/* ── Верхняя панель ── */}
      <div className="rs-info-row">
        <div className="rs-badge">⭐ 1.0</div>
        <div className="rs-badge">👥 {GUESTS.length} гостя</div>
        <div className="rs-badge gold">🪙 +{served * 10}</div>
      </div>

      {/* ── Изометрическая сцена ── */}
      <div className="rs-scene">
        <div className="iso-stage">

          {/* Пол — шахматная плитка */}
          <div className="iso-floor">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className={`iso-tile ${(Math.floor(i / 8) + i) % 2 === 0 ? 't-a' : 't-b'}`} />
            ))}
          </div>

          {/* Прилавок */}
          <div className="iso-counter">
            <div className="iso-station active" title="Лапша БП">
              <span className="station-icon">🍜</span>
              <span className="station-label">Лапша</span>
            </div>
            <div className="iso-station locked" title="Откроется на ур. 3">
              <span className="station-icon">🔒</span>
              <span className="station-label">Суп</span>
            </div>
            <div className="iso-station locked" title="Откроется на ур. 5">
              <span className="station-icon">🔒</span>
              <span className="station-label">Гриль</span>
            </div>
          </div>

          {/* Повар */}
          <div className="iso-char chef">
            <div className="char-body">👨‍🍳</div>
          </div>

          {/* Столики */}
          <div className="iso-table" style={{ left: '8%', top: '54%' }}>
            <div className="table-top" />
            <div className="table-chairs">
              <span>🪑</span><span>🪑</span>
            </div>
          </div>
          <div className="iso-table" style={{ left: '42%', top: '54%' }}>
            <div className="table-top" />
            <div className="table-chairs">
              <span>🪑</span><span>🪑</span>
            </div>
          </div>
          <div className="iso-table locked-table" style={{ left: '72%', top: '54%' }}>
            <div className="table-top" />
            <div className="table-label">🔒</div>
          </div>

          {/* Гости с пузырями */}
          {GUESTS.map(g => (
            <div
              key={g.id}
              className="iso-guest"
              style={{ left: `${g.x}%`, top: `${g.y}%` }}
              onClick={() => setServed(s => s + 1)}
            >
              <div className="guest-bubble">{g.bubble}</div>
              <div className="guest-body">{g.emoji}</div>
            </div>
          ))}

          {/* Декор — растение */}
          <div className="iso-decor" style={{ left: '88%', top: '72%' }}>🌿</div>
          <div className="iso-decor" style={{ left: '2%', top: '72%' }}>🌿</div>

        </div>
      </div>

      {/* ── Кнопка обслужить ── */}
      <div className="rs-actions">
        <button className="btn-serve" onClick={() => setServed(s => s + 1)}>
          🍜 Обслужить гостя
        </button>
        <div className="rs-hint">Нажми на гостя или кнопку</div>
      </div>

    </div>
  )
}
