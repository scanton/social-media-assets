import { CUES } from "./kit/feedback.js";

/**
 * Sound cues the app adds on top of the kit's pack.
 *
 * WHY REGISTER INTO THE KIT'S TABLE RATHER THAN KEEP OUR OWN
 * `createPlayer()` closes over the kit's `CUES` and looks a key up there when
 * it loads a buffer, so a cue we hold in a separate table simply would not
 * play. The two honest ways out are to fork the kit or to extend its table;
 * this is the second. `CUES` is a plain object, so adding a key is enough, and
 * every reader — the player, the export mixer, the picker — sees one table.
 *
 * WHY NOT A PATCH IN scripts/patch-popkit.mjs
 * That file is for fixes owed *back* to the kit: `--dir` replays them into a
 * skill tree so v11 can ship them and the fork can end. These are HeartStamp's
 * own sounds, not a defect in the shared design system, and pushing them
 * upstream would put our bubble pops in everybody's kit. Registering at
 * runtime also means a re-sync cannot revert them and `--check` stays green.
 *
 * IMPORT THIS MODULE, NOT `kit/feedback.js`, anywhere the table is read. Doing
 * so is what guarantees the registration has run first: a module that reads
 * `CUES` at module scope — the picker builds its length map that way — would
 * otherwise race the side effect below and miss these two.
 */

interface CueSpec {
  file: string | null;
  /** Length of the file, used by the picker to say how long a cue runs. */
  ms: number;
  /** Playback level. The files are full scale; this table owns the mix. */
  gain: number;
  desc: string;
}

/*
 * Both were supplied as MP3s that were mostly silence — 188ms of it before the
 * transient on the first, 112ms on the second — and the player starts a buffer
 * at the beat with no offset, so untrimmed they would have landed that far
 * behind the animation. Rebuilt from the originals with:
 *
 *   ffmpeg -i bubble-popN.mp3 -af "pan=mono|c0=0.5*c0+0.5*c1,
 *     silenceremove=start_periods=1:start_threshold=-50dB:detection=peak,
 *     atrim=end=0.140,afade=t=out:st=0.115:d=0.025:curve=tri"
 *     -ar 48000 -sample_fmt s16 -ac 1 bubble-pop-N.wav
 *
 * Mono 48k/16 to match the rest of the pack, full scale because this table
 * owns the mix. 140ms because both pops are spent by 100ms: past that the
 * first is at its noise floor and the second had a stray second event around
 * 380ms that only muddied a dense deck.
 */
const EXTRA: Record<string, CueSpec> = {
  "bubble-pop-1": {
    file: "bubble-pop-1.wav",
    ms: 140,
    gain: 0.62,
    desc: "Bubble pop. Wet, round, a little playful. The default nugget entrance.",
  },
  "bubble-pop-2": {
    file: "bubble-pop-2.wav",
    ms: 140,
    gain: 0.62,
    desc: "Same bubble, drier and shorter. Arrows, and an alternate for repeats.",
  },
};

const TABLE = CUES as Record<string, CueSpec>;
for (const [key, spec] of Object.entries(EXTRA)) TABLE[key] ??= spec;

/** The one table, kit cues and ours together. */
export const CUE_TABLE = TABLE;

/** Cue lengths, so the picker can say how long each one runs. */
export const CUE_MS: Record<string, number> = Object.fromEntries(
  Object.entries(TABLE).map(([k, v]) => [k, v.ms]),
);

/**
 * What a new nugget or well opens with.
 *
 * Named rather than written at each call site: there are three places a beat
 * gets built, and they drifted apart the last time this was a literal.
 */
export const DEFAULT_CUE = "bubble-pop-1";

/**
 * What a bare arrow opens with.
 *
 * Its own constant because an arrow is its own kind of beat — it points rather
 * than arrives, and the kit gave it `paper-slide` for that reason. Now the
 * drier of the two pops, so a pointer and the caption it leads still read as
 * two moments rather than the same sound twice.
 */
export const DEFAULT_ARROW_CUE = "bubble-pop-2";
