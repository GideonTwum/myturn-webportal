# Wallet Simplification Initiative

## Architecture change

**Before:** Member → Admin → MyTurn (60/40 margin split)

**After:** Member → MyTurn (100% service margin to platform revenue)

Admins are **platform operators** — they manage groups, verify members, monitor contributions, finalize cycles, and support users. They are not financial beneficiaries of service margins.

## Active wallets

| Wallet | Purpose |
|--------|---------|
| Member Wallet | Payouts, withdrawals |
| MyTurn Revenue | 100% of service margin |
| Platform Float | Collection inflow |
| Group Pool | Per-cycle gross pool |
| Withdrawal Clearing | In-flight disbursements |

## Deprecated (not deleted)

- `ADMIN_EARNINGS` ledger account type — legacy balances may exist
- `AdminEarning` table — historical records retained; new rows have `adminShareAmount = 0`
- `POST/GET /admin/wallet`, `POST /admin/withdrawals` — return deprecation notice
- Admin earnings UI — removed from nav; legacy read-only at `/admin/earnings`

## Admin compensation (future)

Not implemented. Future models may include salary, commission, performance bonuses, or hybrid arrangements. Managed separately by MyTurn operations.

## Reconciliation formula

```
Float ≈ Group Pools + Member Wallets + MyTurn Revenue + Clearing
```

Legacy `ADMIN_EARNINGS` balances are flagged if non-zero or if new non-zero admin share allocations appear.

## Migration notes

1. No tables dropped — reversible
2. New cycle finalizations credit margin 100% to `MYTURN_REVENUE`
3. Existing admin earnings balances require manual HQ review before any transfer journal
4. Member flows unchanged (contributions, payouts, withdrawals)
