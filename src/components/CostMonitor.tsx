import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, pct } from '../lib/format'
import type { FinanceExpenseCategory, FinancePeriodExpense, FinanceSnapshot } from '../lib/types'

export default function CostMonitor() {
  const [categories, setCategories] = useState<FinanceExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<FinancePeriodExpense[]>([])
  const [snapshots, setSnapshots] = useState<FinanceSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: cats, error: catErr }, { data: exps, error: expErr }, { data: snaps, error: snapErr }] = await Promise.all([
      supabase.from('finance_expense_categories').select('*').order('name'),
      supabase.from('finance_period_expenses').select('*'),
      supabase.from('finance_snapshots').select('*').order('period_end', { ascending: false }),
    ])
    if (catErr || expErr || snapErr) {
      setError((catErr ?? expErr ?? snapErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    setCategories(cats ?? [])
    setExpenses(exps ?? [])
    setSnapshots(snaps ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const periods = [...new Set(expenses.map((e) => e.period_end))].sort().reverse()

  return (
    <div>
      {periods.length === 0 && <p className="empty-note">등록된 비용 내역이 없습니다.</p>}
      {periods.map((period) => {
        const revenue = snapshots.find((s) => s.period_end === period)?.revenue ?? null
        const rows = expenses.filter((e) => e.period_end === period).sort((a, b) => b.amount - a.amount)
        const total = rows.reduce((s, r) => s + r.amount, 0)
        return (
          <div className="table-wrap" style={{ marginBottom: 20 }} key={period}>
            <table>
              <thead>
                <tr>
                  <th colSpan={4} style={{ textAlign: 'left', fontSize: 13, textTransform: 'none', color: 'var(--ink)', fontWeight: 700 }}>
                    {period} 기준 · 매출 {revenue !== null ? won(revenue) : '미등록'}
                  </th>
                </tr>
                <tr>
                  <th>항목</th>
                  <th>금액</th>
                  <th>매출 대비</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cat = catById[r.category_id]
                  const ratio = revenue ? (r.amount / revenue) * 100 : null
                  const over = cat?.warn_threshold_pct != null && ratio !== null && ratio > cat.warn_threshold_pct
                  return (
                    <tr key={r.category_id}>
                      <td>{cat?.name ?? '(삭제된 항목)'}</td>
                      <td className="mono">{won(r.amount)}</td>
                      <td className={`mono ${over ? 'neg' : ''}`}>{ratio !== null ? pct(ratio) : '—'}</td>
                      <td>
                        {cat?.warn_threshold_pct != null ? (
                          <span className={`badge ${over ? 'critical' : 'ok'}`}>상한 {pct(cat.warn_threshold_pct, 0)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ fontWeight: 700, color: 'var(--ink)' }}>합계</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{won(total)}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{revenue ? pct((total / revenue) * 100) : '—'}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="two-col-forms" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <AddExpenseForm categories={categories} onAdded={load} />
        <AddCategoryForm onAdded={load} />
      </div>
    </div>
  )
}

function AddExpenseForm({ categories, onAdded }: { categories: FinanceExpenseCategory[]; onAdded: () => void }) {
  const [period, setPeriod] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!period || !categoryId || !amount) return
    setBusy(true)
    await supabase
      .from('finance_period_expenses')
      .upsert({ period_end: period, category_id: categoryId, amount: Number(amount) }, { onConflict: 'period_end,category_id' })
    setBusy(false)
    setAmount('')
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>비용 항목 입력</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>기준일</label>
          <input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </div>
        <div className="field">
          <label>항목</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="" disabled>
              선택
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>금액(원)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </form>
    </div>
  )
}

function AddCategoryForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setBusy(true)
    await supabase.from('finance_expense_categories').insert({
      name,
      warn_threshold_pct: threshold ? Number(threshold) : null,
    })
    setBusy(false)
    setName('')
    setThreshold('')
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>새 비용 항목 등록</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>항목명</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 외주개발비" required />
        </div>
        <div className="field">
          <label>매출 대비 상한(%) — 선택</label>
          <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="예: 20" />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '등록'}
        </button>
      </form>
    </div>
  )
}
