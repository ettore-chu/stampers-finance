import { supabase } from './supabaseClient'

export interface ReceiptMeta {
  receipt_date: string
  journal_entry_id?: string | null
  vendor?: string | null
  amount?: number | null
  memo?: string | null
}

export async function uploadReceiptFile(file: File, meta: ReceiptMeta): Promise<void> {
  const path = `${crypto.randomUUID()}-${file.name}`
  const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, file)
  if (uploadErr) throw uploadErr
  const { error: insertErr } = await supabase.from('finance_receipts').insert({
    receipt_date: meta.receipt_date,
    vendor: meta.vendor ?? null,
    amount: meta.amount ?? null,
    memo: meta.memo ?? null,
    journal_entry_id: meta.journal_entry_id ?? null,
    storage_path: path,
  })
  if (insertErr) throw insertErr
}

export async function openReceiptFile(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(storagePath, 60)
  if (error || !data) throw error ?? new Error('파일을 열 수 없습니다.')
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
