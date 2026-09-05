import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, pct, fmtDate } from '../lib/format'
import { downloadCsv } from '../lib/exportFiles'
import type { FinanceLoan, FinanceLoanTransaction, LenderType, TxType } from '../lib/types'

function balanceOf(txs: FinanceLoanTransaction[]): number {
  return txs.reduce((sum, t) => {
    if (t.tx_type === 'repayment') return sum - t.amount
    return sum + t.amount
  }, 0)
}

export default function LoanLedger() {
  const [loans, setLoans] = useState<FinanceLoan[]>([])
  const [txByLoan, setTxByLoan] = useState<Record<string, FinanceLoanTransaction[]>>({})
  const [loading, setLoading] = useState(true)
  const [openLoan, setOpenLoan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: loanData, error: loanErr }, { data: txData, error: txErr }] = await Promise.all([
      supabase.from('finance_loans').select('*').order('created_at', { ascending: true }),
      supabase.from('finance_loan_transactions').select('*').order('tx_date', { ascending: true }),
    ])
    if (loanErr || txErr) {
      setError((loanErr ?? txErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    const grouped: Record<string, FinanceLoanTransaction[]> = {}
    for (const tx of txData ?? []) {
      grouped[tx.loan_id] = grouped[tx.loan_id] ?? []
      grouped[tx.loan_id].push(tx)
    }
    setLoans(loanData ?? [])
    setTxByLoan(grouped)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const totalOutstanding = loans.reduce((sum, l) => sum + balanceOf(txByLoan[l.id] ?? []), 0)
  const officerOutstanding = loans
    .filter((l) => l.lender_type === 'officer')
    .reduce((sum, l) => sum + balanceOf(txByLoan[l.id] ?? []), 0)

  async function deleteLoan(id: string) {
    if (!confirm('이 차입과 관련 거래내역을 모두 삭제할까요?')) return
    await supabase.from('finance_loans').delete().eq('id', id)
    load()
  }

  async function deleteTx(id: string) {
    if (!confirm('이 거래를 삭제할까요?')) return
    await supabase.from('finance_loan_transactions').delete().eq('id', id)
    load()
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['대주', '구분', '일자', '거래구분', '금액', '메모']]
    for (const loan of loans) {
      for (const t of txByLoan[loan.id] ?? []) {
        rows.push([
          loan.lender_name,
          loan.lender_type === 'officer' ? '특수관계자' : '외부',
          t.tx_date,
          t.tx_type === 'draw' ? '차입' : t.tx_type === 'repayment' ? '상환' : '이자발생',
          t.amount,
          t.note ?? '',
        ])
      }
    }
    downloadCsv(`stampers_차입금원장_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>총 차입 잔액</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{won(totalOutstanding)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>임직원(대표자 등) 차입 잔액</div>
          <div className="mono neg" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{won(officerOutstanding)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>전체 대비 임직원 비중</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {totalOutstanding ? pct((officerOutstanding / totalOutstanding) * 100) : '—'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <button className="btn" onClick={exportCsv} disabled={loans.length === 0}>
          차입금 원장 CSV로 내보내기
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {loans.map((loan) => {
          const txs = txByLoan[loan.id] ?? []
          const balance = balanceOf(txs)
          const lowRate = loan.annual_interest_rate === null || loan.annual_interest_rate < 0.02
          const isOpen = openLoan === loan.id
          return (
            <div className="card" key={loan.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14.5 }}>{loan.lender_name}</strong>
                    <span className={`badge ${loan.lender_type === 'officer' ? 'critical' : 'ok'}`}>
                      {loan.lender_type === 'officer' ? '특수관계자' : '외부'}
                    </span>
                    {lowRate && <span className="badge warn">인정이자 점검 필요</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>
                    이자율 {loan.annual_interest_rate !== null ? pct(loan.annual_interest_rate * 100, 2) : '미상'} · 만기{' '}
                    {fmtDate(loan.due_date)} · {loan.notes}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{won(balance)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn" style={{ fontSize: 12 }} onClick={() => setOpenLoan(isOpen ? null : loan.id)}>
                      {isOpen ? '거래내역 닫기' : '거래내역 보기'}
                    </button>
                    <button className="btn" style={{ fontSize: 12 }} onClick={() => deleteLoan(loan.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>일자</th>
                          <th>구분</th>
                          <th>금액</th>
                          <th>메모</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.map((t) => (
                          <tr key={t.id}>
                            <td>{fmtDate(t.tx_date)}</td>
                            <td>{t.tx_type === 'draw' ? '차입' : t.tx_type === 'repayment' ? '상환' : '이자발생'}</td>
                            <td className={`mono ${t.tx_type === 'repayment' ? 'pos' : ''}`}>
                              {t.tx_type === 'repayment' ? '-' : '+'}
                              {won(t.amount)}
                            </td>
                            <td style={{ textAlign: 'left' }}>{t.note}</td>
                            <td>
                              <button className="btn" style={{ fontSize: 12 }} onClick={() => deleteTx(t.id)}>
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <AddTxForm loanId={loan.id} onAdded={load} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <AddLoanForm onAdded={load} />
    </div>
  )
}

function AddTxForm({ loanId, onAdded }: { loanId: string; onAdded: () => void }) {
  const [date, setDate] = useState('')
  const [type, setType] = useState<TxType>('draw')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !amount) return
    setBusy(true)
    await supabase.from('finance_loan_transactions').insert({
      loan_id: loanId,
      tx_date: date,
      tx_type: type,
      amount: Number(amount),
      note: note || null,
    })
    setBusy(false)
    setDate('')
    setAmount('')
    setNote('')
    onAdded()
  }

  return (
    <form onSubmit={submit} className="field-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line-strong)' }}>
      <div className="field">
        <label>일자</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="field">
        <label>구분</label>
        <select value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="draw">차입</option>
          <option value="repayment">상환</option>
          <option value="interest_accrual">이자발생</option>
        </select>
      </div>
      <div className="field">
        <label>금액(원)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" />
      </div>
      <div className="field" style={{ flex: 1, minWidth: 160 }}>
        <label>메모</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? '저장 중…' : '거래 추가'}
      </button>
    </form>
  )
}

function AddLoanForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<LenderType>('officer')
  const [rate, setRate] = useState('')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setBusy(true)
    await supabase.from('finance_loans').insert({
      lender_name: name,
      lender_type: type,
      annual_interest_rate: rate ? Number(rate) / 100 : null,
      due_date: due || null,
      notes: notes || null,
    })
    setBusy(false)
    setName('')
    setRate('')
    setDue('')
    setNotes('')
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>새 차입 등록</h3>
      <form onSubmit={submit} className="field-row">
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>대주(貸主)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 대표자 주성우" required />
        </div>
        <div className="field">
          <label>구분</label>
          <select value={type} onChange={(e) => setType(e.target.value as LenderType)}>
            <option value="officer">특수관계자(임직원)</option>
            <option value="external">외부</option>
          </select>
        </div>
        <div className="field">
          <label>연 이자율(%)</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="예: 4.6" />
        </div>
        <div className="field">
          <label>만기일</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>메모</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '등록'}
        </button>
      </form>
    </div>
  )
}
