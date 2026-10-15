// Pure, React-free pause-episode reducer and pause formatters (D-24: no
// React import, no .tsx import). Driven only by the commandQueue.runState
// poll envelope — this module never reads or writes any of the queue's
// own UIMessage bookkeeping, and never sends a command (D-10).
import type { PauseState, RunStateEnvelope } from "@/server/runState";
import { formatClock } from "./controlDecision";

// D-11: a pause episode is keyed by queueId plus pause.startedAt, falling
// back to name+code (queueId stays in the fallback so a new step is always a
// new episode even with identical name/code and no startedAt).
export function pauseEpisodeKey(envelope: RunStateEnvelope | undefined): string | null {
  if (envelope === undefined || !envelope.running) {
    return null;
  }
  const pause = envelope.runState?.pause ?? null;
  if (pause === null) {
    return null;
  }
  if (pause.startedAt !== null) {
    return `${envelope.queueId}:${pause.startedAt}`;
  }
  return `${envelope.queueId}:${pause.name ?? "unknown"}:${pause.code ?? "unknown"}`;
}

export interface PausePromptState {
  isOpen: boolean;
  episodeKey: string | null;
  queueId: number | null;
  pause: PauseState | null;
}

export const INITIAL_PAUSE_PROMPT: PausePromptState = {
  isOpen: false,
  episodeKey: null,
  queueId: null,
  pause: null,
};

export type PausePromptEvent =
  | { type: "poll"; envelope: RunStateEnvelope | undefined }
  | { type: "hide" }
  | { type: "reopen" };

export type PausePromptClosedBy = "resumed" | "step-ended" | null;

export interface ReducePausePromptResult {
  state: PausePromptState;
  closedBy: PausePromptClosedBy;
}

function pauseEqual(a: PauseState | null, b: PauseState | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.name === b.name &&
    a.code === b.code &&
    a.startedAt === b.startedAt &&
    jsonEqual(a.detail, b.detail)
  );
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// D-11..D-13: the full closing-rule order. A poll whose envelope has a
// pause with a key different from state.episodeKey opens the prompt; the
// same key keeps isOpen as it is and refreshes pause. The run resuming,
// the step ending or the step changing all close a tracked episode (D-12);
// an "unknown" poll never closes one (D-13). Unchanged results return the
// identical state object (referential equality) so effects do not loop.
function reducePoll(
  state: PausePromptState,
  envelope: RunStateEnvelope | undefined,
): ReducePausePromptResult {
  if (envelope === undefined) {
    return { state, closedBy: null };
  }

  const episodeTracked = state.episodeKey !== null;

  if (!envelope.running) {
    if (episodeTracked) {
      return { state: INITIAL_PAUSE_PROMPT, closedBy: "step-ended" };
    }
    return { state, closedBy: null };
  }

  if (episodeTracked && state.queueId !== null && state.queueId !== envelope.queueId) {
    const fromInitial = reducePoll(INITIAL_PAUSE_PROMPT, envelope);
    return { state: fromInitial.state, closedBy: "step-ended" };
  }

  const pause = envelope.runState?.pause ?? null;

  if (pause === null) {
    if (envelope.status === "ok") {
      if (episodeTracked) {
        return {
          state: { ...INITIAL_PAUSE_PROMPT, queueId: envelope.queueId },
          closedBy: "resumed",
        };
      }
      if (state.queueId === envelope.queueId) {
        return { state, closedBy: null };
      }
      return { state: { ...state, queueId: envelope.queueId }, closedBy: null };
    }
    // D-13: status "unknown" never closes the prompt.
    return { state, closedBy: null };
  }

  const key = pauseEpisodeKey(envelope);
  if (key === state.episodeKey) {
    if (state.queueId === envelope.queueId && pauseEqual(state.pause, pause)) {
      return { state, closedBy: null };
    }
    return { state: { ...state, queueId: envelope.queueId, pause }, closedBy: null };
  }

  return {
    state: { isOpen: true, episodeKey: key, queueId: envelope.queueId, pause },
    closedBy: null,
  };
}

export function reducePausePrompt(
  state: PausePromptState,
  event: PausePromptEvent,
): ReducePausePromptResult {
  if (event.type === "hide") {
    if (!state.isOpen) {
      return { state, closedBy: null };
    }
    return { state: { ...state, isOpen: false }, closedBy: null };
  }

  if (event.type === "reopen") {
    if (state.pause === null || state.isOpen) {
      return { state, closedBy: null };
    }
    return { state: { ...state, isOpen: true }, closedBy: null };
  }

  return reducePoll(state, event.envelope);
}

// D-14: "{name} ({code})", or whichever of name/code exists.
export function formatPauseReason(pause: PauseState | null): string | null {
  if (pause === null) {
    return null;
  }
  const { name, code } = pause;
  if (name !== null && code !== null) {
    return `${name} (${code})`;
  }
  if (name !== null) {
    return name;
  }
  if (code !== null) {
    return `Error code ${code}`;
  }
  return null;
}

export interface PauseDetailDescription {
  lines: string[];
  raw: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// -1 is the instrument's no-plate-detected sentinel.
function isNoPlateDetected(value: unknown): boolean {
  return value === null || value === undefined || value === "" || value === -1;
}

function describeWrongDetectionEntry(entry: unknown): string | null {
  if (!isPlainObject(entry)) {
    return null;
  }
  const position = entry["position"];
  const expectedPlateID = entry["expectedPlateID"];
  if (position === undefined || expectedPlateID === undefined) {
    return null;
  }
  const detectedRaw = entry["detectedPlateID"];
  const found = isNoPlateDetected(detectedRaw) ? "none" : String(detectedRaw);
  return `Deck ${position}: expected plate ${expectedPlateID}, found ${found}`;
}

// D-14/D-09 (T-02-09): never return an empty result for non-null detail.
// Known wrongDetection shapes render in plain language; everything else
// falls back to pretty-printed JSON so nothing is ever dropped.
export function describePauseDetail(detail: unknown): PauseDetailDescription {
  if (detail === null || detail === undefined) {
    return { lines: [], raw: null };
  }
  if (typeof detail === "string") {
    return { lines: [detail], raw: null };
  }
  if (typeof detail === "number" || typeof detail === "boolean") {
    return { lines: [String(detail)], raw: null };
  }

  if (isPlainObject(detail)) {
    const wrongDetection = detail["wrongDetection"];
    if (Array.isArray(wrongDetection)) {
      const lines: string[] = [];
      let allProducedLines = true;
      for (const entry of wrongDetection) {
        const line = describeWrongDetectionEntry(entry);
        if (line === null) {
          allProducedLines = false;
        } else {
          lines.push(line);
        }
      }
      const onlyKey = Object.keys(detail).length === 1;
      if (onlyKey && allProducedLines && lines.length > 0) {
        return { lines, raw: null };
      }
      return { lines, raw: prettyJson(detail) };
    }
    return { lines: [], raw: prettyJson(detail) };
  }

  // Arrays and anything else fall back to pretty JSON, never dropped.
  return { lines: [], raw: prettyJson(detail) };
}

// D-14: local clock time plus relative age, e.g. "10:42:05, 3 min ago".
export function formatPauseStartedAt(startedAt: string | null, nowMs: number): string | null {
  if (startedAt === null) {
    return null;
  }
  const ms = Date.parse(startedAt);
  if (Number.isNaN(ms)) {
    return startedAt;
  }

  const diffSec = (nowMs - ms) / 1000;
  let age: string;
  if (diffSec < 60) {
    // Includes clock skew into the future.
    age = "less than a minute ago";
  } else {
    const totalMinutes = Math.floor(diffSec / 60);
    if (totalMinutes < 60) {
      age = `${totalMinutes} min ago`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      age = `${hours} h ${minutes} min ago`;
    }
  }

  return `${formatClock(ms)}, ${age}`;
}
