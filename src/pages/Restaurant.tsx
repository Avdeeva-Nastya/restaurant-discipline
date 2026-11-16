export default function Restaurant() {
  return (
    <div className="restaurant-scene">

      {/* Изометрический зал */}
      <div className="iso-world">

        {/* Пол */}
        <div className="floor">
          {Array.from({ length: 49 }).map((_, i) => (
            <div
              key={i}
              className={`floor-tile ${(Math.floor(i / 7) + i) % 2 === 0 ? 'light' : 'dark'}`}
            />
          ))}
        </div>

        {/* Прилавок — верхняя зона */}
        <div className="counter">
          <div className="station" title="Лапша БП">🍜</div>
          <div className="station" style={{ opacity: 0.35, filter: 'grayscale(1)' }}>🍲</div>
          <div className="station" style={{ opacity: 0.35, filter: 'grayscale(1)' }}>🥩</div>
          <div className="station" style={{ opacity: 0.35, filter: 'grayscale(1)' }}>🥘</div>
        </div>

        {/* Столики */}
        {/* Столик 1 */}
        <div className="table" style={{ left: 30, top: 90 }}>
          <div className="chair" style={{ top: -10, left: 10 }} />
          <div className="chair" style={{ top: -10, left: 36 }} />
          <div className="chair" style={{ bottom: -10, left: 10 }} />
          <div className="chair" style={{ bottom: -10, left: 36 }} />
        </div>

        {/* Столик 2 */}
        <div className="table" style={{ left: 110, top: 90 }}>
          <div className="chair" style={{ top: -10, left: 10 }} />
          <div className="chair" style={{ top: -10, left: 36 }} />
          <div className="chair" style={{ bottom: -10, left: 10 }} />
          <div className="chair" style={{ bottom: -10, left: 36 }} />
        </div>

        {/* Столик 3 — ещё закрыт */}
        <div className="table" style={{ left: 190, top: 90, opacity: 0.3 }}>
          <div className="chair" style={{ top: -10, left: 10 }} />
          <div className="chair" style={{ top: -10, left: 36 }} />
        </div>

        {/* Работник-повар */}
        <div className="character" style={{ left: 68, top: 68 }}>
          <div className="body">👨‍🍳</div>
        </div>

        {/* Гость 1 — ждёт заказ */}
        <div className="character" style={{ left: 36, top: 108 }}>
          <div className="speech-bubble">🍜</div>
          <div className="body">🧑</div>
        </div>

        {/* Гость 2 — ест */}
        <div className="character" style={{ left: 120, top: 108 }}>
          <div className="speech-bubble">😋</div>
          <div className="body">👩</div>
        </div>

        {/* Гость 3 — подходит */}
        <div className="character" style={{ left: 150, top: 200 }}>
          <div className="body">🧔</div>
        </div>
      </div>

      {/* Плашка рейтинга */}
      <div className="rating-bar">
        ⭐ 1.0 &nbsp;·&nbsp; 👥 2 гостя &nbsp;·&nbsp; 🪙 +10 сейчас
      </div>

    </div>
  )
}
