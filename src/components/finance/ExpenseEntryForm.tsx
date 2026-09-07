import { useId, useState } from "react";
import { todayKey } from "../../dates.js";
import type { Expense } from "./useExpenses";

type Props = {
  categories: string[];
  onAdd: (expense: Omit<Expense, "id">) => void;
};

export default function ExpenseEntryForm({ categories, onAdd }: Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // useId keeps the datalist id unique if this form is ever rendered twice.
  const listId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return setError("Enter an amount greater than zero.");
    }
    if (!category.trim()) return setError("Give it a category.");
    if (!date) return setError("Pick a date.");

    onAdd({
      amount: value,
      // Normalised so "Food", "food" and " food " don't become three
      // categories in the autocomplete and three slices in the donut.
      category: normalise(category, categories),
      date,
      note: note.trim() || undefined,
    });

    setAmount("");
    setCategory("");
    setNote("");
    setError("");
  }

  return (
    <form className="fin-form" onSubmit={submit}>
      <div className="row">
        <input
          className="fin-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* A native <datalist> is the whole autocomplete: it suggests while
            still allowing any free-text value, needs no library, and gets
            keyboard and screen-reader behaviour from the browser. */}
        <input
          className="grow"
          list={listId}
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          autoComplete="off"
        />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="row">
        <input
          className="grow"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="primary">Add expense</button>
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  );
}

/** Reuse an existing category's capitalisation when the typed text matches it
 *  case-insensitively; otherwise keep what the user typed. */
function normalise(input: string, known: string[]) {
  const trimmed = input.trim().replace(/\s+/g, " ");
  const match = known.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}
