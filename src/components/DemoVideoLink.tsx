import { DEMO_VIDEOS, type DemoTool } from "@/lib/demo-videos";
import { cx } from "./cx";

/** The camera glyph the help tooltips use for their walkthrough links. */
export function VideoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className ?? "h-3.5 w-3.5"} fill="currentColor">
      <path d="M2 4.2A1.7 1.7 0 0 1 3.7 2.5h5.1a1.7 1.7 0 0 1 1.7 1.7v7.6a1.7 1.7 0 0 1-1.7 1.7H3.7A1.7 1.7 0 0 1 2 11.8V4.2Zm9.9 2.6 2.5-1.6a.5.5 0 0 1 .8.4v4.8a.5.5 0 0 1-.8.4l-2.5-1.6V6.8Z" />
    </svg>
  );
}

/** "Watch the demo" for a tool, opening its walkthrough in a new tab. */
export function DemoVideoLink({ tool, className }: { tool: DemoTool; className?: string }) {
  const video = DEMO_VIDEOS[tool];
  if (!video) return null;
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Watch the ${video.label} demo (opens in a new tab)`}
      className={cx(
        "focus-stamp inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stamp-200 bg-stamp-50 px-3 py-1.5 text-xs font-bold text-stamp-700 transition-colors hover:border-stamp-300 hover:bg-stamp-100",
        className,
      )}
    >
      <VideoIcon />
      Watch the demo
      <span className="sr-only"> of {video.label} (opens in a new tab)</span>
    </a>
  );
}
