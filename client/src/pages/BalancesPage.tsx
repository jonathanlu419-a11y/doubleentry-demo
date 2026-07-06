import { useMemo } from 'react';
import { useBalances } from '../api/hooks';
import { ACCOUNT_NATURES, type AccountBalance, type AccountNature } from '../api/types';
import { formatCents } from '../lib/money';

const NATURE_BLURB: Record<AccountNature, string> = {
  Asset: 'What you own',
  Liability: 'What you owe',
  Revenue: 'Income earned',
  Expense: 'Money spent',
};

export default function BalancesPage() {
  const { data: balances = [], isLoading } = useBalances();

  const { byNature, totals } = useMemo(() => {
    const byNature = {} as Record<AccountNature, AccountBalance[]>;
    for (const n of ACCOUNT_NATURES) byNature[n] = [];
    for (const b of balances) byNature[b.nature].push(b);
    const sum = (n: AccountNature) => byNature[n].reduce((s, a) => s + a.balance_cents, 0);
    const assets = sum('Asset');
    const liabilities = sum('Liability');
    const revenue = sum('Revenue');
    const expense = sum('Expense');
    return {
      byNature,
      totals: { assets, liabilities, netWorth: assets - liabilities, revenue, expense, netIncome: revenue - expense },
    };
  }, [balances]);

  if (isLoading) return <div className="page"><h1>Account Balances</h1><p className="muted">Loading…</p></div>;

  return (
    <div className="page wide">
      <h1>Account Balances</h1>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Net worth</div>
          <div className={`kpi-value ${totals.netWorth >= 0 ? 'pos' : 'neg'}`}>{formatCents(totals.netWorth)}</div>
          <div className="kpi-sub">Assets − Liabilities</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total assets</div>
          <div className="kpi-value">{formatCents(totals.assets)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total liabilities</div>
          <div className="kpi-value">{formatCents(totals.liabilities)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net income</div>
          <div className={`kpi-value ${totals.netIncome >= 0 ? 'pos' : 'neg'}`}>{formatCents(totals.netIncome)}</div>
          <div className="kpi-sub">Revenue − Expense</div>
        </div>
      </div>

      <div className="nature-grid">
        {ACCOUNT_NATURES.map((nature) => {
          const rows = byNature[nature];
          const groupTotal = rows.reduce((s, a) => s + a.balance_cents, 0);
          return (
            <div className="card" key={nature}>
              <div className="group-head">
                <div>
                  <span className={`badge nature-${nature.toLowerCase()}`}>{nature}</span>
                  <span className="muted group-blurb">{NATURE_BLURB[nature]}</span>
                </div>
                <span className="mono group-total">{formatCents(groupTotal)}</span>
              </div>
              <table className="table compact">
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="mono muted nowrap">{a.code ?? '—'}</td>
                      <td>{a.name}</td>
                      <td className="right mono">{formatCents(a.balance_cents)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={3} className="muted center">No {nature.toLowerCase()} accounts.</td></tr>}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
