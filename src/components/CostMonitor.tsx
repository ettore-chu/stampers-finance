import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, pct } from '../lib/format'
import { downloadCsv } from '../lib/exportFiles'
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

  async function deleteExpense(periodEnd: string, categoryId: string) {
    if (!confirm('이 비용 항목을 삭제할까요?')) return
    await supabase.from('finance_period_expenses').delete().eq('period_end', periodEnd).eq('category_id', categoryId)
    load()
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['기준일', '항목', '금액', '매출', '매출대비비율']]
    for (const e of expenses.slice().sort((a, b) => a.period_end.localeCompare(b.period_end))) {
      const cat = categories.find((c) => c.id === e.category_id)
      const revenue = snapshots.find((s) => s.period_end === e.period_end)?.revenue ?? null
      rows.push([e.period_end, cat?.name ?? '', e.amount, revenue ?? '', revenue ? ((e.amount / revenue) * 100).toFixed(1) + '%' : ''])
    }
    downloadCsv(`stampers_원가내역_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const periods = [...new Set(expenses.map((e) => e.period_end))].sort().reverse()

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <button className="btn" onClick={exportCsv} disabled={expenses.length === 0}>
          원가 내역 CSV로 내보내기
        </button>
      </div>
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
                  <th></th>
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
                      <td>
                        <button className="btn" style={{ fontSize: 12 }} onClick={() => deleteExpense(period, r.category_id)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ fontWeight: 700, color: 'var(--ink)' }}>합계</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{won(total)}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{revenue ? pct((total / revenue) * 100) : '—'}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="two-col-forms" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <AddExpenseForm categories={categories} onAdded={load} />
        <AddCategoryForm categories={categories} onAdded={load} />
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

function AddCategoryForm({ categories, onAdded }: { categories: FinanceExpenseCategory[]; onAdded: () => void }) {
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

  async function remove(id: string) {
    if (!confirm('이 항목을 삭제할까요? 이 항목으로 등록된 비용 내역도 함께 삭제됩니다.')) return
    await supabase.from('finance_expense_categories').delete().eq('id', id)
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>비용 항목 관리</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {categories.map((c) => (
          <span key={c.id} className="badge ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {c.name}
            <button
              type="button"
              onClick={() => remove(c.id)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
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
