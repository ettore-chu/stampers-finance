import type { FinanceAccount, FinanceJournalLine, AccountType } from './types'

export function lineSignedAmount(line: FinanceJournalLine, account: FinanceAccount): number {
  const raw = line.debit - line.credit
  return account.normal_balance === 'debit' ? raw : -raw
}

export interface AccountBalance {
  account: FinanceAccount
  balance: number
}

export function balancesByAccount(accounts: FinanceAccount[], lines: FinanceJournalLine[]): AccountBalance[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const totals = new Map<string, number>()
  for (const line of lines) {
    const account = accountById.get(line.account_id)
    if (!account) continue
    totals.set(account.id, (totals.get(account.id) ?? 0) + lineSignedAmount(line, account))
  }
  return accounts.map((account) => ({ account, balance: totals.get(account.id) ?? 0 }))
}

export function sumByType(balances: AccountBalance[], type: AccountType): number {
  return balances.filter((b) => b.account.account_type === type).reduce((s, b) => s + b.balance, 0)
}

export interface LedgerTotals {
  assets: number
  liabilities: number
  equity: number
  revenue: number
  expense: number
}

export function ledgerTotals(accounts: FinanceAccount[], lines: FinanceJournalLine[]): LedgerTotals {
  const balances = balancesByAccount(accounts, lines)
  return {
    assets: sumByType(balances, 'asset'),
    liabilities: sumByType(balances, 'liability'),
    equity: sumByType(balances, 'equity'),
    revenue: sumByType(balances, 'revenue'),
    expense: sumByType(balances, 'expense'),
  }
}
