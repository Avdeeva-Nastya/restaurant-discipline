import type { Tab } from '../App'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'restaurant', icon: '🍜', label: 'Ресторан' },
  { id: 'habits',     icon: '🔥', label: 'Привычки' },
  { id: 'goals',      icon: '✅', label: 'Цели дня' },
  { id: 'shop',       icon: '💎', label: 'Магазин'  },
  { id: 'profile',    icon: '👤', label: 'Профиль'  },
]

interface Props {
  active: Tab
  onChange: (t: Tab) => void
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab-btn ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
