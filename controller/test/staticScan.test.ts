import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Source-scan invariants for UI-08 (D-24): prove, over the real sources, that
// every client control send goes through the confirmed-send hook used only
// by the confirm modal's Confirm handler, and that the server has exactly
// two controlCommand callers. No new dependencies (D-24) — node fs/path
// only.

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "gen-interfaces"]);

// Recursive list of .ts/.tsx files under `dir` (relative to ROOT), skipping
// node_modules, .next and gen-interfaces at any depth.
function walk(dir: string): string[] {
  const results: string[] = [];

  function recurse(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        recurse(full);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        results.push(full);
      }
    }
  }

  recurse(path.join(ROOT, dir));
  return results;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// Path relative to ROOT, forward-slashed, for exact-list assertions.
function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

// Removes block and line comments while preserving string/template literal
// contents verbatim (so "http://host" inside a string is never mistaken for
// the start of a line comment). This makes the scans below assert on code,
// not on prose in comments.
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    const next = i + 1 < n ? src[i + 1] : "";

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      let str = ch;
      while (j < n) {
        const c = src[j];
        str += c;
        if (c === "\\" && j + 1 < n) {
          j += 1;
          str += src[j];
          j += 1;
          continue;
        }
        j += 1;
        if (c === quote) {
          break;
        }
      }
      out += str;
      i = j;
      continue;
    }

    if (ch === "/" && next === "/") {
      let j = i + 2;
      while (j < n && src[j] !== "\n") {
        j += 1;
      }
      i = j;
      continue;
    }

    if (ch === "/" && next === "*") {
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) {
        j += 1;
      }
      i = j + 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

// Extracts a braced declaration (function body or interface body) from its
// declaration keyword through its own matching closing brace, skipping any
// braces that appear inside the parameter list (e.g. a `= {}` default) and
// transparently stepping past an object-type return annotation (`): { ... }
// { actual body }`) to land on the real body.
function extractBracedRegion(src: string, declPattern: RegExp): string {
  const declMatch = declPattern.exec(src);
  if (!declMatch) {
    return "";
  }
  const startIdx = declMatch.index;

  function findBraceGroup(fromIdx: number): { start: number; end: number } | null {
    let parenDepth = 0;
    let braceStart = -1;
    let i = fromIdx;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === "(") {
        parenDepth += 1;
      } else if (c === ")") {
        parenDepth -= 1;
      } else if (c === "{" && parenDepth === 0) {
        braceStart = i;
        break;
      }
    }
    if (braceStart === -1) {
      return null;
    }
    let depth = 0;
    let j = braceStart;
    for (; j < src.length; j += 1) {
      if (src[j] === "{") {
        depth += 1;
      } else if (src[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    return { start: braceStart, end: j };
  }

  let group = findBraceGroup(startIdx);
  if (!group) {
    return "";
  }

  const rest = src.slice(group.end);
  const leadingWhitespace = rest.match(/^\s*/)?.[0].length ?? 0;
  if (rest[leadingWhitespace] === "{") {
    const bodyGroup = findBraceGroup(group.end);
    if (bodyGroup) {
      group = bodyGroup;
    }
  }

  return src.slice(startIdx, group.end);
}

describe("stripComments helper", () => {
  it("strips line and block comments while preserving code and URL-like strings", () => {
    const result = stripComments('a // x\nb /* y */ c "http://h"');
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).toContain("c");
    expect(result).toContain("http://h");
    expect(result).not.toContain("x");
    expect(result).not.toContain("y");
  });
});

describe("single confirmed send path", () => {
  const clientFiles = [...walk("components"), ...walk("hooks"), ...walk("pages")];

  it("toolControl and recoveryControl are referenced only by the confirmed-send hook", () => {
    const matches = clientFiles
      .filter((file) => /\.(toolControl|recoveryControl)\b/.test(stripComments(read(rel(file)))))
      .map(rel)
      .sort();
    expect(matches).toStrictEqual(["hooks/useRunControl.ts"]);
  });

  it("runState is read only by useRunControlState", () => {
    const matches = clientFiles
      .filter((file) => /commandQueue\.runState\b/.test(stripComments(read(rel(file)))))
      .map(rel)
      .sort();
    expect(matches).toStrictEqual(["hooks/useRunControl.ts"]);
  });

  it("the confirmed-send hook is used only by the confirm modal", () => {
    const matches = clientFiles
      .map(rel)
      .filter((relPath) => relPath !== "hooks/useRunControl.ts")
      .filter((relPath) => /useConfirmedControlSend\(/.test(stripComments(read(relPath))))
      .sort();
    expect(matches).toStrictEqual(["components/runs/RunControlConfirmModal.tsx"]);
  });

  it("send is called only from the Confirm handler", () => {
    const src = stripComments(read("components/runs/RunControlConfirmModal.tsx"));
    const handleConfirmBody = extractBracedRegion(src, /const handleConfirm = /);
    expect(handleConfirmBody.length).toBeGreaterThan(0);

    const allSendCalls = src.match(/\bsend\(/g) ?? [];
    expect(allSendCalls.length).toBeGreaterThan(0);

    const bodySendCalls = handleConfirmBody.match(/\bsend\(/g) ?? [];
    expect(bodySendCalls.length).toBe(allSendCalls.length);
  });

  it("the send gate takes completed decisions", () => {
    const src = stripComments(read("components/runs/controlDecision.ts"));
    const interfaceBody = extractBracedRegion(src, /interface ConfirmedControlRequest/);
    expect(interfaceBody).toContain("ControlDecisionValue");
    expect(interfaceBody).not.toContain("undefined");
  });

  it("server controlCommand callers are toolControl and recoveryControl", () => {
    const serverFiles = walk("server");

    const callSiteCounts: Record<string, number> = {};
    for (const file of serverFiles) {
      const count = (stripComments(read(rel(file))).match(/\.controlCommand\(/g) ?? []).length;
      if (count > 0) {
        callSiteCounts[rel(file)] = count;
      }
    }
    expect(callSiteCounts).toStrictEqual({
      "server/command_queue.ts": 1,
      "server/recoveryControl.ts": 1,
    });

    const definitionFiles = serverFiles
      .map(rel)
      .filter((relPath) => /async controlCommand\(/.test(stripComments(read(relPath))));
    expect(definitionFiles).toStrictEqual(["server/tools.ts"]);
  });

  it("toolControl and recoveryControl have one router entry each", () => {
    const serverFiles = walk("server").map(rel);

    const toolControlRouters = serverFiles.filter((relPath) =>
      /CommandQueue\.global\.toolControl\(/.test(stripComments(read(relPath))),
    );
    expect(toolControlRouters).toStrictEqual(["server/routers/command_queue.ts"]);

    const recoveryControlRouters = serverFiles.filter((relPath) =>
      /recoveryControl\(\{/.test(stripComments(read(relPath))),
    );
    expect(recoveryControlRouters).toStrictEqual(["server/routers/tool.ts"]);
  });
});

describe("safety invariants", () => {
  // The explicit control-UI module list (D-07, D-17, D-24). RunsComponent.tsx
  // (LastUpdatedTime clock), StopRunModal.tsx and TimerModal.tsx hold
  // legitimate pre-existing timers and are never scanned here.
  const controlUiModules = [
    "components/runs/controlDecision.ts",
    "components/runs/pausePrompt.ts",
    "components/runs/stopInterception.ts",
    "hooks/useRunControl.ts",
    "components/runs/RunControlConfirmModal.tsx",
    "components/runs/ControlBar.tsx",
    "components/runs/ToolPausedModal.tsx",
    "components/runs/InstrumentStopModal.tsx",
    "components/tools/RunRecoverySection.tsx",
  ];

  it("no timers in the control UI", () => {
    const timerPattern = /\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/;
    for (const file of controlUiModules) {
      expect(stripComments(read(file))).not.toMatch(timerPattern);
    }
  });

  it("the countdown stop modal is not reused", () => {
    const noReuseFiles = [
      "components/runs/InstrumentStopModal.tsx",
      "components/runs/stopInterception.ts",
      "components/runs/status/QueueStatuscomponent.tsx",
      "components/runs/RunControlConfirmModal.tsx",
      "components/runs/ControlBar.tsx",
      "components/runs/ToolPausedModal.tsx",
      "components/tools/RunRecoverySection.tsx",
    ];
    for (const file of noReuseFiles) {
      expect(stripComments(read(file))).not.toMatch(/StopRunModal/);
    }

    // Beyond the fixed list: any module that actually calls the confirmed-
    // send hook (the new Stop flow's own entry point into live control) must
    // never reach for the countdown modal instead. Scoped to callers of
    // useConfirmedControlSend rather than every InstrumentStopModal
    // reference: RunsComponent.tsx legitimately composes the pre-existing
    // StopRunModal (Tool Box stop_run step) alongside the new
    // InstrumentStopModal (per-run delete interception, D-19) without
    // itself performing a confirmed send — that combination is correct by
    // design and is not the reuse this invariant guards against.
    const clientFiles = [...walk("components"), ...walk("hooks"), ...walk("pages")].map(rel);
    const confirmedSendCallers = clientFiles.filter(
      (relPath) =>
        relPath !== "hooks/useRunControl.ts" &&
        /useConfirmedControlSend\(/.test(stripComments(read(relPath))),
    );
    expect(confirmedSendCallers.length).toBeGreaterThan(0);
    for (const relPath of confirmedSendCallers) {
      expect(stripComments(read(relPath))).not.toMatch(/StopRunModal/);
    }
  });

  it("the pause prompt stays out of the queue's modal plumbing", () => {
    const pattern = /modalState|messageData|isModalOpen|commandQueue\.resume|resumeMutation/;
    const files = [
      "components/runs/ToolPausedModal.tsx",
      "components/runs/pausePrompt.ts",
      "components/runs/ControlBar.tsx",
    ];
    for (const file of files) {
      expect(stripComments(read(file))).not.toMatch(pattern);
    }
  });

  it("no instrument-state check before sending", () => {
    const pattern = /runState|_runStateMonitor|fetchStatus|getStatus|\.status\b/;

    const queueSrc = stripComments(read("server/command_queue.ts"));
    const toolControlBody = extractBracedRegion(queueSrc, /async toolControl\(/);
    expect(toolControlBody.length).toBeGreaterThan(0);
    expect(toolControlBody).not.toMatch(pattern);

    const recoverySrc = stripComments(read("server/recoveryControl.ts"));
    expect(recoverySrc).not.toMatch(pattern);

    const decisionSrc = stripComments(read("components/runs/controlDecision.ts"));
    const senderBody = extractBracedRegion(decisionSrc, /export function createConfirmedSender\(/);
    expect(senderBody.length).toBeGreaterThan(0);
    expect(senderBody).not.toMatch(/runState|envelope|controlButtonHints/);
  });

  it("no Enter-bound default or preselected decision", () => {
    const pattern = /<form|autoFocus|defaultValue|defaultChecked/;
    expect(stripComments(read("components/runs/RunControlConfirmModal.tsx"))).not.toMatch(pattern);
    expect(stripComments(read("components/runs/ToolPausedModal.tsx"))).not.toMatch(pattern);
  });
});
