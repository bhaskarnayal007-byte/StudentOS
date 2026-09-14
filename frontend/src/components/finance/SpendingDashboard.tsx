import { useEffect } from "react";
import { createPortal } from "react-dom";
import CategoryBreakdownChart from "./CategoryBreakdownChart";
import ExpenseEntryForm from "./ExpenseEntryForm";
import ExpenseList from "./ExpenseList";
import MonthlySummaryCard from "./MonthlySummaryCard";
import MonthlyTrendChart from "./MonthlyTrendChart";
import { useExpenses } from "./useExpenses";

/**
 * An in-page overlay, not a route: the app keeps its state and its scroll
 * position, and closing returns you exactly where you were.
 *
 * Portalled to <body> because several of the app's surfaces use backdrop
 * filters or animate transforms, and any such ancestor becomes the containing
 * block for `position: fixed` descendants — an in-tree panel would end up
 * trapped inside the 168px sidebar.
 */
export default function SpendingDashboard({ onClose }: { onClose: () => void }) {
  const { expenses, addExpense, deleteExpense, categories } = useExpenses();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fin-backdrop" onMouseDown={onClose}>
      <div
        className="fin-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Spending footprint"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="fin-head">
          <h3>Spending footprint</h3>
          <button className="ghost fin-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="fin-body">
          <MonthlySummaryCard expenses={expenses} />

          <ExpenseEntryForm categories={categories} onAdd={addExpense} />

          <div className="fin-charts">
            <CategoryBreakdownChart expenses={expenses} />
            <MonthlyTrendChart expenses={expenses} />
          </div>

          <ExpenseList expenses={expenses} onDelete={deleteExpense} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
