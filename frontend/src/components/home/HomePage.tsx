import FinanceWidget from "./FinanceWidget";
import NotesWidget from "./NotesWidget";
import { CalendarWidget, CoursesWidget, ScheduleWidget } from "./SectionWidgets";
import TasksWidget from "./TasksWidget";
import TimerWidget from "./TimerWidget";
import TodayStrip from "./TodayStrip";
import { Suspense, lazy } from "react";
import { openShortcut } from "../AppLauncherSidebar.jsx";
import { ThemeToggle } from "../../App.jsx";
import { useStore } from "../../store.jsx";
import { useNow } from "../../useNow.js";
import { Copyright } from "../Legal";

// three.js and react-three-fiber are more than half the app's JavaScript, and
// this is the only screen that renders them. Splitting them out means every
// other screen — and the login screen — stops paying for them.
const OctopusMascot = lazy(() => import("../mascot/OctopusMascot"));

type Shortcut = { id: string; name: string; url: string; iconUrl: string };

type Props = {
  financeOpen: boolean;
  onToggleFinance: () => void;
  onGoTo: (tab: string) => void;
};

/**
 * The mascot is the centre of the screen and the way into the assistant;
 * everything else orbits it. Two flanking columns on a wide screen, a single
 * stack on a narrow one with the mascot still first.
 */
export default function HomePage({ financeOpen, onToggleFinance, onGoTo }: Props) {
  const { state } = useStore() as {
    state: { profileName: string; shortcuts: Shortcut[]; timer: { endsAt: number } | null };
  };

  // Octi mirrors what you're doing: headphones on while a timer runs, asleep
  // late at night. Checked each minute so it wakes up on its own.
  const now = useNow(60_000);
  const hour = new Date(now).getHours();
  const mood =
    state.timer && state.timer.endsAt > now ? "focus" : hour >= 23 || hour < 6 ? "sleeping" : "idle";

  return (
    <div className="home">
      <header className="home-top">
        <h2>
          Hello, <span className="home-name">{state.profileName || "there"}</span>
        </h2>
        {/* The theme control lives in the header Home no longer renders, so it
            needs a place here or it becomes unreachable from this screen. */}
        <ThemeToggle />
      </header>

      {/* Above everything, because it is the question people open the app
          with. Draws nothing on a quiet day rather than showing empty zeros. */}
      <TodayStrip />

      <div className="home-orbit">
        <div className="orbit-col">
          <TasksWidget onOpen={() => onGoTo("Tasks")} />
          <CalendarWidget onOpen={() => onGoTo("Calendar")} />
          <CoursesWidget onOpen={() => onGoTo("Courses")} />
          <FinanceWidget open={financeOpen} onToggle={onToggleFinance} />
        </div>

        <div className="orbit-centre">
          {/* The stage keeps its size while the canvas loads, so nothing
              below it jumps when Octi arrives. */}
          <Suspense fallback={<div className="mascot-stage" />}>
            <OctopusMascot mood={mood} onClick={() => onGoTo("Assistant")} />
          </Suspense>
        </div>

        <div className="orbit-col">
          <TimerWidget onOpen={() => onGoTo("Timers")} />
          <ScheduleWidget onOpen={() => onGoTo("Schedule")} />
          <NotesWidget />

          <div className="home-buttons">
            {state.shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                className="home-btn"
                onClick={() => openShortcut(shortcut.url)}
                title={shortcut.url}
              >
                {shortcut.iconUrl && (
                  <img src={shortcut.iconUrl} alt="" className="home-btn-icon" />
                )}
                <span className="home-btn-name">{shortcut.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Copyright />
    </div>
  );
}
