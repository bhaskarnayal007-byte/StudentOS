import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { byCategory, currentMonthKey, formatMoney, type Expense } from "./useExpenses";

// No new colours: the largest slice takes the accent, and everything else is
// the existing text token stepped down in opacity. Because these are real CSS
// variables in the SVG's fill, they re-resolve on theme change for free.
const SLICE_FILLS = [
  "var(--color-accent)",
  "color-mix(in srgb, var(--color-text) 52%, transparent)",
  "color-mix(in srgb, var(--color-text) 38%, transparent)",
  "color-mix(in srgb, var(--color-text) 28%, transparent)",
  "color-mix(in srgb, var(--color-text) 20%, transparent)",
  "color-mix(in srgb, var(--color-text) 14%, transparent)",
];

const fillFor = (index: number) => SLICE_FILLS[Math.min(index, SLICE_FILLS.length - 1)];

export default function CategoryBreakdownChart({ expenses }: { expenses: Expense[] }) {
  const data = byCategory(expenses, currentMonthKey());
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <section className="fin-card">
      <h4 className="fin-card-title">This month by category</h4>

      {data.length === 0 ? (
        <p className="placeholder">Nothing logged this month yet.</p>
      ) : (
        <div className="fin-donut-row">
          <div className="fin-donut">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.category} fill={fillFor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label. Absolutely positioned rather than an SVG <text>,
                so it inherits the app's serif and text colour directly. */}
            <div className="fin-donut-centre">
              <span className="fin-muted">total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          <ul className="fin-legend">
            {data.map((entry, i) => (
              <li key={entry.category}>
                <span className="fin-swatch" style={{ background: fillFor(i) }} />
                <span className="fin-legend-name">{entry.category}</span>
                <span className="fin-muted">
                  {total > 0 ? Math.round((entry.amount / total) * 100) : 0}%
                </span>
                <strong>{formatMoney(entry.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CategoryTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value = 0 } = payload[0];
  return (
    <div className="fin-tooltip">
      <strong>{name}</strong>
      <span>
        {formatMoney(value)} · {total > 0 ? Math.round((value / total) * 100) : 0}%
      </span>
    </div>
  );
}
