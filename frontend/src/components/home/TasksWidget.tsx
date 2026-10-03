import { useStore } from "../../store.jsx";
import { openable } from "./SectionWidgets";

type Task = {
  id: string;
  text: string;
  done: boolean;
  due: string;
  priority: string;
};

const SHOWN = 4;

/** Live view of the same tasks as the Tasks tab — same store, same actions,
 *  so ticking one here is identical to ticking it there. */
export default function TasksWidget({ onOpen }: { onOpen: () => void }) {
  const { state, dispatch } = useStore() as {
    state: { tasks: Task[] };
    dispatch: (action: unknown) => void;
  };

  const open = state.tasks.filter((t) => !t.done);
  const shown = [...open]
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
    .slice(0, SHOWN);

  return (
    <section className="widget widget-open" {...openable(onOpen, "Open Tasks")}>
      <header className="widget-head">
        <h3>Tasks</h3>
      </header>

      {shown.length === 0 ? (
        <p className="placeholder">Nothing outstanding. Nice.</p>
      ) : (
        <ul className="list widget-tasks">
          {shown.map((task) => (
            <li key={task.id} className="item">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => dispatch({ type: "toggle-task", id: task.id })}
                aria-label={`Mark "${task.text}" done`}
              />
              <span className="grow">{task.text}</span>
              {task.priority === "high" && <span className="chip high">high</span>}
              {task.due && <span className="chip">{shortDate(task.due)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
