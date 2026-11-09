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
import { PHONE, useMatchMedia } from "../../lib/useMatchMedia.js";
import FriendsIsland from "./FriendsIsland.jsx";
import { halves, resolve } from "../../lib/homeLayout.js";
import { useStore } from "../../store.jsx";
import { useNow } from "../../lib/useNow.js";

// three.js and react-three-fiber are more than half the app's JavaScript, and
// this is the only screen that renders them. Splitting them out means every
// other screen — and the login screen — stops paying for them.
// It isn't precached either (vite.config.js), so offline before it was ever
// fetched the import fails; show the flat Octi then rather than crash Home.
const OctopusMascot = lazy(() =>
  import("../mascot/OctopusMascot").catch(() => ({ default: StillMascot })),
);

function StillMascot({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mascot-button" onClick={onClick} aria-label="Open the assistant">
      <div className="mascot-stage">
        <img src="/mascot.png" alt="" className="intro-octi-still" />
      </div>
    </button>
  );
}

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
    state: {
      profileName: string;
      shortcuts: Shortcut[];
      timer: { endsAt: number } | null;
      homeLayout?: Record<string, { order?: string[]; hidden?: string[] }>;
    };
  };

  // Octi mirrors what you're doing: headphones on while a timer runs, asleep
  // late at night. Checked each minute so it wakes up on its own.
  const now = useNow(60_000);
  const profile = useMyProfile();
  const phone = useMatchMedia(PHONE);
  const hour = new Date(now).getHours();
  const mood =
    state.timer && state.timer.endsAt > now ? "focus" : hour >= 23 || hour < 6 ? "sleeping" : "idle";

  // Order and visibility come from Settings → Home layout (lib/homeLayout.js).
  const layout = resolve(state.homeLayout?.[phone ? "phone" : "wide"], phone ? "phone" : "wide");
  const shown = (id: string) => !layout.hidden.includes(id);
  const octiAt = layout.order.indexOf("octi");
  const left = layout.order.slice(0, octiAt).filter(shown);
  const right = layout.order.slice(octiAt + 1).filter(shown);
  const halfRow = halves(layout.order.filter(shown));

  function island(id: string) {
    switch (id) {
      case "octi":
        return (
          <div className="orbit-centre">
            {/* The stage keeps its size while the canvas loads, so nothing
                below it jumps when Octi arrives. */}
            <Suspense fallback={<div className="mascot-stage" />}>
              <OctopusMascot mood={mood} onClick={() => onGoTo("Assistant")} />
            </Suspense>
            {/* Phones only (theme.css): Octi shrinks to the side of this bar,
                which reads as the place to type, not a picture to admire. */}
            <button type="button" className="ask-octi" onClick={() => onGoTo("Assistant")}>
              Ask Octi anything…
            </button>
          </div>
        );
      case "tasks": return <TasksWidget onOpen={() => onGoTo("Tasks")} />;
      case "calendar": return <CalendarWidget onOpen={() => onGoTo("Calendar")} />;
      case "courses": return <CoursesWidget onOpen={() => onGoTo("Courses")} />;
      case "finance": return <FinanceWidget open={financeOpen} onToggle={onToggleFinance} />;
      case "friends": return <FriendsIsland />;
      case "timer": return <TimerWidget onOpen={() => onGoTo("Timers")} />;
      case "schedule": return <ScheduleWidget onOpen={() => onGoTo("Schedule")} />;
      case "notes": return <NotesWidget />;
      case "shortcuts":
        return (
          <div className="home-buttons">
            {state.shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                className="home-btn"
                onClick={() => openShortcut(shortcut.url)}
                title={shortcut.url}
              >
                {shortcut.iconUrl && <img src={shortcut.iconUrl} alt="" className="home-btn-icon" />}
                <span className="home-btn-name">{shortcut.name}</span>
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="home">
      <header className="home-top">
        <h2 className="home-hello">
          {profile && (
            <Link to="/friends" className="home-avatar" aria-label="Your profile">
              <Avatar profile={profile} size={44} />
            </Link>
          )}
          <span className="home-greeting">
            <span>
              Hello, <span className="home-name">{state.profileName || "there"}</span>
            </span>
            {/* Phones only (theme.css): the date sits where the eye lands first. */}
            <span className="home-date">
              {new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </span>
        </h2>
        {/* Home has no header, so Settings needs its own way in. Phones get
            Friends here as a round button; laptops get the island below. */}
        <div className="home-top-actions">
          <div className="home-top-stack">
            <SettingsButton />
            {phone && <FriendsIsland compact />}
          </div>
        </div>
      </header>

      {/* Above everything, because it is the question people open the app
          with. Draws nothing on a quiet day rather than showing empty zeros. */}
      <TodayStrip />

      <div className="home-orbit">
        {phone ? (
          // Phones: one column in the saved order, Octi's bar wherever it was put.
          layout.order.filter(shown).map((id) => (
            <div key={id} className={halfRow.has(id) ? "island half" : "island"}>{island(id)}</div>
          ))
        ) : (
          // Laptops: islands before Octi go left, after him right.
          <>
            <div className="orbit-col">{left.map((id) => <div key={id} className="island">{island(id)}</div>)}</div>
            {island("octi")}
            <div className="orbit-col">{right.map((id) => <div key={id} className="island">{island(id)}</div>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
