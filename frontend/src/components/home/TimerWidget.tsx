import { useStore } from "../../store.jsx";
import { openable } from "./SectionWidgets";
import { useNow } from "../../useNow.js";
import { formatRemaining } from "../Timers.jsx";

const QUICK_MINUTES = 25;

type Timer = { endsAt: number; label: string } | null;

/**
 * Starts and shows the SAME timer as the Timers tab — one `state.timer`, so
 * a countdown started here is the one that rings, wherever you are.
 */
export default function TimerWidget({ onOpen }: { onOpen: () => void }) {
  const { state, dispatch } = useStore() as {
    state: { timer: Timer };
    dispatch: (action: unknown) => void;
  };

  // Ticks this widget once a second; harmless when no timer is running.
  useNow();

  const timer = state.timer;
  // Read the clock here rather than trusting the tick value, which can be up
  // to a second stale — see the note in Timers.jsx.
  const remaining = timer ? timer.endsAt - Date.now() : 0;
  const done = Boolean(timer) && remaining <= 0;

  return (
    <section className="widget widget-timer widget-open" {...openable(onOpen, "Open Timers")}>
      <header className="widget-head">
        <h3>Timer</h3>
      </header>

      {timer ? (
        <div className="widget-countdown">
          <strong className={done ? "widget-clock finished" : "widget-clock"}>
            {formatRemaining(remaining)}
          </strong>
          <span className="fin-muted">{done ? `${timer.label} — done` : timer.label}</span>
          <button onClick={() => dispatch({ type: "clear-timer" })}>
            {done ? "Dismiss" : "Cancel"}
          </button>
        </div>
      ) : (
        <button
          className="primary widget-start"
          onClick={() =>
            dispatch({
              type: "start-timer",
              endsAt: Date.now() + QUICK_MINUTES * 60_000,
              label: "Focus",
            })
          }
        >
          Start {QUICK_MINUTES} min focus
        </button>
      )}
    </section>
  );
}
