import { useState } from 'react'
import type { ReactElement } from 'react'
import TopBar from './components/TopBar'
import TabBar from './components/TabBar'
import Restaurant from './pages/Restaurant'
import Habits from './pages/Habits'
import Goals from './pages/Goals'
import Shop from './pages/Shop'
import Profile from './pages/Profile'

export type Tab = 'restaurant' | 'habits' | 'goals' | 'shop' | 'profile'

export default function App() {
  const [tab, setTab] = useState<Tab>('restaurant')

  const pages: Record<Tab, ReactElement> = {
    restaurant: <Restaurant />,
    habits:     <Habits />,
    goals:      <Goals />,
    shop:       <Shop />,
    profile:    <Profile />,
  }

  return (
    <div className="app">
      <TopBar />
      <main className="page">
        {pages[tab]}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}

