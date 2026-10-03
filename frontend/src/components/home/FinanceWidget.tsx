import {
  currentMonthKey,
  formatMoney,
  totalForMonth,
  useExpenses,
} from "../finance/useExpenses";
import { openable } from "./SectionWidgets";

/** Opens the same dashboard as the sidebar toggle, and shows this month's
 *  total so the card says something rather than just being a door. */
export default function FinanceWidget({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { expenses } = useExpenses();
  const total = totalForMonth(expenses, currentMonthKey());

  return (
    <section
      className={open ? "widget widget-finance widget-open active" : "widget widget-finance widget-open"}
      {...openable(onToggle, open ? "Close Finance" : "Open Finance")}
    >
      <header className="widget-head">
        <h3>Finance</h3>
      </header>

      <button className="widget-figure" onClick={onToggle}>
        <span className="fin-muted">Spent this month</span>
        <strong>{formatMoney(total)}</strong>
      </button>
    </section>
  );
}
