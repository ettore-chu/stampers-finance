import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, fmtDate } from '../lib/format'
import { openReceiptFile, uploadReceiptFile } from '../lib/receipts'
import type { FinanceJournalEntry, FinanceReceipt } from '../lib/types'

export default function ReceiptVault() {
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([])
  const [entries, setEntries] = useState<FinanceJournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: rec, error: recErr }, { data: ent, error: entErr }] = await Promise.all([
      supabase.from('finance_receipts').select('*').order('receipt_date', { ascending: false }),
      supabase.from('finance_journal_entries').select('*').order('entry_date', { ascending: false }),
    ])
    if (recErr || entErr) {
      setError((recErr ?? entErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    setReceipts(rec ?? [])
    setEntries(ent ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function openReceipt(path: string) {
    try {
      await openReceiptFile(path)
    } catch (err) {
      alert('파일을 열 수 없습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
    }
  }

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  return (
    <div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.7, margin: '0 0 20px' }}>
        영수증·세금계산서·카드전표 원본 파일을 올려두면, 나중에 셀프 신고하거나 세무조사 소명이 필요할 때 여기서 바로 찾을 수 있습니다.
        비공개 저장소라 대표자 본인만 열람 가능합니다. 분개를 저장할 때 바로 첨부하려면 <b>분개장</b> 탭을 이용하세요 — 여기는 전체
        영수증을 한눈에 보는 용도입니다.
      </p>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>일자</th>
              <th>거래처</th>
              <th>금액</th>
              <th>연결된 분개</th>
              <th>메모</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => {
              const linked = entries.find((e) => e.id === r.journal_entry_id)
              return (
                <tr key={r.id}>
                  <td>{fmtDate(r.receipt_date)}</td>
                  <td>{r.vendor}</td>
                  <td className="mono">{r.amount !== null ? won(r.amount) : '—'}</td>
                  <td style={{ textAlign: 'left' }}>{linked ? `${linked.entry_date} · ${linked.description ?? ''}` : '—'}</td>
                  <td style={{ textAlign: 'left' }}>{r.memo}</td>
                  <td>
                    <button className="btn" onClick={() => openReceipt(r.storage_path)}>
                      열기
                    </button>
                  </td>
                </tr>
              )
            })}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>
                  등록된 영수증이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UploadForm entries={entries} onAdded={load} />
    </div>
  )
}

function UploadForm({ entries, onAdded }: { entries: FinanceJournalEntry[]; onAdded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [date, setDate] = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [entryId, setEntryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file || !date) {
      setError('파일과 일자를 입력하세요.')
      return
    }
    setBusy(true)
    try {
      await uploadReceiptFile(file, {
        receipt_date: date,
        vendor: vendor || null,
        amount: amount ? Number(amount) : null,
        memo: memo || null,
        journal_entry_id: entryId || null,
      })
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : '업로드 실패')
      return
    }
    setBusy(false)
    setFile(null)
    setDate('')
    setVendor('')
    setAmount('')
    setMemo('')
    setEntryId('')
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>영수증 업로드</h3>
      <form onSubmit={submit} className="field-row">
        <div className="field">
          <label>파일(이미지/PDF)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <div className="field">
          <label>일자</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>거래처</label>
          <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="field">
          <label>금액</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>연결할 분개(선택)</label>
          <select value={entryId} onChange={(e) => setEntryId(e.target.value)}>
            <option value="">없음</option>
            {entries.map((en) => (
              <option key={en.id} value={en.id}>
                {en.entry_date} · {en.description ?? ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>메모</label>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '업로드 중…' : '업로드'}
        </button>
      </form>
      {error && <p style={{ fontSize: 12.5, color: 'var(--critical)', marginTop: 10 }}>{error}</p>}
    </div>
  )
}
