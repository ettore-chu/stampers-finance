export type LenderType = 'officer' | 'external'
export type LoanStatus = 'active' | 'repaid'
export type TxType = 'draw' | 'repayment' | 'interest_accrual'

export interface FinanceCompany {
  id: true
  name: string
  biz_reg_no: string | null
  capital_stock: number
}

export interface FinanceSnapshot {
  period_end: string
  revenue: number
  opex: number
  operating_income: number
  net_income: number
  total_assets: number
  total_liabilities: number
  total_equity: number
  cash_balance: number
  notes: string | null
}

export interface FinanceLoan {
  id: string
  lender_name: string
  lender_type: LenderType
  annual_interest_rate: number | null
  due_date: string | null
  status: LoanStatus
  notes: string | null
  created_at: string
}

export interface FinanceLoanTransaction {
  id: string
  loan_id: string
  tx_date: string
  tx_type: TxType
  amount: number
  note: string | null
  created_at: string
}

export interface FinanceExpenseCategory {
  id: string
  name: string
  warn_threshold_pct: number | null
}

export interface FinancePeriodExpense {
  period_end: string
  category_id: string
  amount: number
}

export interface FinanceNol {
  fiscal_year: number
  amount_incurred: number
  amount_used: number
  expiry_year: number
  notes: string | null
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type NormalBalance = 'debit' | 'credit'

export interface FinanceAccount {
  id: string
  code: string | null
  name: string
  account_type: AccountType
  normal_balance: NormalBalance
  is_active: boolean
}

export interface FinanceJournalEntry {
  id: string
  entry_date: string
  description: string | null
  created_at: string
}

export interface FinanceJournalLine {
  id: string
  entry_id: string
  account_id: string
  debit: number
  credit: number
  memo: string | null
}

export interface FinanceReceipt {
  id: string
  journal_entry_id: string | null
  receipt_date: string
  vendor: string | null
  amount: number | null
  memo: string | null
  storage_path: string
  uploaded_at: string
}
