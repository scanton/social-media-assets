/**
 * Class-name joiner.
 *
 * Lives in its own module rather than in `ui.tsx` because HelpTip needs it and
 * `ui.tsx` needs HelpTip — importing it from there would make the two files
 * circular for the sake of a two-line function.
 */
export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
