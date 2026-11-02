import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Static source invariants for the tool page's Reply meta_data panel (GEN-03,
// UI-SPEC AC-3) and the born-empty field display (UI-SPEC AC-4). Same
// convention as staticScan.test.ts: fs/path only, source scans with
// stripComments — no runtime import of the page, no jsdom/RTL.

const ROOT = path.resolve(__dirname, "..");
const PAGE = "pages/tools/[id].tsx";

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// Removes block and line comments while preserving string/template literal
// contents verbatim (staticScan's convention — asserts over code, not prose).
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

describe("tool page reply panel (GEN-03, UI-SPEC AC-3)", () => {
  const src = stripComments(read(PAGE));

  it("introduces no timing or polling construct", () => {
    for (const construct of ["setInterval", "setTimeout", "refetchInterval"]) {
      expect(src, construct).not.toContain(construct);
    }
  });

  it("keeps both copy strings as module-top constants and renders them", () => {
    expect(src).toMatch(/^const REPLY_META_DATA_LABEL = "/m);
    expect(src).toMatch(/^const NO_REPLY_DATA_LABEL = "/m);
    expect(src).toContain("{REPLY_META_DATA_LABEL}");
    expect(src).toContain("{NO_REPLY_DATA_LABEL}");
  });

  it("renders the reply through the shared BoundedRawJson component", () => {
    expect(src).toMatch(/import \{ BoundedRawJson \} from "@\/components\/ui\/BoundedRawJson";/);
    expect(src).toContain("<BoundedRawJson");
  });

  it("sets the reply state only from the mutation's onSuccess handler", () => {
    expect((src.match(/setLastReply\(/g) ?? []).length).toBe(1);
    expect(src).toContain("setLastReply(data ?? null)");
    const onSuccessAt = src.indexOf("onSuccess: (data) => {");
    const onErrorAt = src.indexOf("onError: (error) => {");
    const callAt = src.indexOf("setLastReply(");
    expect(onSuccessAt).toBeGreaterThan(-1);
    expect(onErrorAt).toBeGreaterThan(onSuccessAt);
    expect(callAt).toBeGreaterThan(onSuccessAt);
    expect(callAt).toBeLessThan(onErrorAt);
  });

  it("collapses the disclosure at the start of every send", () => {
    const fnStart = src.indexOf("const executeCommandWithToast");
    const fnEnd = src.indexOf("const handleSubmit");
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain("setReplyOpen(false)");
  });
});

describe("born-empty display contract (UI-SPEC AC-4)", () => {
  const src = stripComments(read(PAGE));

  it("no painted false/0 fallback remains in renderFields", () => {
    expect(src).not.toContain('|| "false"');
    expect(src).not.toContain("|| 0");
    expect((src.match(/\?\? ""/g) ?? []).length).toBe(2);
  });

  it("the STACK send coerces boolean strings then strips blanks; every other tool type sends formValues verbatim", () => {
    // CR-01 gap closure (05-04): coercion wraps INSIDE the strip's argument —
    // coerceBooleanParams runs BEFORE omitBlankParams — and the ternary still
    // scopes both to STACK only, with the `: formValues` fallback verbatim for
    // every other tool type.
    expect(src).toMatch(
      /params:\s*String\(config\?\.type\) === "stack"\s*\?\s*omitBlankParams\(\s*coerceBooleanParams\(\s*formValues[\s\S]*?\)\s*,\s*\)\s*:\s*formValues/,
    );
  });

  it("pins the NumberInput NaN guard: a cleared number stores the born-empty '' (WR-01)", () => {
    expect(src).toContain('Number.isNaN(valueNumber) ? ""');
  });
});
