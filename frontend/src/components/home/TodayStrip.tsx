import { useStore } from "../../store.jsx";
import { todayKey } from "../../dates.js";
import { useNow } from "../../useNow.js";

type Task = { id: string; text: string; done: boolean; due: string; courseId?: string };
type Event = { id: string; date: string; time: string; title: string };
type Block = { id: string; day: number; startHour: number; endHour: number; title: string };

/**
 * The one line that answers "what do I have to deal with right now".
 *
 * Everything here is derived from data the app already holds — nothing new is
 * stored. It reads the way a student would ask: what's late, what's due today,
 * what's next.
 */
export default function TodayStrip() {
  const { state } = useStore() as {
    state: { tasks: Task[]; events: Event[]; scheduleBlocks: Block[] };
  };
  // Re-renders on the minute so "next" doesn't go stale while the page is open.
  // useNow hands back a timestamp, not a Date.
  const now = new Date(useNow(60_000));
  const today = todayKey();

  const open = state.tasks.filter((t) => !t.done && t.due);
  const overdue = open.filter((t) => t.due < today);
  const dueToday = open.filter((t) => t.due === today);
  const eventsToday = state.events.filter((e) => e.date === today);
  const next = nextBlock(state.scheduleBlocks, now);

  // Nothing to report is worth saying plainly rather than showing an empty bar.
  const quiet = !overdue.length && !dueToday.length && !eventsToday.length && !next;
  if (quiet) return null;

  return (
    <section className="today-strip" aria-label="Today">
      {overdue.length > 0 && (
        <span className="today-cell today-late">
          <strong>{overdue.length}</strong> overdue
        </span>
      )}

      {dueToday.length > 0 && (
        <span className="today-cell">
          <strong>{dueToday.length}</strong> due today
        </span>
      )}

      {eventsToday.length > 0 && (
        <span className="today-cell">
          <strong>{eventsToday.length}</strong> {eventsToday.length === 1 ? "event" : "events"}
        </span>
      )}

      {next && (
        <span className="today-cell today-next">
          {next.live ? "Now" : "Next"} · {next.title}
          {!next.live && ` at ${hour(next.startHour)}`}
        </span>
      )}
    </section>
  );
}

/**
 * The block happening now, or the next one later today.
 *
 * Deliberately today-only: "next" meaning a lecture four days away is not
 * information anyone acts on, and saying nothing is better than filling the
 * space with it.
 */
function nextBlock(blocks: Block[], now: Date) {
  const day = now.getDay();
  // Fractional hours, so a 09:30 start is correctly still ahead at 09:15.
  const at = now.getHours() + now.getMinutes() / 60;

  const todays = blocks.filter((b) => b.day === day);
  const live = todays.find((b) => at >= b.startHour && at < b.endHour);
  if (live) return { ...live, live: true };

  const later = todays
    .filter((b) => b.startHour > at)
    .sort((a, b) => a.startHour - b.startHour)[0];

  return later ? { ...later, live: false } : null;
}

export function hour(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
