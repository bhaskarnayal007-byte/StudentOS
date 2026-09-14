import {
  byCategory,
  currentMonthKey,
  formatMoney,
  percentChange,
  shiftMonth,
  totalForMonth,
  type Expense,
} from "./useExpenses";

export default function MonthlySummaryCard({ expenses }: { expenses: Expense[] }) {
  const thisMonth = currentMonthKey();
  const lastMonth = shiftMonth(thisMonth, -1);

  const total = totalForMonth(expenses, thisMonth);
  const change = percentChange(total, totalForMonth(expenses, lastMonth));
  const top = byCategory(expenses, thisMonth)[0];

  return (
    <section className="fin-summary">
      <div className="fin-stat">
        <span className="fin-stat-label">Spent this month</span>
        <strong className="fin-stat-value">{formatMoney(total)}</strong>
      </div>

      <div className="fin-stat">
        <span className="fin-stat-label">vs. last month</span>
        <strong className="fin-stat-value fin-stat-sm">
          {change === null ? (
            <span className="fin-muted">no data</span>
          ) : (
            // Sign is carried by an explicit arrow rather than colour: red/green
            // would mean adding colours the design system doesn't define, and
            // colour alone is not an accessible signal anyway.
            <>
              {change > 0 ? "▲" : change < 0 ? "▼" : "—"}{" "}
              {Math.abs(change).toFixed(change >= 100 ? 0 : 1)}%
            </>
          )}
        </strong>
      </div>

      <div className="fin-stat">
        <span className="fin-stat-label">Top category</span>
        <strong className="fin-stat-value fin-stat-sm">
          {top ? (
            <>
              {top.category} <span className="fin-muted">{formatMoney(top.amount)}</span>
            </>
          ) : (
            <span className="fin-muted">—</span>
          )}
        </strong>
      </div>
    </section>
  );
}
