import { formatMoney, type Expense } from "./useExpenses";

const SHOWN = 8;

export default function ExpenseList({
  expenses,
  onDelete,
}: {
  expenses: Expense[];
  onDelete: (id: string) => void;
}) {
  // Newest first. Sort a copy — sorting the array from the hook in place would
  // mutate state React believes is immutable.
  const recent = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, SHOWN);

  return (
    <section className="fin-card">
      <h4 className="fin-card-title">
        Recent
        {expenses.length > SHOWN && (
          <span className="fin-muted"> · showing {SHOWN} of {expenses.length}</span>
        )}
      </h4>

      {recent.length === 0 ? (
        <p className="placeholder">No expenses yet. Add one above.</p>
      ) : (
        <ul className="list">
          {recent.map((e) => (
            <li key={e.id} className="item">
              <span className="chip">{e.category}</span>
              <span className="grow">
                {e.note || <span className="fin-muted">—</span>}
              </span>
              <span className="chip">{formatDay(e.date)}</span>
              <strong className="fin-amount-cell">{formatMoney(e.amount)}</strong>
              <button
                className="ghost"
                aria-label={`Delete ${e.category} expense`}
                onClick={() => onDelete(e.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
