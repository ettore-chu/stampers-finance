import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, pct, fmtDate } from '../lib/format'
import { ledgerTotals } from '../lib/ledger'
import type { FinanceAccount, FinanceCompany, FinanceJournalLine, FinanceSnapshot } from '../lib/types'

const VB_W = 640
const VB_H = 300
const PAD_L = 56
const PAD_R = 30
const PAD_T = 26
const PAD_B = 30

function buildScale(values: number[]) {
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const topPad = span * 0.15
  const domainMax = max + topPad
  const domainMin = min - topPad
  const domainSpan = domainMax - domainMin
  const yOf = (v: number) => PAD_T + ((domainMax - v) / domainSpan) * (VB_H - PAD_T - PAD_B)
  return { yOf, zeroY: yOf(0) }
}

export default function CapitalDashboard() {
  const [company, setCompany] = useState<FinanceCompany | null>(null)
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: co, error: coErr }, { data: snaps, error: snapErr }] = await Promise.all([
      supabase.from('finance_company').select('*').maybeSingle(),
      supabase.from('finance_snapshots').select('*').order('period_end', { ascending: true }),
    ])
    if (coErr || snapErr) {
      setError((coErr ?? snapErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    setCompany(co)
    setSnapshots(snaps ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>
  if (!company) return <p className="empty-note">finance_company 레코드가 없습니다. 먼저 회사 기본정보를 등록하세요.</p>

  const latest = snapshots[snapshots.length - 1]
  const erosionPct = latest ? ((company.capital_stock - latest.total_equity) / company.capital_stock) * 100 : null
  const monthlyBurn = latest && latest.net_income < 0 ? Math.abs(latest.net_income) / 12 : 0
  const runwayMonths = latest && monthlyBurn > 0 ? latest.cash_balance / monthlyBurn : null

  const { yOf, zeroY } = snapshots.length ? buildScale(snapshots.map((s) => s.total_equity)) : { yOf: () => 0, zeroY: 0 }
  const stepX = snapshots.length > 1 ? (VB_W - PAD_L - PAD_R) / (snapshots.length - 1) : 0
  const points = snapshots.map((s, i) => ({ x: PAD_L + stepX * i, y: yOf(s.total_equity), s }))
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>자본금</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{won(company.capital_stock)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>최근 자본총계</div>
          <div className={`mono ${latest && latest.total_equity < 0 ? 'neg' : ''}`} style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {latest ? won(latest.total_equity) : '—'}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>자본잠식률</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: erosionPct && erosionPct > 100 ? 'var(--critical)' : 'var(--ink)' }}>
              {erosionPct !== null ? pct(erosionPct) : '—'}
            </span>
            {erosionPct !== null && erosionPct > 100 && <span className="badge critical">완전자본잠식</span>}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>추정 런웨이</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {runwayMonths !== null ? `${runwayMonths.toFixed(1)}개월` : '흑자 구간'}
            </span>
            {runwayMonths !== null && runwayMonths < 6 && <span className="badge warn">6개월 미만</span>}
          </div>
        </div>
      </div>

      {snapshots.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>자본총계 추이</h3>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 12px' }}>0원 기준선 아래는 완전자본잠식 구간</p>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="자본총계 추이 그래프">
            <rect x={PAD_L} y={PAD_T} width={VB_W - PAD_L - PAD_R} height={Math.max(zeroY - PAD_T, 0)} fill="var(--accent-soft)" />
            <rect x={PAD_L} y={zeroY} width={VB_W - PAD_L - PAD_R} height={Math.max(VB_H - PAD_B - zeroY, 0)} fill="var(--critical-soft)" />
            <line x1={PAD_L} y1={zeroY} x2={VB_W - PAD_R} y2={zeroY} stroke="var(--line-strong)" strokeWidth={1.2} />
            <text x={VB_W - PAD_R + 4} y={zeroY + 4} fontSize={10} fill="var(--ink-faint)" fontFamily="IBM Plex Mono, monospace">0</text>
            {points.length > 1 && <polyline points={polyline} fill="none" stroke="var(--ink-soft)" strokeWidth={1.6} />}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={4.5} fill={p.s.total_equity >= 0 ? 'var(--accent)' : 'var(--critical)'} />
                <text
                  x={p.x}
                  y={p.s.total_equity >= 0 ? p.y - 10 : p.y + 18}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={600}
                  fill={p.s.total_equity >= 0 ? 'var(--accent)' : 'var(--critical)'}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {(p.s.total_equity / 1_000_000).toFixed(1)}M
                </text>
                <text x={p.x} y={PAD_T - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-faint)">
                  {p.s.period_end.slice(0, 4)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>기준일</th>
              <th>매출액</th>
              <th>순손익</th>
              <th>자산총계</th>
              <th>부채총계</th>
              <th>자본총계</th>
              <th>현금</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.period_end}>
                <td>{fmtDate(s.period_end)}</td>
                <td className="mono">{won(s.revenue)}</td>
                <td className={`mono ${s.net_income < 0 ? 'neg' : 'pos'}`}>{won(s.net_income)}</td>
                <td className="mono">{won(s.total_assets)}</td>
                <td className="mono">{won(s.total_liabilities)}</td>
                <td className={`mono ${s.total_equity < 0 ? 'neg' : 'pos'}`}>{won(s.total_equity)}</td>
                <td className="mono">{won(s.cash_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddSnapshotForm onAdded={load} />
    </div>
  )
}

function AddSnapshotForm({ onAdded }: { onAdded: () => void }) {
  const [f, setF] = useState({
    period_end: '',
    revenue: '',
    opex: '',
    total_assets: '',
    total_liabilities: '',
    cash_balance: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [calcBusy, setCalcBusy] = useState(false)
  const [calcNote, setCalcNote] = useState<string | null>(null)

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }))
  }

  async function calcFromLedger() {
    if (!f.period_end) {
      setCalcNote('먼저 기준일을 입력하세요.')
      return
    }
    setCalcBusy(true)
    setCalcNote(null)
    const [{ data: accounts, error: accErr }, { data: lines, error: lnErr }] = await Promise.all([
      supabase.from('finance_accounts').select('*'),
      supabase
        .from('finance_journal_lines')
        .select('*, finance_journal_entries!inner(entry_date)')
        .lte('finance_journal_entries.entry_date', f.period_end),
    ])
    setCalcBusy(false)
    if (accErr || lnErr) {
      setCalcNote((accErr ?? lnErr)?.message ?? '계산 실패')
      return
    }
    const typedAccounts = (accounts ?? []) as FinanceAccount[]
    const typedLines = (lines ?? []) as FinanceJournalLine[]
    const totals = ledgerTotals(typedAccounts, typedLines)
    const cashAccount = typedAccounts.find((a) => a.name === '현금및현금성자산')
    const cashLines = cashAccount ? typedLines.filter((l) => l.account_id === cashAccount.id) : []
    const cashBalance = cashLines.reduce((s, l) => s + (l.debit - l.credit), 0)
    setF((prev) => ({
      ...prev,
      total_assets: String(Math.round(totals.assets)),
      total_liabilities: String(Math.round(totals.liabilities)),
      cash_balance: String(Math.round(cashBalance)),
    }))
    setCalcNote(
      typedLines.length === 0
        ? '이 날짜까지 분개장에 입력된 거래가 없습니다 (0으로 계산됨).'
        : '분개장 기준으로 계산했습니다. 필요하면 값을 직접 수정할 수 있습니다.',
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.period_end) return
    setBusy(true)
    const revenue = Number(f.revenue || 0)
    const opex = Number(f.opex || 0)
    const totalAssets = Number(f.total_assets || 0)
    const totalLiabilities = Number(f.total_liabilities || 0)
    const operatingIncome = revenue - opex
    await supabase.from('finance_snapshots').insert({
      period_end: f.period_end,
      revenue,
      opex,
      operating_income: operatingIncome,
      net_income: operatingIncome,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalAssets - totalLiabilities,
      cash_balance: Number(f.cash_balance || 0),
      notes: f.notes || null,
    })
    setBusy(false)
    setF({ period_end: '', revenue: '', opex: '', total_assets: '', total_liabilities: '', cash_balance: '', notes: '' })
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>새 결산 스냅샷 추가</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 12px' }}>
        자산총계·부채총계는 "분개장에서 자동계산"을 누르면 기준일까지의 분개장 데이터로 채워집니다(필요시 직접 수정 가능).
        영업외손익은 이 표에 반영되지 않습니다(단순화) — 정확한 순손익은 결산 확정 후 직접 보정하세요.
      </p>
      <form onSubmit={submit} className="field-row">
        <div className="field">
          <label>기준일</label>
          <input type="date" value={f.period_end} onChange={(e) => set('period_end', e.target.value)} required />
        </div>
        <div className="field">
          <label>매출액</label>
          <input type="number" value={f.revenue} onChange={(e) => set('revenue', e.target.value)} />
        </div>
        <div className="field">
          <label>판관비</label>
          <input type="number" value={f.opex} onChange={(e) => set('opex', e.target.value)} />
        </div>
        <div className="field">
          <label>자산총계</label>
          <input type="number" value={f.total_assets} onChange={(e) => set('total_assets', e.target.value)} required />
        </div>
        <div className="field">
          <label>부채총계</label>
          <input type="number" value={f.total_liabilities} onChange={(e) => set('total_liabilities', e.target.value)} required />
        </div>
        <button type="button" className="btn" onClick={calcFromLedger} disabled={calcBusy} style={{ height: 34 }}>
          {calcBusy ? '계산 중…' : '분개장에서 자동계산'}
        </button>
        <div className="field">
          <label>현금</label>
          <input type="number" value={f.cash_balance} onChange={(e) => set('cash_balance', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>메모</label>
          <input type="text" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '추가'}
        </button>
      </form>
      {calcNote && <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 10 }}>{calcNote}</p>}
    </div>
  )
}
