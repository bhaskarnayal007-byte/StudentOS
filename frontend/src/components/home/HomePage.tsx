import FinanceWidget from "./FinanceWidget";
import NotesWidget from "./NotesWidget";
import { CalendarWidget, CoursesWidget, ScheduleWidget } from "./SectionWidgets";
import TasksWidget from "./TasksWidget";
import TimerWidget from "./TimerWidget";
import TodayStrip from "./TodayStrip";
import { Suspense, lazy } from "react";
import { openShortcut } from "../AppLauncherSidebar.jsx";
import { SettingsButton } from "../../App.jsx";
import { Link } from "react-router-dom";
import Avatar from "../Avatar.jsx";
import { useMyProfile } from "../../lib/social.js";
import { useStore } from "../../store.jsx";
import { useNow } from "../../useNow.js";

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
  const profile = useMyProfile();
  const hour = new Date(now).getHours();
  const mood =
    state.timer && state.timer.endsAt > now ? "focus" : hour >= 23 || hour < 6 ? "sleeping" : "idle";

  return (
    <div className="home">
      <header className="home-top">
        <h2 className="home-hello">
          {profile && (
            <Link to="/friends" className="home-avatar" aria-label="Your profile">
              <Avatar profile={profile} size={44} />
            </Link>
          )}
          <span>
            Hello, <span className="home-name">{state.profileName || "there"}</span>
          </span>
        </h2>
        {/* Home has no header, so Friends and Settings need their own way in. */}
        <div className="home-top-actions">
          <Link to="/friends" className="theme-toggle friends-btn" aria-label="Friends" title="Friends">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Friends</span>
          </Link>
          <SettingsButton />
        </div>
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

    </div>
  );
}
