import './Restaurant.css'

/**
 * Страница «Ресторан».
 * Вся страница поделена ровно на две части (паттерны пользователя
 * из изображения_2026-11-22_171551594.png):
 *   ВЕРХНЯЯ ПОЛОВИНА — деревянный пол (floor-wood.png)
 *   НИЖНЯЯ ПОЛОВИНА  — плитка (floor-tile.png)
 * Каждый паттерн замощает свою половину целиком, без полос.
 */
export default function Restaurant() {
  return (
    <div className="rs-wrap">
      <div className="rs-scene">
        {/* Верхняя половина страницы — дерево */}
        <div className="floor-half floor-half--wood">
          <span className="zone-label">Зал</span>
        </div>

        {/* Нижняя половина страницы — плитка */}
        <div className="floor-half floor-half--tile">
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
