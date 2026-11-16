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

// Returns the rel paths whose stripped source matches `pattern`, in the
// SAME ORDER the list was supplied (the walk() order), so scan violations
// are always enumerated the same way every run (OPR-05 determinism edge).
// `sources`, when supplied, substitutes in-memory content for a rel path —
// used by the in-fixture determinism backstop case instead of real files.
function findMatchingRels(
  orderedRels: string[],
  pattern: RegExp,
  sources?: Map<string, string>,
): string[] {
  return orderedRels.filter((relPath) => {
    const src = sources?.get(relPath) ?? stripComments(read(relPath));
    return pattern.test(src);
  });
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

  // D-12: the latch read never rides the operator send path — it lives in
  // the recovery card (RunRecoverySection.tsx) and the four files below
  // (the send hook, the decision module, the confirm modal, the recovery
  // server route) stay latch-free.
  it("the operator send path stays latch-free (/latch/i)", () => {
    const sendPathFiles = [
      "server/recoveryControl.ts",
      "components/runs/controlDecision.ts",
      "components/runs/RunControlConfirmModal.tsx",
      "hooks/useRunControl.ts",
    ];
    for (const file of sendPathFiles) {
      expect(stripComments(read(file)), file).not.toMatch(/latch/i);
    }
  });

  // OPR-05 single-reader pin: the latch read has exactly ONE consumer — the
  // recovery card. A second consumer would mean latched-failure state is
  // driving something other than the explicit card read.
  it("the latch read has exactly one consumer (the card)", () => {
    const walkOrderRels = [
      ...walk("components"),
      ...walk("hooks"),
      ...walk("pages"),
      ...walk("server"),
    ].map(rel);
    expect(findMatchingRels(walkOrderRels, /tool\.latchStatus/).sort()).toStrictEqual([
      "components/tools/RunRecoverySection.tsx",
    ]);
  });

  it("no Enter-bound default or preselected decision", () => {
    const pattern =
      /<form|autoFocus|defaultValue|defaultChecked|onKeyDown|onKeyPress|onKeyUp|onSubmit|type="submit"/;
    expect(stripComments(read("components/runs/RunControlConfirmModal.tsx"))).not.toMatch(pattern);
    expect(stripComments(read("components/runs/ToolPausedModal.tsx"))).not.toMatch(pattern);
    // The recovery card (plan 04-04) joins the same no-Enter surface (D-07):
    // ack/abort/resume confirm clicks only, never an Enter-bound default.
    expect(stripComments(read("components/tools/RunRecoverySection.tsx"))).not.toMatch(pattern);
  });
});

describe("Run confirmation shows what a Start will run (QUE-08)", () => {
  const modalFile = "components/runs/status/QueueStatuscomponent.tsx";
  const summaryFile = "components/runs/queuedStartSummary.ts";
  const timerPattern = /\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/;

  it("the modal reads the queue-joined commands query and keeps the simulation warning", () => {
    const raw = read(modalFile);
    const src = stripComments(raw);
    expect(src).toMatch(/commandQueue\.commands\.useQuery\(/);
    expect(src).toMatch(/queuedStartLines\(/);
    expect(src).toContain("Make sure instruments are not unintentionally in simulation mode.");
  });

  it("the Run confirmation has no timer, form, autoFocus or default selection", () => {
    const src = stripComments(read(modalFile));
    expect(src).not.toMatch(timerPattern);
    expect(src).not.toMatch(/<form|autoFocus|defaultValue|defaultChecked|initialFocusRef/);
  });

  it("the Run confirmation footer keeps exactly two buttons", () => {
    const src = stripComments(read(modalFile));
    const start = src.indexOf("<ModalFooter>");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = src.indexOf("</ModalFooter>", start);
    expect(end).toBeGreaterThan(start);
    const footer = src.slice(start, end);
    expect(footer.match(/<Button\b/g)?.length).toBe(2);
  });

  it("the pure summary module stays React-free and timer-free", () => {
    const src = stripComments(read(summaryFile));
    expect(src).not.toMatch(/from "react"|\.tsx"/);
    expect(src).not.toMatch(timerPattern);
  });

  it("neither file injects raw HTML", () => {
    expect(stripComments(read(modalFile))).not.toMatch(/dangerouslySetInnerHTML/);
    expect(stripComments(read(summaryFile))).not.toMatch(/dangerouslySetInnerHTML/);
  });
});

describe("error path invariants (ERR-02, ERR-04, QUE-07)", () => {
  const queueSrc = stripComments(read("server/command_queue.ts"));
  const routerSrc = stripComments(read("server/routers/command_queue.ts"));
  const toolsSrc = stripComments(read("server/tools.ts"));

  it("single failure-recording site", () => {
    const assignments = queueSrc.match(/this\.error\s*=(?!=)(?!\s*undefined\b)/g) ?? [];
    expect(assignments.length).toBe(1);
    const region = extractBracedRegion(queueSrc, /private _recordFailure\(/);
    expect(region).toMatch(/this\.error\s*=(?!=)(?!\s*undefined\b)/);
    expect(region).toContain("this._failureSeq += 1");
  });

  it("_start guard comes first, no await before the claim", () => {
    const body = extractBracedRegion(queueSrc, /async _start\(/);
    const g = body.indexOf("if (this._runningPromise)");
    expect(g).toBeGreaterThanOrEqual(0);
    for (const later of [
      "this._failedAttempt = undefined",
      '"Queue Started"',
      "this.error = undefined",
      "this._setState(",
    ]) {
      const i = body.indexOf(later);
      expect(i, later).toBeGreaterThanOrEqual(0);
      expect(g, later).toBeLessThan(i);
    }
    const claim = body.search(/this\._runningPromise\s*=(?!=)/);
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(body.slice(0, claim)).not.toMatch(/\bawait\b/);
  });

  it("one operator-text composer", () => {
    expect(routerSrc).not.toMatch(
      /ResponseCode\.(UNRECOGNIZED_COMMAND|INVALID_ARGUMENTS|WRONG_TOOL|NOT_READY)/,
    );
    expect(toolsSrc).toMatch(/describeToolReply\(/);
    const cls = extractBracedRegion(toolsSrc, /export class ToolCommandExecutionError/);
    expect(cls).toContain("String(code)");
    expect(cls).not.toMatch(/typeof value/);
  });
});

describe("error visibility invariants (ERR-03, ERR-04, ERR-05)", () => {
  const runsSrc = stripComments(read("components/runs/RunsComponent.tsx"));
  const cardSrc = stripComments(read("components/runs/list/SwimLaneCommandComponent.tsx"));

  it("banner re-arms on a failure seq", () => {
    expect(runsSrc).not.toContain("isErrorVisible");
    expect(runsSrc).toMatch(/dismissedSeq/);
    expect(runsSrc).toMatch(/shouldShowErrorBanner\(/);
    expect(runsSrc).toMatch(/describeQueueError\(/);
    const banner = extractBracedRegion(runsSrc, /const ErrorBanner = /);
    expect(banner).toContain('maxH="160px"');
    expect(banner).toContain('whiteSpace="pre-wrap"');
    // Dismiss only hides one failure seq locally; it never acts on the queue.
    expect(banner).not.toMatch(/noOfLines/);
    expect(banner).not.toMatch(/clearError|\.restart\b|\.mutate\(|mutateAsync\(/);
  });

  it("step card shows the stored error and checks only completed steps", () => {
    expect(cardSrc).toMatch(/stepErrorText\(command\)/);
    expect(cardSrc).toMatch(/noOfLines=\{3\}/);
    expect(cardSrc).toMatch(/whiteSpace="normal"/);
    expect(cardSrc).toMatch(/title=\{errorText\}/);
    expect((cardSrc.match(/<CheckCircle\b/g) ?? []).length).toBe(1);
    expect(cardSrc).toMatch(/command\.status === "COMPLETED" && <CheckCircle\b/);
  });

  it("run outcome is wired and never success-coloured", () => {
    const outcomeSrc = stripComments(read("components/runs/runOutcome.ts"));
    const utilsSrc = stripComments(read("components/runs/utils.ts"));
    const runTypesSrc = stripComments(read("types/run.ts"));
    expect(runsSrc).toMatch(/getRunAttributes\(runInfo, run\.Commands\)/);
    expect(runsSrc).toMatch(/colorScheme=\{runProgressColorScheme\(runAttributes\.status\)\}/);
    expect(runsSrc).toMatch(/runOutcomeBadge\(runAttributes\.status\)/);
    expect(utilsSrc).toMatch(/deriveRunOutcome\(/);
    expect(outcomeSrc).not.toMatch(/green/i);
    const badge = extractBracedRegion(outcomeSrc, /export function runOutcomeBadge\(/);
    expect(badge).toContain("colorScheme");
    expect(badge).not.toMatch(/teal|green/);
    expect(runTypesSrc).toMatch(
      /export type RunStatus = "CREATED" \| "STARTED" \| "FAILED" \| "COMPLETED" \| "SKIPPED";/,
    );
  });

  const helperFiles = [
    "components/runs/queueError.ts",
    "components/runs/runOutcome.ts",
    "components/runs/storedError.ts",
    "components/runs/queuedStartSummary.ts",
  ];

  it("phase-3 helpers are React-free and timer-free", () => {
    for (const file of helperFiles) {
      const src = stripComments(read(file));
      expect(src, file).not.toMatch(/from "react"|\.tsx"/);
      expect(src, file).not.toMatch(/\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/);
    }
  });

  it("tool text is never injected as HTML", () => {
    const files = [
      "components/runs/RunsComponent.tsx",
      "components/runs/list/SwimLaneCommandComponent.tsx",
      "components/runs/status/QueueStatuscomponent.tsx",
      ...helperFiles,
    ];
    for (const file of files) {
      expect(stripComments(read(file)), file).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });
});

describe("Review fixes WR-01 / WR-02", () => {
  it("the failure alert is never awaited while the busy loop holds the queue (WR-01)", () => {
    const src = stripComments(read("server/command_queue.ts"));
    expect(src).not.toMatch(/await\s+this\._notifyFailure\(/);
  });

  it("an ignored Start is reported to the client and shown to the operator (WR-01)", () => {
    expect(stripComments(read("server/routers/command_queue.ts"))).toMatch(/return \{ accepted \}/);
    expect(stripComments(read("components/runs/status/QueueStatuscomponent.tsx"))).toMatch(
      /!result\.accepted/,
    );
  });

  it("getError never sends a stack to the client (WR-02)", () => {
    expect(stripComments(read("server/routers/command_queue.ts"))).not.toMatch(/stack:/);
  });
});

describe("step card error fits the fixed card (G-03-3)", () => {
  const cardSrc = stripComments(read("components/runs/list/SwimLaneCommandComponent.tsx"));

  it("the error text shares one row with the command image, above the sticky label", () => {
    const imgAt = cardSrc.indexOf("<CommandImage");
    const errAt = cardSrc.indexOf("title={errorText}");
    const labelAt = cardSrc.indexOf('position="sticky"');
    expect(imgAt).toBeGreaterThan(-1);
    expect(errAt).toBeGreaterThan(imgAt);
    expect(labelAt).toBeGreaterThan(errAt);

    const rowOpen = cardSrc.lastIndexOf("<HStack", imgAt);
    expect(rowOpen).toBeGreaterThan(-1);
    expect(cardSrc.slice(rowOpen, errAt)).not.toContain("</HStack>");

    const rowClose = cardSrc.indexOf("</HStack>", errAt);
    expect(rowClose).toBeGreaterThan(errAt);
    expect(rowClose).toBeLessThan(labelAt);
    const rowHead = cardSrc.slice(rowOpen, imgAt);
    expect(rowHead).toMatch(/<Box flexShrink=\{0\}>\s*$/);
    expect(rowHead).toMatch(/width="100%"/);
    expect(rowHead).toMatch(/justifyContent="center"/);
    // The wrapper only renders with an image, so an empty one adds no HStack gap.
    expect(rowHead).toMatch(/\{infoQuery\.data\?\.imageUrl && \(\s*<Box flexShrink=\{0\}>\s*$/);
  });

  it("the card box, the error text style and the label are unchanged", () => {
    const errAt = cardSrc.indexOf("title={errorText}");
    const errText = cardSrc.slice(
      cardSrc.lastIndexOf("<Text", errAt),
      cardSrc.indexOf("</Text>", errAt),
    );
    expect(errText).toMatch(/fontSize="sm"/);
    expect(errText).toMatch(/noOfLines=\{3\}/);
    expect(errText).toMatch(/whiteSpace="normal"/);
    expect(errText).toMatch(/flex="1"/);
    expect(errText).toMatch(/minW=\{0\}/);

    expect(cardSrc).toMatch(/height="165px"/);
    expect(cardSrc).toMatch(/padding="6px"/);
    expect(cardSrc).toMatch(/minW="250px"/);
    expect(cardSrc).toMatch(/maxW="300px"/);
    expect(cardSrc).toMatch(/overflowY="auto"/);
    expect(cardSrc).not.toMatch(/lineHeight/);
    expect(cardSrc).toMatch(
      /<Box bottom=\{0\} position="sticky">\s*<Text>\{capitalizeFirst\(command\.commandInfo\.command\.replaceAll\("_", " "\)\)\}<\/Text>/,
    );
    expect((cardSrc.match(/<CommandImage\b/g) ?? []).length).toBe(1);
  });
});

describe("operator-only ack invariants (OPR-05)", () => {
  const walkOrderRels = [
    ...walk("components"),
    ...walk("hooks"),
    ...walk("pages"),
    ...walk("server"),
  ].map(rel);

  it("the acknowledge_failure literal lives in exactly its four pinned files", () => {
    // Closed set over the same walk roots as every scan above: the decision
    // composer (labels/entry points), the recovery card (confirm flow), the
    // operator-only refuse table and the recovery action spec. stripComments
    // preserves string literals, so refusal-message text also counts — the
    // pinned list therefore encodes every legitimate carrier. A FIFTH file
    // (a self-acknowledging code path, or the ack escaping into e.g.
    // runControl/commandFields) fails the suite.
    const matches = findMatchingRels(walkOrderRels, /acknowledge_failure/).sort();
    expect(matches).toStrictEqual([
      "components/runs/controlDecision.ts",
      "components/tools/RunRecoverySection.tsx",
      "server/operatorOnlyCommands.ts",
      "server/recoveryActions.ts",
    ]);
  });

  it("commandFields pins the stack tool and never an acknowledge entry", () => {
    const src = stripComments(read("components/tools/constants.ts"));
    expect(src).not.toContain("acknowledge_failure");
    // Top-level tool keys are the 2-space-indented entries of the exported
    // map (nested param names like "stack_id" live deeper) — assert over the
    // parsed source keys, never a runtime import.
    const keys = [...src.matchAll(/^  ([A-Za-z0-9_]+): \{/gm)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain("stack");
  });

  it("runControl.ts never appends an ack to the live-run control spec", () => {
    expect(stripComments(read("server/runControl.ts"))).not.toContain("acknowledge_failure");
  });

  it("the guard rides executeCommand and the enqueue scan, never controlCommand", () => {
    const toolsSrc = stripComments(read("server/tools.ts"));

    // The instance method is the declaration whose body opens with the
    // operator-only guard (D-02a) — the static wrapper of the same name
    // starts with a logAction call instead.
    const instanceDecl =
      /async executeCommand\(command: ToolCommandInfo\) \{\s*if \(isOperatorOnlyCommand\(/;
    const executeBody = extractBracedRegion(toolsSrc, instanceDecl);
    expect(executeBody.length).toBeGreaterThan(0);
    expect(executeBody).toContain("isOperatorOnlyCommand(");
    expect(executeBody).toContain("OperatorOnlyCommandError");
    // FIRST statement: the guard precedes variable substitution and gRPC.
    const guardAt = executeBody.indexOf("isOperatorOnlyCommand(");
    const substituteAt = executeBody.indexOf("const params = command.params");
    expect(substituteAt).toBeGreaterThan(guardAt);

    const controlBody = extractBracedRegion(toolsSrc, /async controlCommand\(/);
    expect(controlBody.length).toBeGreaterThan(0);
    expect(controlBody).not.toContain("isOperatorOnlyCommand(");
    expect(controlBody).not.toContain("OperatorOnlyCommandError");

    // Enqueue-time scan stays in createFromProtocol (D-02's two-point layer).
    const enqueueBody = extractBracedRegion(
      stripComments(read("server/runs.ts")),
      /async createFromProtocol\(/,
    );
    expect(enqueueBody.length).toBeGreaterThan(0);
    expect(enqueueBody).toContain("isOperatorOnlyCommand(");
    expect(enqueueBody).toContain("stage=enqueue");
  });

  it("no code path acknowledges on its own (caller + router compound)", () => {
    // Belt-and-braces compound re-assertion of the single-send-path pins:
    // one future edit landing a second ack path fails these together.
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

    const recoveryControlRouters = serverFiles
      .map(rel)
      .filter((relPath) => /recoveryControl\(\{/.test(stripComments(read(relPath))));
    expect(recoveryControlRouters).toStrictEqual(["server/routers/tool.ts"]);
  });

  it("scan reports are enumerated in deterministic walk order (determinism backstop)", () => {
    // Synthetic in-memory fixture (no real files, `sources` overrides the
    // disk read): two violating files in non-alphabetical walk order must be
    // reported in that same order — a future violation is reported the same
    // way every run (OPR-05 ordering edge).
    const sources = new Map<string, string>([
      ["server/zz_mock.ts", "const x = acknowledge_failure;"],
      ["components/aa_mock.tsx", "const y = acknowledge_failure;"],
    ]);
    const walkFixture = ["server/zz_mock.ts", "components/aa_mock.tsx"];
    expect(findMatchingRels(walkFixture, /acknowledge_failure/, sources)).toStrictEqual([
      "server/zz_mock.ts",
      "components/aa_mock.tsx",
    ]);
  });
});

describe("recovery card offers only the tool type's declared actions (G-04-6)", () => {
  const cardSrc = stripComments(read("components/tools/RunRecoverySection.tsx"));

  it("Resume and Abort render only when the recovery spec declares them", () => {
    expect(cardSrc).toMatch(/const showResume = isRecoveryAction\(toolType, "resume"\);/);
    expect(cardSrc).toMatch(/const showAbort = isRecoveryAction\(toolType, "abort"\);/);

    for (const [flag, action] of [
      ["showResume", "resume"],
      ["showAbort", "abort"],
    ]) {
      const gateAt = cardSrc.indexOf("{" + flag + " && (");
      const clickAt = cardSrc.indexOf('openConfirm("' + action + '")');
      expect(gateAt).toBeGreaterThan(-1);
      expect(clickAt).toBeGreaterThan(gateAt);
      const between = cardSrc.slice(gateAt, clickAt);
      expect(between).not.toContain("</Button>");
      expect((between.match(/<Button\b/g) ?? []).length).toBe(1);
    }

    expect(cardSrc.split('openConfirm("resume")').length - 1).toBe(1);
    expect(cardSrc.split('openConfirm("abort")').length - 1).toBe(1);

    const groupAt = cardSrc.indexOf("<ButtonGroup");
    expect(groupAt).toBeGreaterThan(-1);
    expect(cardSrc.slice(cardSrc.lastIndexOf("{", groupAt), groupAt)).toMatch(
      /^\{\(showResume \|\| showAbort\) && \(\s*$/,
    );

    expect(cardSrc).not.toMatch(/toolType === "fast"/);
  });

  it("the STACK description offers only the latch read and the acknowledge", () => {
    const flatSrc = cardSrc.replace(/\s+/g, " ");
    expect(flatSrc).toContain("Read the failure latched on this tool and acknowledge it.");
    expect(flatSrc).toContain(
      "Resume or abort an instrument run that no run step is tracking, for example after galago-web restarted.",
    );
    expect(flatSrc).not.toContain("resume/abort");
  });
});

describe("latch raw reply stays in one bounded collapsible (G-04-2)", () => {
  // D-06 (phase 5, plan 05-02): the bounded renderer was extracted into the
  // shared components/ui/BoundedRawJson.tsx and the card renders through it
  // via the LatchRawJson alias. The styling needles pin the shared file; the
  // usage pins stay on the card — still exactly one bounded display.
  const cardSrc = stripComments(read("components/tools/RunRecoverySection.tsx"));
  const sharedSrc = stripComments(read("components/ui/BoundedRawJson.tsx"));

  it("both latch states render raw text only through the bounded shared panel", () => {
    const renderer = extractBracedRegion(sharedSrc, /function BoundedRawJson\(/);
    expect(renderer.length).toBeGreaterThan(0);
    for (const needle of [
      "Raw JSON",
      "aria-expanded={isOpen}",
      "<Collapse in={isOpen}>",
      'w="0px"',
      'minW="100%"',
      'maxH="160px"',
      'overflowY="auto"',
      'bg="surface.panel"',
      'borderColor="border.subtle"',
      'fontFamily="mono"',
      'fontSize="sm"',
      'wordBreak="break-all"',
      'whiteSpace="pre-wrap"',
      "formatLatchRaw(raw)",
    ]) {
      expect(renderer).toContain(needle);
    }

    const collapseAt = renderer.indexOf("<Collapse in={isOpen}>");
    const boundAt = renderer.indexOf('maxH="160px"');
    const formatAt = renderer.indexOf("formatLatchRaw(raw)");
    expect(collapseAt).toBeLessThan(boundAt);
    expect(boundAt).toBeLessThan(formatAt);

    // Display-only: the renderer never fills the guid, opens the modal or reads the latch.
    expect(renderer).not.toMatch(/setGuid|openConfirm|latchStatus|mutate/);

    expect((sharedSrc.match(/formatLatchRaw\(/g) ?? []).length).toBe(2);
    expect((cardSrc.match(/<LatchRawJson\b/g) ?? []).length).toBe(2);

    const unknownAt = cardSrc.indexOf("latchResult.unknown ?");
    const notLatchedAt = cardSrc.indexOf("!latchResult.latched ?");
    const useGuidAt = cardSrc.indexOf("setGuid(latchResult.guid");
    expect(unknownAt).toBeGreaterThan(-1);
    expect(notLatchedAt).toBeGreaterThan(unknownAt);
    expect(useGuidAt).toBeGreaterThan(notLatchedAt);

    const unknownBranch = cardSrc.slice(unknownAt, notLatchedAt);
    expect(unknownBranch).toContain("Unrecognized latch reply");
    expect(unknownBranch.indexOf("Unrecognized latch reply")).toBeLessThan(
      unknownBranch.indexOf("<LatchRawJson"),
    );
    expect(unknownBranch).not.toContain("formatLatchRaw(");

    const latchedBranch = cardSrc.slice(notLatchedAt, useGuidAt);
    expect(latchedBranch).toContain("<LatchRawJson");

    // Tool text stays a React child (auto-escaped), never injected markup.
    expect(cardSrc).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("every explicit read starts with Raw JSON collapsed", () => {
    const readBody = extractBracedRegion(cardSrc, /const readClick = async \(\) => /);
    expect(readBody.length).toBeGreaterThan(0);
    expect(readBody).toContain("setRawOpen(false)");
  });
});

// D-17: the dropdown read path is closed on the server. One caller of the
// instance read method, no command-queue import, a four-source registry, and a
// strict tool.options input with no command or params, declared above
// latchStatus (latchStatus.test.ts slices the router from latchStatus down).
describe("tool options read path (D-17)", () => {
  const scanDirs = ["server", "components", "hooks", "pages"];

  it("server/toolOptions.ts is the only caller of .readOptions( and server/tools.ts the only definition", () => {
    const files = scanDirs.flatMap((dir) => walk(dir)).map(rel);

    const callSiteCounts: Record<string, number> = {};
    const definitionFiles: string[] = [];
    for (const relPath of files) {
      const src = stripComments(read(relPath));
      if (/async readOptions\(/.test(src)) {
        definitionFiles.push(relPath);
        continue;
      }
      const count = (src.match(/\.readOptions\(/g) ?? []).length;
      if (count > 0) {
        callSiteCounts[relPath] = count;
      }
    }

    expect(Object.keys(callSiteCounts)).toStrictEqual(["server/toolOptions.ts"]);
    expect(callSiteCounts["server/toolOptions.ts"]).toBeGreaterThanOrEqual(1);
    expect(definitionFiles).toStrictEqual(["server/tools.ts"]);
  });

  it("server/toolOptions.ts never references the command queue", () => {
    const src = stripComments(read("server/toolOptions.ts"));
    expect(src).not.toContain("command_queue");
    expect(src).not.toContain("CommandQueue");
  });

  it("OPTION_SOURCES declares exactly the five D-02/D-03 sources", () => {
    const src = stripComments(read("server/toolOptions.ts"));
    const region = extractBracedRegion(src, /export const OPTION_SOURCES/);
    expect(region.length).toBeGreaterThan(0);

    const bodyStart = region.indexOf("{");
    function depthAt(index: number): number {
      let depth = 0;
      for (let i = bodyStart; i < index; i += 1) {
        if (region[i] === "{") depth += 1;
        else if (region[i] === "}") depth -= 1;
      }
      return depth;
    }

    const quotedEntryKeys: string[] = [];
    for (const match of region.matchAll(/"([^"]+)"\s*:\s*\{/g)) {
      if (depthAt(match.index ?? 0) === 1) quotedEntryKeys.push(match[1]);
    }
    expect(quotedEntryKeys).toStrictEqual([
      "stack.robots",
      "stack.devices",
      "stack.labwareProfiles",
      "stack.transferProfiles",
      "fast.plates",
    ]);

    // Nothing else at the first nesting level: no unquoted or non-object key.
    const firstLevelKeys: string[] = [];
    for (const match of region.matchAll(/(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/g)) {
      if (depthAt(match.index ?? 0) === 1) firstLevelKeys.push(match[1] ?? match[2]);
    }
    expect(firstLevelKeys).toStrictEqual(quotedEntryKeys);
  });

  it("get_plates is named by no non-generated server source except server/toolOptions.ts (PLT-05, D-17)", () => {
    const named = walk("server")
      .map(rel)
      .filter((relPath) => !relPath.startsWith("gen-interfaces/"))
      .filter((relPath) => stripComments(read(relPath)).includes("get_plates"));
    expect(named).toStrictEqual(["server/toolOptions.ts"]);
  });

  it("the tool.options input is strict, closed to OPTION_SOURCE_IDS, with no command or params", () => {
    const src = stripComments(read("server/routers/tool.ts"));
    const optionsAt = src.indexOf("options: procedure");
    const latchAt = src.indexOf("latchStatus: procedure");
    expect(optionsAt).toBeGreaterThan(-1);
    expect(latchAt).toBeGreaterThan(optionsAt);

    const region = src.slice(optionsAt, latchAt);
    expect(region).toContain(".strict()");
    expect(region).toContain("OPTION_SOURCE_IDS");
    expect(region).not.toContain("command");
    expect(region).not.toContain("params");
  });

  it("the options procedure is declared above latchStatus", () => {
    const src = stripComments(read("server/routers/tool.ts"));
    const optionsAt = src.indexOf("options: procedure");
    expect(optionsAt).toBeGreaterThan(-1);
    expect(optionsAt).toBeLessThan(src.indexOf("latchStatus: procedure"));
    expect(src.indexOf("options: procedure", optionsAt + 1)).toBe(-1);
  });

  it("test/commandFields.test.ts is left as it is (born-empty sweep untouched)", () => {
    // The born-empty sweep lives in commandFields.test.ts and is not edited by
    // this phase; this case only proves the sweep is still there.
    const src = stripComments(read("test/commandFields.test.ts"));
    expect(src).toContain('describe("commandFields.stack (D-03, D-07c)"');
    expect(src).toContain("sweeps every stack field: no defaultValue and no select");
  });
});

describe("dropdown control invariants (D-09, D-11, D-17)", () => {
  const control = "components/tools/OptionsSelect.tsx";
  const hook = "hooks/useToolOptions.ts";
  const page = "pages/tools/[id].tsx";

  it("OptionsSelect.tsx and useToolOptions.ts declare no effect hook", () => {
    for (const file of [control, hook]) {
      expect(stripComments(read(file)), file).not.toMatch(/\buse(Layout)?Effect\b/);
    }
  });

  it("OptionsSelect.tsx has no first-option or default-value selection construct", () => {
    const src = stripComments(read(control));
    for (const pattern of [
      /options\[0\]/,
      /selectedIndex/,
      /defaultValue/,
      /defaultChecked/,
      /\bselected=/,
      /placeholder=/,
    ]) {
      expect(src, String(pattern)).not.toMatch(pattern);
    }
  });

  it("useToolOptions.ts never retries, refetches on focus/reconnect, polls or sets a timer", () => {
    const src = stripComments(read(hook));
    expect(src).toContain("retry: false");
    expect(src).toContain("refetchOnWindowFocus: false");
    expect(src).toContain("refetchOnReconnect: false");
    for (const pattern of [/refetchInterval/, /setInterval/, /setTimeout/]) {
      expect(src, String(pattern)).not.toMatch(pattern);
    }
  });

  it("useToolOptions.ts is the only client file reading tool.options", () => {
    const files = ["components", "hooks", "pages"].flatMap((dir) => walk(dir)).map(rel);
    const readers = files.filter((relPath) =>
      stripComments(read(relPath)).includes("tool.options."),
    );
    expect(readers).toStrictEqual([hook]);
  });

  it("the tool page writes bound fields through applyChange and keeps its [selectedCommand] reset effect", () => {
    const src = stripComments(read(page));
    expect(src).toContain("applyChange(");
    const reset = src.match(
      /useEffect\(\(\) => \{\s*if \(selectedCommand\) \{[\s\S]*?\}, \[selectedCommand\]\);/,
    );
    expect(reset).not.toBeNull();
    expect(reset?.[0] ?? "").not.toContain("applyChange");
  });
});

describe("protocol host invariants (D-14, D-15, D-17)", () => {
  const modal = "components/protocols/AddToolCommandModal.tsx";
  const drawer = "components/protocols/CommandDetailsDrawer.tsx";
  const page = "pages/tools/[id].tsx";

  it("exactly the three hosts render OptionsSelect", () => {
    const files = ["components", "hooks", "pages"].flatMap((dir) => walk(dir)).map(rel);
    const hosts = files
      .filter((relPath) => stripComments(read(relPath)).includes("<OptionsSelect"))
      .sort();
    expect(hosts).toStrictEqual([modal, drawer, page].sort());
  });

  it("the drawer reads lists only while editing and writes through applyChange", () => {
    const src = stripComments(read(drawer));
    expect(src).toContain("enabled={isEditing}");
    expect(src).toContain("lookupFieldBinding(");
    expect(src).toContain("applyChange(");
  });

  it("the modal keeps the variable picker and writes through applyChange", () => {
    const src = stripComments(read(modal));
    expect(src).toContain("lookupFieldBinding(");
    expect(src).toContain("applyChange(");
    expect(src).toContain("handleVariableSelect(field.name");
  });

  it("the modal's handleSubmit fills through fillMissingParams and knows nothing of tool options", () => {
    const region = extractBracedRegion(stripComments(read(modal)), /const handleSubmit = \(\) =>/);
    expect(region).not.toBe("");
    expect(region).toContain("fillMissingParams(");
    for (const pattern of [/OptionsSelect/, /applyChange/, /tool\.options/, /useToolOptions/]) {
      expect(region, String(pattern)).not.toMatch(pattern);
    }
  });

  it("fillMissingParams keeps the four legacy fill-ins and asks isNoZeroFillField before the number fill-in (D-07)", () => {
    const region = extractBracedRegion(
      stripComments(read("components/tools/commandParams.ts")),
      /export function fillMissingParams/,
    );
    expect(region).not.toBe("");
    const zero = region.indexOf("finalParams[field.name] = 0;");
    expect(zero).toBeGreaterThanOrEqual(0);
    expect(region).toContain("finalParams[field.name] = false;");
    expect(region).toContain("finalParams[field.name] = [];");
    expect(region).toContain('finalParams[field.name] = "";');
    const guard = region.indexOf("isNoZeroFillField(");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(zero);
  });

  it("the drawer's handleSaveInputs still spreads the saved params before editedParams", () => {
    const region = extractBracedRegion(
      stripComments(read(drawer)),
      /const handleSaveInputs = \(\) =>/,
    );
    expect(region).not.toBe("");
    expect(region).toMatch(/\.\.\.selectedCommand\.commandInfo\.params,\s*\.\.\.editedParams,/);
    for (const pattern of [/OptionsSelect/, /applyChange/, /tool\.options/, /useToolOptions/]) {
      expect(region, String(pattern)).not.toMatch(pattern);
    }
  });
});

describe("F.A.S.T. local field invariants (D-07, D-08, D-09, D-17)", () => {
  const modal = "components/protocols/AddToolCommandModal.tsx";
  const drawer = "components/protocols/CommandDetailsDrawer.tsx";
  const page = "pages/tools/[id].tsx";
  const fieldOptions = "components/tools/fieldOptions.ts";
  const staticSelect = "components/tools/StaticSelect.tsx";
  const checkbox = "components/tools/TipReuseCheckbox.tsx";

  const clientFiles = () => ["components", "hooks", "pages"].flatMap((dir) => walk(dir)).map(rel);
  const allFiles = () =>
    ["server", "components", "hooks", "pages", "utils"].flatMap((dir) => walk(dir)).map(rel);

  it("DECK_SLOTS is assigned exactly once, in fieldOptions.ts", () => {
    const definers = allFiles().filter((relPath) =>
      /\bDECK_SLOTS\s*=(?!=)/.test(stripComments(read(relPath))),
    );
    expect(definers).toStrictEqual([fieldOptions]);
  });

  it("the six-number deck list is never written out as a literal", () => {
    // server/routers/inventory.ts lists the columns of a 24-well plate, which
    // happen to be 1-6; it is not a deck list.
    const columnsOf24WellPlate = "server/routers/inventory.ts";
    const writers = allFiles()
      .filter((relPath) => relPath !== columnsOf24WellPlate)
      .filter((relPath) => /\[\s*1,\s*2,\s*3,\s*4,\s*5,\s*6\s*\]/.test(read(relPath)));
    expect(writers).toStrictEqual([]);
  });

  it("StaticSelect and TipReuseCheckbox have no effect, instrument read or selection construct", () => {
    for (const file of [staticSelect, checkbox]) {
      const src = stripComments(read(file));
      expect(src, file).not.toMatch(/\buse(Layout)?Effect\b/);
      expect(src, file).not.toMatch(/useToolOptions/);
      expect(src, file).not.toMatch(/tool\.options/);
      for (const pattern of [
        /options\[0\]/,
        /selectedIndex/,
        /defaultValue/,
        /defaultChecked/,
        /\bselected=/,
        /placeholder=/,
      ]) {
        expect(src, file + " " + String(pattern)).not.toMatch(pattern);
      }
    }
  });

  it("get_plates is in no client file and is no commandFields key (PLT-05)", () => {
    const naming = clientFiles().filter((relPath) => read(relPath).includes("get_plates"));
    expect(naming).toStrictEqual([]);
    const constants = stripComments(read("components/tools/constants.ts"));
    expect(constants).not.toContain("get_plates");
  });

  it("each of the three hosts looks up local bindings and renders both local controls", () => {
    for (const file of [page, modal, drawer]) {
      const src = stripComments(read(file));
      expect(src, file).toContain("lookupLocalBinding(");
      expect(src, file).toContain("<StaticSelect");
      expect(src, file).toContain("<TipReuseCheckbox");
    }
  });

  it("newStepDefaults is called in exactly the tool page and the modal, never the drawer (D-09)", () => {
    const callers = clientFiles()
      .filter((relPath) => stripComments(read(relPath)).includes("newStepDefaults("))
      .filter((relPath) => relPath !== fieldOptions)
      .sort();
    expect(callers).toStrictEqual([modal, page].sort());
    expect(stripComments(read(drawer))).not.toContain("newStepDefaults");
  });

  it("the drawer looks up local bindings only while editing", () => {
    const src = stripComments(read(drawer));
    expect(src).toMatch(/isEditing\s*\?\s*lookupLocalBinding\(/);
  });
});

describe("F.A.S.T. well picker invariants (D-10, D-13, D-16, D-17)", () => {
  const picker = "components/tools/WellPicker.tsx";
  const geometry = "components/tools/wellGeometry.ts";
  const pointer = "components/tools/wellPointer.ts";
  const modal = "components/protocols/AddToolCommandModal.tsx";
  const drawer = "components/protocols/CommandDetailsDrawer.tsx";
  const page = "pages/tools/[id].tsx";

  const clientFiles = () => ["components", "hooks", "pages"].flatMap((dir) => walk(dir)).map(rel);

  it("WellPicker.tsx declares no effect hook, timer, DOM point lookup or raw-HTML injection", () => {
    const src = stripComments(read(picker));
    for (const pattern of [
      /\buse(Layout)?Effect\b/,
      /setTimeout/,
      /setInterval/,
      /elementFromPoint/,
      /dangerouslySetInnerHTML/,
    ]) {
      expect(src, String(pattern)).not.toMatch(pattern);
    }
  });

  it("WellPicker.tsx handles pointer cancel and lost capture", () => {
    const src = stripComments(read(picker));
    expect(src).toContain("onPointerCancel");
    expect(src).toContain("onLostPointerCapture");
  });

  it("WellPicker.tsx has no first-option, initial-value or selection construct", () => {
    const src = stripComments(read(picker));
    for (const pattern of [
      /options\[0\]/,
      /selectedIndex/,
      /defaultValue/,
      /defaultChecked/,
      /\bselected=/,
      /placeholder=/,
    ]) {
      expect(src, String(pattern)).not.toMatch(pattern);
    }
  });

  it("WellPicker.tsx never names tool.options and its only read passes fast.plates", () => {
    const src = stripComments(read(picker));
    expect(src).not.toContain("tool.options");
    const calls = src.match(/useToolOptions\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(src).toContain('useToolOptions(toolId, "fast.plates"');
  });

  it("wellGeometry.ts imports neither React nor Chakra UI", () => {
    const src = stripComments(read(geometry));
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/from\s+["']@chakra-ui\//);
  });

  it("every source-grid pointer event goes through sourcePointerStep (WR-01)", () => {
    const src = stripComments(read(picker));
    expect(src).toContain("sourcePointerStep(");
    expect(src).toMatch(/buttons:\s*e\.buttons/);
    for (const type of ["down", "move", "up", "cancel", "lost-capture", "leave"]) {
      expect(src, type).toContain(`type: "${type}"`);
    }
    expect(src).not.toMatch(/\banchor\.current\b/);
    expect(src).not.toMatch(/\blastRect\b/);
  });

  it("only wellGeometry.ts and wellPointer.ts call the source-patch and drag-rect producers", () => {
    const files = clientFiles();
    for (const producer of ["sourcePatch", "dragRect"]) {
      const callers = files
        .filter((relPath) => new RegExp(`\\b${producer}\\(`).test(stripComments(read(relPath))))
        .sort();
      expect(callers, producer).toStrictEqual([geometry, pointer].sort());
    }
  });

  it("wellPointer.ts imports neither React nor Chakra UI and only wellGeometry", () => {
    const src = stripComments(read(pointer));
    expect(src).not.toMatch(/from\s+["']react["']/);
    expect(src).not.toMatch(/from\s+["']@chakra-ui\//);
    const specs = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(new Set(specs)).toStrictEqual(new Set(["@/components/tools/wellGeometry"]));
  });

  it("StaticSelect, TipReuseCheckbox and WellPicker inject no raw HTML", () => {
    for (const file of [
      "components/tools/StaticSelect.tsx",
      "components/tools/TipReuseCheckbox.tsx",
      picker,
    ]) {
      expect(stripComments(read(file)), file).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("exactly the three hosts render <FastTransferWellPicker", () => {
    const hosts = clientFiles()
      .filter((relPath) => stripComments(read(relPath)).includes("<FastTransferWellPicker"))
      .sort();
    expect(hosts).toStrictEqual([modal, drawer, page].sort());
  });

  it("the bare WellPicker element appears only in WellPicker.tsx", () => {
    const users = clientFiles().filter((relPath) =>
      /<WellPicker[\s>/]/.test(stripComments(read(relPath))),
    );
    expect(users).toStrictEqual([picker]);
  });

  it("the drawer mounts the picker only while editing and never reads while read-only", () => {
    const src = stripComments(read(drawer));
    const element = src.match(/<FastTransferWellPicker[\s\S]*?\/>/);
    expect(element).not.toBeNull();
    expect(element?.[0] ?? "").toContain("enabled={isEditing}");
    expect(src).toMatch(/isEditing\s*\?\s*lookupLocalBinding\(/);
  });

  it("CLEAR_PATCH is referenced only by wellGeometry.ts and WellPicker.tsx", () => {
    const files = ["server", "components", "hooks", "pages", "utils"]
      .flatMap((dir) => walk(dir))
      .map(rel);
    const users = files
      .filter((relPath) => /\bCLEAR_PATCH\b/.test(stripComments(read(relPath))))
      .sort();
    expect(users).toStrictEqual([geometry, picker].sort());
  });
});

describe("concurrency lane seams (D-09, D-10, D-14)", () => {
  const queueSrc = stripComments(read("server/command_queue.ts"));

  it("_start's first statement is the lane-mode early return", () => {
    const body = extractBracedRegion(queueSrc, /async _start\(/);
    const early = body.indexOf("if (this._laneMode) return this._startLanes(source);");
    expect(early).toBeGreaterThanOrEqual(0);
    expect(early).toBeLessThan(body.indexOf("if (this._runningPromise)"));
    // Nothing but whitespace sits between the opening brace and the early return.
    expect(body.slice(body.indexOf("{") + 1, early).trim()).toBe("");
  });

  it("_pickNext has no await between the row read and the claim, and keeps the legacy call", () => {
    const region = extractBracedRegion(queueSrc, /private async _pickNext\(/);
    const read = region.indexOf("queuedRowsSync()");
    const claim = region.indexOf("claimEligible(");
    expect(read).toBeGreaterThanOrEqual(0);
    expect(claim).toBeGreaterThan(read);
    expect(region.slice(read, claim)).not.toMatch(/\bawait\b/);
    expect(region).toContain("return this.commands.startNext();");
  });

  it("the side-lane worker never touches modal state, never stops the queue, runs no Tool Box step", () => {
    const region = extractBracedRegion(queueSrc, /private async _runSideLane\(/);
    expect(region).not.toMatch(/_isWaitingForInput|_messageResolve|_currentMessage|_timerTimeout/);
    expect(region).not.toContain("this.stop(");
    expect(region).not.toMatch(/=== "Tool Box"/);
  });

  it("laneScheduling.ts has no import line and no timer", () => {
    const src = stripComments(read("server/laneScheduling.ts"));
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\bsetTimeout\s*\(|\bsetInterval\s*\(/);
  });

  it("the lane code adds no second failure-recording site", () => {
    const assignments = queueSrc.match(/this\.error\s*=(?!=)(?!\s*undefined\b)/g) ?? [];
    expect(assignments.length).toBe(1);
  });

  it("the flag is read once, in the constructor", () => {
    const reads = queueSrc.match(/process\.env\.GALAGO_PARALLEL_LANES/g) ?? [];
    expect(reads.length).toBe(1);
    const ctor = extractBracedRegion(queueSrc, /constructor\(/);
    expect(ctor).toContain('process.env.GALAGO_PARALLEL_LANES === "1"');
  });
});
