import { useState, useEffect, useCallback, useRef } from 'react'
import './Restaurant.css'

type GuestState = 'walking' | 'waiting' | 'eating' | 'leaving'

interface Guest {
  id: number
  emoji: string
  tableIdx: number
  state: GuestState
  orderEmoji: string
}

interface FloatingCoin {
  id: number
  x: number
  y: number
  amount: number
}

const GUEST_EMOJIS  = ['🧑','👩','👨','🧔','👱','🧕']
const ORDER_EMOJIS  = ['🍜','🍜','🍜','😋','🤤']

// Столики — в верхней зоне (зал)
const TABLES = [
  { x: 14, y: 18 },
  { x: 42, y: 14 },
  { x: 70, y: 18 },
  { x: 22, y: 36 },
  { x: 58, y: 36 },
]

let guestId = 0
let coinId  = 0

export default function Restaurant() {
  const [coins,    setCoins]    = useState(120)
  const [crystals, setCrystals] = useState(8)
  const [rating,   setRating]   = useState(1.0)
  const [guests,   setGuests]   = useState<Guest[]>([])
  const [floats,   setFloats]   = useState<FloatingCoin[]>([])
  const [chefAnim, setChefAnim] = useState(false)
  const [served,   setServed]   = useState(0)
  const occupiedRef = useRef<Set<number>>(new Set())

  const spawnGuest = useCallback(() => {
    const free = TABLES.map((_, i) => i).filter(i => !occupiedRef.current.has(i))
    if (free.length === 0) return
    const tableIdx = free[Math.floor(Math.random() * free.length)]
    occupiedRef.current.add(tableIdx)

    const g: Guest = {
      id: ++guestId,
      emoji: GUEST_EMOJIS[Math.floor(Math.random() * GUEST_EMOJIS.length)],
      tableIdx,
      state: 'walking',
      orderEmoji: ORDER_EMOJIS[Math.floor(Math.random() * ORDER_EMOJIS.length)],
    }
    setGuests(prev => [...prev, g])

    setTimeout(() => {
      setGuests(prev => prev.map(x => x.id === g.id ? { ...x, state: 'waiting' } : x))
    }, 900)
  }, [])

  const serveGuest = useCallback((g: Guest, evt: React.MouseEvent) => {
    if (g.state !== 'waiting') return

    const rect       = (evt.currentTarget as HTMLElement).getBoundingClientRect()
    const parentRect = (evt.currentTarget as HTMLElement).closest('.rs-scene')!.getBoundingClientRect()
    const fx = rect.left - parentRect.left + rect.width / 2
    const fy = rect.top  - parentRect.top

    const amount = Math.floor(Math.random() * 6) + 8
    const fc: FloatingCoin = { id: ++coinId, x: fx, y: fy, amount }
    setFloats(prev => [...prev, fc])
    setTimeout(() => setFloats(prev => prev.filter(c => c.id !== fc.id)), 900)

    setCoins(c => c + amount)
    setServed(s => s + 1)
    setChefAnim(true)
    setTimeout(() => setChefAnim(false), 600)

    setGuests(prev => prev.map(x => x.id === g.id ? { ...x, state: 'eating', orderEmoji: '😋' } : x))

    const eatTime = 3000 + Math.random() * 2000
    setTimeout(() => {
      setGuests(prev => prev.map(x => x.id === g.id ? { ...x, state: 'leaving' } : x))
      setTimeout(() => {
        setGuests(prev => prev.filter(x => x.id !== g.id))
        occupiedRef.current.delete(g.tableIdx)
      }, 800)
    }, eatTime)

    setRating(r => Math.min(5.0, parseFloat((r + 0.02).toFixed(2))))
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => { spawnGuest(); schedule() }, 4000 + Math.random() * 3000)
    }
    spawnGuest()
    schedule()
    return () => clearTimeout(timer)
  }, [spawnGuest])

  const waiting = guests.filter(g => g.state === 'waiting').length

  return (
    <div className="rs-wrap">

      {/* Верхняя статистика */}
      <div className="rs-toprow">
        <div className="rs-stat">⭐ {rating.toFixed(1)}</div>
        <div className="rs-stat">👥 {guests.length}</div>
        <div className="rs-stat gold">🪙 {coins}</div>
        <div className="rs-stat crystal">💎 {crystals}</div>
      </div>

      {/* Сцена */}
      <div className="rs-scene">

        {/* Летящие монеты */}
        {floats.map(fc => (
          <div key={fc.id} className="float-coin" style={{ left: fc.x, top: fc.y }}>
            +{fc.amount}🪙
          </div>
        ))}

        {/* ═══ ЗАЛ (верхняя половина) ═══ */}
        <div className="zone-hall">
          <div className="zone-label">Зал</div>

          {/* Пол зала */}
          <div className="hall-floor">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className={`floor-tile ${(Math.floor(i / 10) + i) % 2 === 0 ? 'fa' : 'fb'}`} />
            ))}
          </div>

          {/* Декор */}
          <div className="decor plant" style={{ left: '2%',  top: '8%' }}>🌿</div>
          <div className="decor plant" style={{ left: '88%', top: '8%' }}>🌿</div>
          <div className="decor"       style={{ left: '46%', top: '88%', fontSize: 18 }}>🚪</div>

          {/* Столики */}
          {TABLES.map((t, i) => (
            <div key={i} className="table-unit" style={{ left: `${t.x}%`, top: `${t.y}%` }}>
              <div className="table-top" />
              <div className="table-chairs">
                <div className="chair" /><div className="chair" />
              </div>
            </div>
          ))}

          {/* Гости */}
          {guests.map(g => (
            <div
              key={g.id}
              className={`guest guest--${g.state}`}
              style={{ left: `${TABLES[g.tableIdx].x}%`, top: `${TABLES[g.tableIdx].y}%` }}
              onClick={(e) => serveGuest(g, e)}
            >
              {(g.state === 'waiting' || g.state === 'eating') && (
                <div className={`guest-bubble ${g.state === 'waiting' ? 'bubble--pulse' : 'bubble--eat'}`}>
                  {g.orderEmoji}
                </div>
              )}
              <div className="guest-body">{g.emoji}</div>
            </div>
          ))}
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

            {/* Шеф */}
            <div className={`chef ${chefAnim ? 'chef--cook' : ''}`}>
              <div className="chef-bubble">👨‍🍳</div>
              <div className="chef-label">Шеф</div>
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

      {/* Нижняя подсказка */}
      <div className="rs-bottom">
        {waiting > 0
          ? <div className="rs-hint blink">👆 Нажми на гостя чтобы обслужить!</div>
          : <div className="rs-hint">Обслужено сегодня: {served} гостей</div>
        }
      </div>

    </div>
  )
}
