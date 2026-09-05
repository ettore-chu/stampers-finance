import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import Login from './components/Login'
import LoanLedger from './components/LoanLedger'
import CapitalDashboard from './components/CapitalDashboard'
import CostMonitor from './components/CostMonitor'
import NolTracker from './components/NolTracker'
import JournalLedger from './components/JournalLedger'
import ReceiptVault from './components/ReceiptVault'

const TABS = [
  { key: 'capital', label: '자본잠식·런웨이' },
  { key: 'journal', label: '분개장' },
  { key: 'receipts', label: '영수증함' },
  { key: 'loans', label: '차입금 원장' },
  { key: 'cost', label: '원가율 모니터' },
  { key: 'nol', label: '결손금·손익분기' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function App() {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')
  const [tab, setTab] = useState<TabKey>('capital')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === 'loading') return <div className="empty-note">불러오는 중…</div>
  if (!session) return <Login />

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--line-strong)' }}>
        <div>
          <p style={{ fontSize: 11.5, letterSpacing: '.08em', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 6px' }}>
            주식회사 스탬퍼스
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>재무 콘솔</h1>
        </div>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          로그아웃
        </button>
      </header>

      <nav style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className="btn"
            onClick={() => setTab(t.key)}
            style={tab === t.key ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--paper-raised)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'capital' && <CapitalDashboard />}
        {tab === 'journal' && <JournalLedger />}
        {tab === 'receipts' && <ReceiptVault />}
        {tab === 'loans' && <LoanLedger />}
        {tab === 'cost' && <CostMonitor />}
        {tab === 'nol' && <NolTracker />}
      </main>
    </div>
  )
}
