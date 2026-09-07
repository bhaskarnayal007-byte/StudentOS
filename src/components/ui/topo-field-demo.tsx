import TopoField from "@/components/ui/topo-field";

/**
 * Upstream this demo was written with Tailwind utility classes
 * (`relative h-[600px] w-full overflow-hidden rounded-xl bg-black`...).
 * Tailwind is NOT installed in this project — it uses a hand-built CSS token
 * system — so those classes would render as inert strings and the demo would
 * be an unstyled block. The equivalent styling lives in theme.css under
 * `.topo-demo`; see the note in the integration summary for how to switch
 * back to Tailwind if you ever add it.
 */
export default function TopoFieldDemo() {
  return (
    <div className="topo-demo">
      {/* mode="auto" reads data-theme off <html> — the same attribute this
          app's theme toggle writes — so the field follows light/dark with it. */}
      <TopoField className="topo-demo-field" mode="auto" speed={0.8} />
      <div className="topo-demo-caption">
        <p>Animated topographic background</p>
      </div>
    </div>
  );
}
