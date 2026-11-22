import './Restaurant.css'

/**
 * Страница «Ресторан».
 * Пол зала заполнен паттернами пользователя (изображение_2026-11-22_171551594.png):
 * снизу — плитка, сверху — дерево. См. .hall-floor в Restaurant.css.
 */
export default function Restaurant() {
  return (
    <div className="rs-wrap">
      <div className="rs-scene">
        {/* ЗАЛ: пол = дерево сверху + плитка снизу (CSS-паттерны) */}
        <div className="zone-hall">
          <span className="zone-label">Зал</span>
        </div>

        {/* разделитель-стена */}
        <div className="divider">
          <div className="divider-window">
            <span className="divider-window-icon">🍳</span>
          </div>
        </div>

        {/* КУХНЯ: пол = плитка */}
        <div className="zone-kitchen">
          <div className="kitchen-floor" />
          <span className="zone-label">Кухня</span>
        </div>
      </div>

      <div className="rs-bottom">
        <p className="rs-hint">
          Здесь скоро оживёт ваш ресторан для котов 🐈
        </p>
      </div>
    </div>
  )
}
