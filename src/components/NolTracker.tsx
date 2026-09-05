import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won } from '../lib/format'
import type { FinanceNol, FinanceSnapshot } from '../lib/types'

const CURRENT_YEAR = new Date().getFullYear()

export default function NolTracker() {
  const [rows, setRows] = useState<FinanceNol[]>([])
  const [latestSnapshot, setLatestSnapshot] = useState<FinanceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: nol, error: nolErr }, { data: snaps, error: snapErr }] = await Promise.all([
      supabase.from('finance_nol_carryforwards').select('*').order('fiscal_year', { ascending: true }),
      supabase.from('finance_snapshots').select('*').order('period_end', { ascending: false }).limit(1),
    ])
    if (nolErr || snapErr) {
      setError((nolErr ?? snapErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    setRows(nol ?? [])
    setLatestSnapshot(snaps?.[0] ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  const totalRemaining = rows.reduce((s, r) => s + (r.amount_incurred - r.amount_used), 0)
  const breakevenGap = latestSnapshot ? latestSnapshot.opex - latestSnapshot.revenue : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 22 }}>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>이월결손금 잔액 합계</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{won(totalRemaining)}</div>
        </div>
        {latestSnapshot && (
          <div className="card">
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>
              손익분기까지 부족한 매출 ({latestSnapshot.period_end} 기준)
            </div>
            <div className={`mono ${breakevenGap && breakevenGap > 0 ? 'neg' : 'pos'}`} style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
              {breakevenGap !== null ? (breakevenGap > 0 ? won(breakevenGap) : '흑자 구간') : '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>
              매출원가가 없다고 가정한 단순 추정치(판관비 = 손익분기 매출)입니다.
            </div>
          </div>
        )}
      </div>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>발생연도</th>
              <th>발생액</th>
              <th>사용액</th>
              <th>잔액</th>
              <th>소멸시한</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const remaining = r.amount_incurred - r.amount_used
              const yearsLeft = r.expiry_year - CURRENT_YEAR
              return (
                <tr key={r.fiscal_year}>
                  <td>{r.fiscal_year}년</td>
                  <td className="mono">{won(r.amount_incurred)}</td>
                  <td className="mono">{won(r.amount_used)}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{won(remaining)}</td>
                  <td>
                    {r.expiry_year}년
                    {yearsLeft <= 2 && <span className="badge warn" style={{ marginLeft: 6 }}>소멸 임박</span>}
                  </td>
                  <td>
                    <UseNolInline row={r} onDone={load} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AddNolForm onAdded={load} />
    </div>
  )
}

function UseNolInline({ row, onDone }: { row: FinanceNol; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function apply() {
    if (!amount) return
    setBusy(true)
    await supabase
      .from('finance_nol_carryforwards')
      .update({ amount_used: row.amount_used + Number(amount) })
      .eq('fiscal_year', row.fiscal_year)
    setBusy(false)
    setAmount('')
    onDone()
  }

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <input type="number" placeholder="사용액" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
      <button className="btn" onClick={apply} disabled={busy} type="button">
        반영
      </button>
    </div>
  )
}

function AddNolForm({ onAdded }: { onAdded: () => void }) {
  const [year, setYear] = useState('')
  const [amount, setAmount] = useState('')
  const [expiry, setExpiry] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!year || !amount) return
    setBusy(true)
    await supabase.from('finance_nol_carryforwards').insert({
      fiscal_year: Number(year),
      amount_incurred: Number(amount),
      expiry_year: expiry ? Number(expiry) : Number(year) + 10,
      notes: notes || null,
    })
    setBusy(false)
    setYear('')
    setAmount('')
    setExpiry('')
    setNotes('')
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>결손금 연도 추가</h3>
      <form onSubmit={submit} className="field-row">
        <div className="field">
          <label>발생연도</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
        </div>
        <div className="field">
          <label>발생액(원)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="field">
          <label>소멸연도(비우면 +10년)</label>
          <input type="number" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>메모</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '추가'}
        </button>
      </form>
    </div>
  )
}
