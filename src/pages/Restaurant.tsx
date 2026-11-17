
import './Restaurant.css'
import coinImage from '../assets/coin.svg'; 

export default function Restaurant(){
  return (
    <div className="rs-wrap">

      {/* Верхняя статистика */}
      <div className="rs-toprow">
        <div className="rs-stat">⭐ </div>
        <div className="rs-stat">👥 </div>
        <div className="rs-stat">
          <img className='gold' src={coinImage} alt="монета" />
        </div>
        <div className="rs-stat crystal">💎 </div>
      </div>

      {/* Сцена */}
      <div className="rs-scene">

        {/* ═══ ЗАЛ (верхняя половина) ═══ */}
        <div className="zone-hall">
          <div className="zone-label">Зал</div>

          {/* Пол зала */}
          <div className="hall-floor">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className={`floor-tile ${(Math.floor(i / 10) + i) % 2 === 0 ? 'fa' : 'fb'}`} />
            ))}
          </div>
        </div>

        {/* Разделитель — стена с окошком */}
        <div className="divider">
          <div className="divider-window">
            <span className="divider-window-icon">🪟</span>
          </div>
        </div>

        {/* ═══ КУХНЯ (нижняя половина) ═══ */}
        <div className="zone-kitchen">
          <div className="zone-label">Кухня</div>

          {/* Пол кухни */}
          <div className="kitchen-floor">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className={`floor-tile kf ${(Math.floor(i / 10) + i) % 2 === 0 ? 'ka' : 'kb'}`} />
            ))}
          </div>

          {/* Рабочие поверхности */}
          <div className="worktop-row top-row">

            {/* Станция 1 — Лапша */}
            <div className="worktop active">
              <div className="worktop-counter" />
              <div className="worktop-items">
                <span>🍜</span><span>🥢</span>
              </div>
              <div className="worktop-label">Лапша</div>
            </div>

            {/* Станция 2 — Суп (заблокирована) */}
            <div className="worktop locked">
              <div className="worktop-counter" />
              <div className="worktop-items">
                <span>🔒</span>
              </div>
              <div className="worktop-label">Суп · ур.3</div>
            </div>

            {/* Станция 3 — Гриль (заблокирована) */}
            <div className="worktop locked">
              <div className="worktop-counter" />
              <div className="worktop-items">
                <span>🔒</span>
              </div>
              <div className="worktop-label">Гриль · ур.5</div>
            </div>

          </div>

          {/* Вторая рабочая поверхность — стол для сборки */}
          <div className="worktop-row bottom-row">

            {/* Стол сборки */}
            <div className="assembly-table">
              <div className="assembly-top" />
              <div className="assembly-items">
                <span>🥬</span><span>🧄</span><span>🌶️</span>
              </div>
              <div className="worktop-label">Ингредиенты</div>
            </div>

           

            {/* Мойка */}
            <div className="sink-unit">
              <div className="sink-top" />
              <div className="assembly-items"><span>🚰</span></div>
              <div className="worktop-label">Мойка</div>
            </div>

          </div>

        </div>

      </div>
    

    </div>
  )
}
