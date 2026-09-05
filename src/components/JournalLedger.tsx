import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { won, fmtDate } from '../lib/format'
import { balancesByAccount, ledgerTotals } from '../lib/ledger'
import { openReceiptFile, uploadReceiptFile } from '../lib/receipts'
import type { AccountType, FinanceAccount, FinanceJournalEntry, FinanceJournalLine, FinanceReceipt, NormalBalance } from '../lib/types'

const TYPE_LABEL: Record<AccountType, string> = {
  asset: '자산',
  liability: '부채',
  equity: '자본',
  revenue: '수익',
  expense: '비용',
}
const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
const DEFAULT_NORMAL: Record<AccountType, NormalBalance> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
}

export default function JournalLedger() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [entries, setEntries] = useState<FinanceJournalEntry[]>([])
  const [lines, setLines] = useState<FinanceJournalLine[]>([])
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAccounts, setShowAccounts] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: acc, error: accErr }, { data: ent, error: entErr }, { data: ln, error: lnErr }, { data: rec, error: recErr }] =
      await Promise.all([
        supabase.from('finance_accounts').select('*').order('code'),
        supabase.from('finance_journal_entries').select('*').order('entry_date', { ascending: false }),
        supabase.from('finance_journal_lines').select('*'),
        supabase.from('finance_receipts').select('*'),
      ])
    if (accErr || entErr || lnErr || recErr) {
      setError((accErr ?? entErr ?? lnErr ?? recErr)?.message ?? '알 수 없는 오류')
      setLoading(false)
      return
    }
    setAccounts(acc ?? [])
    setEntries(ent ?? [])
    setLines(ln ?? [])
    setReceipts(rec ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const linesByEntry = useMemo(() => {
    const m: Record<string, FinanceJournalLine[]> = {}
    for (const l of lines) {
      m[l.entry_id] = m[l.entry_id] ?? []
      m[l.entry_id].push(l)
    }
    return m
  }, [lines])

  const receiptsByEntry = useMemo(() => {
    const m: Record<string, FinanceReceipt[]> = {}
    for (const r of receipts) {
      if (!r.journal_entry_id) continue
      m[r.journal_entry_id] = m[r.journal_entry_id] ?? []
      m[r.journal_entry_id].push(r)
    }
    return m
  }, [receipts])

  const balances = useMemo(() => balancesByAccount(accounts, lines), [accounts, lines])
  const totals = useMemo(() => ledgerTotals(accounts, lines), [accounts, lines])
  const debitCreditCheck = useMemo(() => {
    const debit = lines.reduce((s, l) => s + l.debit, 0)
    const credit = lines.reduce((s, l) => s + l.credit, 0)
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.5 }
  }, [lines])

  if (loading) return <p className="empty-note">불러오는 중…</p>
  if (error) return <p className="empty-note" style={{ color: 'var(--critical)' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>자산총계 (장부 기준)</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>{won(totals.assets)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>부채총계 (장부 기준)</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>{won(totals.liabilities)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>자본 계정 총계</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 700, marginTop: 6 }}>{won(totals.equity)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600 }}>차변/대변 검증</div>
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${debitCreditCheck.balanced ? 'ok' : 'critical'}`}>
              {debitCreditCheck.balanced ? '일치' : '불일치 — 확인 필요'}
            </span>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.7, margin: '0 0 20px' }}>
        위 자산/부채총계는 아래 분개장에 입력된 거래만 반영합니다. 2023~2025년 기존 결산 수치는 이미 확정 신고된
        공식 재무제표라 별도 스냅샷으로 남아있고, 이 장부는 <b>오늘 이후 거래</b>부터 자동 집계합니다.
      </p>

      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>구분</th>
              <th>계정과목</th>
              <th>잔액</th>
            </tr>
          </thead>
          <tbody>
            {TYPE_ORDER.flatMap((type) => {
              const rows = balances.filter((b) => b.account.account_type === type && b.balance !== 0)
              if (rows.length === 0) return []
              return rows.map((b, i) => (
                <tr key={b.account.id}>
                  <td>{i === 0 ? TYPE_LABEL[type] : ''}</td>
                  <td>{b.account.name}</td>
                  <td className="mono">{won(b.balance)}</td>
                </tr>
              ))
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>
                  아직 분개가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => setShowAccounts((v) => !v)}>
          {showAccounts ? '계정과목 관리 닫기' : '계정과목 관리'}
        </button>
        {showAccounts && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>코드</th>
                    <th>계정과목</th>
                    <th>구분</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.code}</td>
                      <td>{a.name}</td>
                      <td>{TYPE_LABEL[a.account_type]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AddAccountForm onAdded={load} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {entries.map((e) => {
          const els = linesByEntry[e.id] ?? []
          const entryDebit = els.reduce((s, l) => s + l.debit, 0)
          const entryReceipts = receiptsByEntry[e.id] ?? []
          return (
            <div className="card" key={e.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{fmtDate(e.entry_date)}</strong>
                  {e.description && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--ink-soft)' }}>{e.description}</span>}
                </div>
                <span className="mono" style={{ fontWeight: 700 }}>{won(entryDebit)}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>계정과목</th>
                      <th>차변</th>
                      <th>대변</th>
                      <th>메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {els.map((l) => {
                      const account = accounts.find((a) => a.id === l.account_id)
                      return (
                        <tr key={l.id}>
                          <td>{account?.name ?? '(삭제된 계정)'}</td>
                          <td className="mono">{l.debit ? won(l.debit) : ''}</td>
                          <td className="mono">{l.credit ? won(l.credit) : ''}</td>
                          <td style={{ textAlign: 'left' }}>{l.memo}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <EntryReceipts entryId={e.id} entryDate={e.entry_date} receipts={entryReceipts} onChanged={load} />
            </div>
          )
        })}
        {entries.length === 0 && <p className="empty-note">등록된 분개가 없습니다.</p>}
      </div>

      <AddEntryForm accounts={accounts} onAdded={load} />
    </div>
  )
}

function EntryReceipts({
  entryId,
  entryDate,
  receipts,
  onChanged,
}: {
  entryId: string
  entryDate: string
  receipts: FinanceReceipt[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadReceiptFile(file, { receipt_date: entryDate, journal_entry_id: entryId })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패')
    }
    setBusy(false)
  }

  async function open(path: string) {
    try {
      await openReceiptFile(path)
    } catch (err) {
      alert('파일을 열 수 없습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line-strong)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>영수증</span>
      {receipts.map((r) => (
        <button key={r.id} type="button" className="btn" style={{ fontSize: 12 }} onClick={() => open(r.storage_path)}>
          {r.vendor ?? '파일'} 열기
        </button>
      ))}
      <label className="btn" style={{ fontSize: 12, cursor: 'pointer', margin: 0 }}>
        {busy ? '업로드 중…' : '+ 영수증 첨부'}
        <input
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <span style={{ fontSize: 12, color: 'var(--critical)' }}>{error}</span>}
    </div>
  )
}

function AddAccountForm({ onAdded }: { onAdded: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('expense')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setBusy(true)
    await supabase.from('finance_accounts').insert({
      code: code || null,
      name,
      account_type: type,
      normal_balance: DEFAULT_NORMAL[type],
    })
    setBusy(false)
    setCode('')
    setName('')
    onAdded()
  }

  return (
    <form onSubmit={submit} className="field-row">
      <div className="field">
        <label>코드(선택)</label>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 80 }} />
      </div>
      <div className="field" style={{ flex: 1, minWidth: 160 }}>
        <label>계정과목명</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 외주개발비" required />
      </div>
      <div className="field">
        <label>구분</label>
        <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? '저장 중…' : '추가'}
      </button>
    </form>
  )
}

interface DraftLine {
  account_id: string
  debit: string
  credit: string
  memo: string
}

function AddEntryForm({ accounts, onAdded }: { accounts: FinanceAccount[]; onAdded: () => void }) {
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [draftLines, setDraftLines] = useState<DraftLine[]>([
    { account_id: '', debit: '', credit: '', memo: '' },
    { account_id: '', debit: '', credit: '', memo: '' },
  ])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setDraftLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setDraftLines((prev) => [...prev, { account_id: '', debit: '', credit: '', memo: '' }])
  }
  function removeLine(i: number) {
    setDraftLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalDebit = draftLines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalCredit = draftLines.reduce((s, l) => s + Number(l.credit || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const validLines = draftLines.filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (!date) {
      setFormError('일자를 입력하세요.')
      return
    }
    if (validLines.length < 2) {
      setFormError('최소 2줄 이상 입력해야 합니다.')
      return
    }
    if (Math.abs(totalDebit - totalCredit) > 0.5 || totalDebit === 0) {
      setFormError(`차변(${totalDebit.toLocaleString()})과 대변(${totalCredit.toLocaleString()})의 합이 일치해야 합니다.`)
      return
    }
    setBusy(true)
    const { data: entry, error: entryErr } = await supabase
      .from('finance_journal_entries')
      .insert({ entry_date: date, description: description || null })
      .select()
      .single()
    if (entryErr || !entry) {
      setFormError(entryErr?.message ?? '분개 저장 실패')
      setBusy(false)
      return
    }
    const { error: lineErr } = await supabase.from('finance_journal_lines').insert(
      validLines.map((l) => ({
        entry_id: entry.id,
        account_id: l.account_id,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo || null,
      })),
    )
    if (lineErr) {
      setBusy(false)
      setFormError(lineErr.message)
      return
    }
    if (receiptFile) {
      try {
        await uploadReceiptFile(receiptFile, {
          receipt_date: date,
          journal_entry_id: entry.id,
          amount: totalDebit,
          memo: description || null,
        })
      } catch (err) {
        setBusy(false)
        setFormError('분개는 저장됐지만 영수증 업로드에 실패했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'))
        onAdded()
        return
      }
    }
    setBusy(false)
    setDate('')
    setDescription('')
    setDraftLines([
      { account_id: '', debit: '', credit: '', memo: '' },
      { account_id: '', debit: '', credit: '', memo: '' },
    ])
    setReceiptFile(null)
    onAdded()
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>새 분개 입력</h3>
      <form onSubmit={submit}>
        <div className="field-row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>일자</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>적요</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 9월 임차료 지급" />
          </div>
          <div className="field">
            <label>영수증 첨부(선택)</label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {draftLines.map((l, i) => (
            <div key={i} className="field-row">
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label>계정과목</label>
                <select value={l.account_id} onChange={(e) => updateLine(i, { account_id: e.target.value })}>
                  <option value="">선택</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>차변</label>
                <input
                  type="number"
                  value={l.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                  style={{ width: 120 }}
                />
              </div>
              <div className="field">
                <label>대변</label>
                <input
                  type="number"
                  value={l.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                  style={{ width: 120 }}
                />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>메모</label>
                <input type="text" value={l.memo} onChange={(e) => updateLine(i, { memo: e.target.value })} />
              </div>
              {draftLines.length > 2 && (
                <button type="button" className="btn" onClick={() => removeLine(i)} style={{ height: 34 }}>
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button type="button" className="btn" onClick={addLine}>
            + 줄 추가
          </button>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
            차변 {totalDebit.toLocaleString()} / 대변 {totalCredit.toLocaleString()}
          </div>
        </div>

        {formError && <p style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 10 }}>{formError}</p>}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '저장 중…' : '분개 저장'}
        </button>
      </form>
    </div>
  )
}
