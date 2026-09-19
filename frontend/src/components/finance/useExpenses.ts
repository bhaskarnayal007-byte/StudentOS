import { useCallback, useMemo } from "react";
import { useStore } from "../../store.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// THE ONLY PLACE EXPENSES ARE READ OR WRITTEN.
//
// Every component below consumes this hook and nothing else. The list itself
// lives in the app store (src/store.jsx) like everything else, which is what
// puts it in the cloud sync — it used to sit under a localStorage key of its
// own and so stayed on whichever device created it. Components never noticed:
// their contract is `{ expenses, addExpense, ... }`, not where it is kept.
// ─────────────────────────────────────────────────────────────────────────────

export type Expense = {
  id: string;
  amount: number;
  category: string;
  date: string; // ISO date, "YYYY-MM-DD"
  note?: string;
};

/** "2026-09-05" → "2026-09". Plain string slicing, never a Date object —
 *  see the note in src/dates.js about days-as-labels vs. moments-in-time. */
export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Steps back `n` months from a "YYYY-MM" key. */
export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  // Day 1 avoids the classic month-arithmetic bug where Jan 31 minus a month
  // lands on Mar 3 because February has no 31st.
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function useExpenses() {
  const { state, dispatch } = useStore() as {
    state: { expenses: Expense[] };
    dispatch: (action: unknown) => void;
  };

  // Storage is user-editable and survives schema changes, so treat anything
  // coming back out of it as untrusted and drop what can't be rendered.
  const expenses = useMemo(
    () => (Array.isArray(state.expenses) ? state.expenses.filter(isExpense) : []),
    [state.expenses],
  );

  const addExpense = useCallback(
    (input: Omit<Expense, "id">) => dispatch({ type: "add-expense", expense: input }),
    [dispatch],
  );

  const deleteExpense = useCallback(
    (id: string) => dispatch({ type: "delete-expense", id }),
    [dispatch],
  );

  // Every category ever used, most-used first — this is what feeds the
  // autocomplete, so there is no preset list to maintain.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [expenses]);

  return { expenses, addExpense, deleteExpense, categories };
}

function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<Expense>;
  return (
    typeof e.id === "string" &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount) &&
    typeof e.category === "string" &&
    typeof e.date === "string"
  );
}

// ─── Derived views ───────────────────────────────────────────────────────────
// Kept as plain functions rather than extra hooks: they are pure, so they can
// be unit-tested and reused without a React render.

export function totalForMonth(expenses: Expense[], key: string) {
  return expenses.reduce((sum, e) => (monthKey(e.date) === key ? sum + e.amount : sum), 0);
}

export function byCategory(expenses: Expense[], key: string) {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (monthKey(e.date) !== key) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Totals for the last `count` months, oldest first, including empty months. */
export function monthlyTotals(expenses: Expense[], count = 6, endKey = currentMonthKey()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = shiftMonth(endKey, -i);
    out.push({ key, label: monthLabel(key), total: totalForMonth(expenses, key) });
  }
  return out;
}

/** null when there is nothing to compare against — an honest "no data" beats
 *  a fabricated 0% or a division by zero rendering as Infinity. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
