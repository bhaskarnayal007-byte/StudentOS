/**
 * The STRATUS wordmark, from the Figma file (node 3:2): seven monoline
 * geometric letters, stroked in currentColor. Each letter is its own path with
 * pathLength=1, so CSS can draw them in one after another (--i).
 */
const LETTERS = [
  "M140 74H92L82 88L130 134H82L92 146H140L150 132L102 86H146L140 74Z",
  "M182 74H254M182 88H254M218 88V146",
  "M288 146V74M288 74H327C346 74 356 85 356 101C356 117 345 124 325 124L288 74ZM288 94L355 146",
  "M394 146L430 74L466 146H394Z",
  "M500 74H572M500 88H572M536 88V146",
  "M606 74V116C606 136 617 146 640 146C663 146 674 136 674 116V74",
  "M776 74H728L718 88L766 134H718L728 146H776L786 132L738 86H782L776 74Z",
];

export default function StratusWordmark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="78 70 712 80"
      className={`wordmark${className ? ` ${className}` : ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    >
      {LETTERS.map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ "--i": i } as React.CSSProperties} />
      ))}
    </svg>
  );
}
