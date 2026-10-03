import { useStore } from "../../store.jsx";
import { todayKey } from "../../dates.js";
import { useNow } from "../../useNow.js";
import { hour } from "./TodayStrip";

type Event = { id: string; date: string; time: string; title: string };
type Block = { id: string; day: number; startHour: number; endHour: number; title: string };
type Course = { id: string; name: string; color: string };
type Task = { id: string; done: boolean; courseId?: string };

const SHOWN = 4;

/**
 * Makes a whole widget open its section on click. Clicks on the widget's own
 * controls (a checkbox, a start button, a note) still do their own thing.
 */
export function openable(onOpen: () => void, label: string) {
  return {
    role: "link",
    tabIndex: 0,
    "aria-label": label,
    onClick: (e: React.MouseEvent) => {
      if (!(e.target as Element).closest("button, input, a, select, textarea, label")) onOpen();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
    },
  };
}

/** The frame these widgets share: a label and a body, the whole thing a link. */
function Widget({ title, onOpen, children }: { title: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <section className="widget widget-open" {...openable(onOpen, `Open ${title}`)}>
      <header className="widget-head">
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

/** The next few events from today on. */
export function CalendarWidget({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore() as { state: { events: Event[] } };
  const today = todayKey();
  const upcoming = state.events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, SHOWN);

  return (
    <Widget title="Calendar" onOpen={onOpen}>
      {upcoming.length === 0 ? (
        <p className="placeholder">Nothing coming up.</p>
      ) : (
        <ul className="list widget-rows">
          {upcoming.map((e) => (
            <li key={e.id} className="item">
              <span className="grow">{e.title}</span>
              <span className="chip">{e.date === today ? "Today" : shortDate(e.date)}{e.time && ` · ${e.time}`}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/** Today's routine, with whatever is on right now marked. */
export function ScheduleWidget({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore() as { state: { scheduleBlocks: Block[] } };
  const now = new Date(useNow(60_000));
  const at = now.getHours() + now.getMinutes() / 60;
  const todays = state.scheduleBlocks
    .filter((b) => b.day === now.getDay() && b.endHour > at)
    .sort((a, b) => a.startHour - b.startHour)
    .slice(0, SHOWN);

  return (
    <Widget title="Today's schedule" onOpen={onOpen}>
      {todays.length === 0 ? (
        <p className="placeholder">Nothing else scheduled today.</p>
      ) : (
        <ul className="list widget-rows">
          {todays.map((b) => (
            <li key={b.id} className={b.startHour <= at ? "item live" : "item"}>
              <span className="grow">{b.title}</span>
              <span className="chip">{b.startHour <= at ? "Now" : hour(b.startHour)}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/** Each subject with how much is still open on it. */
export function CoursesWidget({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore() as { state: { courses: Course[]; tasks: Task[] } };

  return (
    <Widget title="Courses" onOpen={onOpen}>
      {state.courses.length === 0 ? (
        <p className="placeholder">No subjects yet.</p>
      ) : (
        <ul className="list widget-rows">
          {state.courses.map((c) => {
            const open = state.tasks.filter((t) => !t.done && t.courseId === c.id).length;
            return (
              <li key={c.id} className="item">
                <span className="course-dot" style={{ background: c.color }} />
                <span className="grow">{c.name}</span>
                {open > 0 && <span className="chip">{open} open</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
