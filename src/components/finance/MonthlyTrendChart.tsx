import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currentMonthKey, formatMoney, monthlyTotals, type Expense } from "./useExpenses";

const MONTHS = 6;

export default function MonthlyTrendChart({ expenses }: { expenses: Expense[] }) {
  const data = monthlyTotals(expenses, MONTHS);
  const current = currentMonthKey();
  const hasAny = data.some((d) => d.total > 0);

  return (
    <section className="fin-card">
      <h4 className="fin-card-title">Last {MONTHS} months</h4>

      {!hasAny ? (
        <p className="placeholder">No spending recorded yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              tick={{ fill: "var(--color-text-3)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={54}
              tick={{ fill: "var(--color-text-3)", fontSize: 11 }}
              // Compact ticks so long currency strings don't eat the plot area.
              // Keep one decimal: recharts picks ticks like 2467 and 3290, and
              // rounding both to whole thousands renders "3k" twice.
              tickFormatter={(v: number) =>
                v >= 1000
                  ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
                  : String(Math.round(v))
              }
            />
            <Tooltip
              cursor={{ fill: "var(--color-accent-wash)" }}
              content={<TrendTooltip />}
            />
            <Bar dataKey="total" radius={[5, 5, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                // The current month is the highlight; earlier months recede.
                <Cell
                  key={d.key}
                  fill={
                    d.key === current
                      ? "var(--color-accent)"
                      : "color-mix(in srgb, var(--color-text) 26%, transparent)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="fin-tooltip">
      <strong>{label}</strong>
      <span>{formatMoney(payload[0].value ?? 0)}</span>
    </div>
  );
}
