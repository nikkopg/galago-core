// Proves that the control-path payloads (Pause/Resume/Abort) and run_state
// survive the REAL generated protobuf encoders — not just the payload-object
// level that plans 01-02/01-03 asserted against the fake gRPC double (D-19,
// QUE-01, QUE-04).
import { describe, it, expect, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";
import { omitBlankParams, coerceBooleanParams } from "@/components/tools/commandParams";
import { extractRunState } from "@/server/runState";
import { parseDeviceTree, parseRobotStates } from "@/server/toolOptions";
import type { OptionsResult } from "@/server/toolOptions";
import {
  applyChange,
  applyLocalChange,
  buildCascadeOptions,
  listOptions,
  lookupFieldBinding,
  lookupLocalBinding,
} from "@/components/tools/fieldOptions";
import { DEVICE_TREE_GOLDEN, ROBOT_STATES_GOLDEN } from "./fixtures/stackOptions";

describe("wire contract", () => {
  afterEach(async () => {
    await removeFakeTool("wire-fast");
    await removeFakeTool("wire-stack");
  });

  it("encodes the control payloads into the fast Command oneof", () => {
    const { tool } = installFakeTool("wire-fast", ToolType.fast);

    const pausePayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "pause",
      params: {},
    });
    const pauseDecoded = tool_base.Command.decode(tool_base.Command.encode(pausePayload).finish());
    expect(pauseDecoded.fast?.pause).toBeDefined();

    const resumePayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "resume",
      params: { is_tip_broken: "no" },
    });
    const resumeDecoded = tool_base.Command.decode(
      tool_base.Command.encode(resumePayload).finish(),
    );
    expect(resumeDecoded.fast?.resume?.is_tip_broken).toBe("no");

    const abortPayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "abort",
      params: { return_liquid: "yes" },
    });
    const abortDecoded = tool_base.Command.decode(tool_base.Command.encode(abortPayload).finish());
    expect(abortDecoded.fast?.abort?.return_liquid).toBe("yes");
  });

  // 261104-or1 legacy contract: the form no longer offers a per-command tray
  // override, but a protocol saved before that change still loads and runs
  // unchanged. The step drawer renders and keeps every saved params key
  // (CommandDetailsDrawer), _payloadForCommand sends params verbatim, and the
  // generated Command_Transfer keeps the field - so the saved value reaches the
  // wire and the adapter still prefers it over the Config (galago-tools D-14).
  it("encodes a legacy saved F.A.S.T. transfer step that still carries expected_tray_id", () => {
    const { tool } = installFakeTool("wire-fast", ToolType.fast);

    const payload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "transfer",
      params: {
        source_deck: 1,
        dest_deck: 2,
        source_plate_id: 10,
        dest_plate_id: 11,
        source_start_row: "A",
        source_start_col: 1,
        dest_start_row: "A",
        dest_start_col: 1,
        num_rows: 1,
        num_cols: 1,
        volume: 50,
        tip_reuse: "fresh",
        expected_tray_id: 7,
      },
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.fast?.transfer?.expected_tray_id).toBe(7);
    expect(decoded.fast?.transfer?.volume).toBe(50);
  });

  // PLT-06 (DRP-09 carried): a deck chosen from the static select is written by
  // applyLocalChange as a number and reaches the REAL generated encoder as an
  // int32; tip_reuse keeps the string it was given.
  it("encodes decks chosen through applyLocalChange as int32 on the F.A.S.T. transfer", () => {
    const { tool } = installFakeTool("wire-fast", ToolType.fast);
    const sourceDeck = lookupLocalBinding("fast", "transfer", "source_deck");
    const destDeck = lookupLocalBinding("fast", "transfer", "dest_deck");
    expect(sourceDeck).toBeDefined();
    expect(destDeck).toBeDefined();
    if (sourceDeck === undefined || destDeck === undefined) return;

    const params = {
      source_deck: "",
      dest_deck: "",
      source_plate_id: 10,
      dest_plate_id: 11,
      source_start_row: "A",
      source_start_col: 1,
      dest_start_row: "A",
      dest_start_col: 1,
      num_rows: 1,
      num_cols: 1,
      volume: 50,
      tip_reuse: "fresh",
      ...applyLocalChange(sourceDeck, "3"),
      ...applyLocalChange(destDeck, "5"),
    };
    const payload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "transfer",
      params,
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.fast?.transfer?.source_deck).toBe(3);
    expect(decoded.fast?.transfer?.dest_deck).toBe(5);
    expect(decoded.fast?.transfer?.tip_reuse).toBe("fresh");
  });

  // PLT-02 (07-05): get_plates is oneof entry 11 of the fast Command. Before the
  // re-pin it encoded as an empty fast.Command (RESEARCH Pitfall 1); on the
  // regenerated codec the refresh flag and the bare read both round-trip.
  it("encodes the get_plates read into the fast Command oneof (07-05)", () => {
    const withRefresh = tool_base.Command.decode(
      tool_base.Command.encode({ fast: { get_plates: { refresh: true } } } as tool_base.Command)
        .finish(),
    );
    expect(withRefresh.fast?.get_plates).toBeDefined();
    expect(withRefresh.fast?.get_plates?.refresh).toBe(true);

    const bare = tool_base.Command.decode(
      tool_base.Command.encode({ fast: { get_plates: {} } } as tool_base.Command).finish(),
    );
    expect(bare.fast?.get_plates).toBeDefined();
    expect(bare.fast?.get_plates?.refresh).toBeUndefined();
  });

  // GEN-04a (D-07a): the operator acknowledge payload survives the REAL
  // generated encoder with guid and arm_inspected intact — the first
  // real-encoder evidence for the Phase 4 acknowledge work. Fakes only; the
  // command-name literal lives only in a test file (the OPR-05 closed-carrier
  // scan walks components/hooks/pages/server, never test/).
  it("encodes the acknowledge payload into the stack Command oneof", () => {
    const { tool } = installFakeTool("wire-stack", ToolType.stack);

    const payload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "acknowledge_failure",
      params: { guid: "task-guid", arm_inspected: "yes" },
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.stack?.acknowledge_failure?.guid).toBe("task-guid");
    expect(decoded.stack?.acknowledge_failure?.arm_inspected).toBe("yes");
  });

  // D-04 blank-optional (RESEARCH Pitfall 5): every stack.proto command field
  // is proto3 optional, and ts-proto encodes those on !== undefined — so a
  // blank "" is wire-visible while an omitted key is not. The page seeds every
  // untouched field as "" and the STACK send strips blanks (omitBlankParams,
  // 05-02). Pinned BOTH ways against the real encoder: stripped, the untouched
  // fields decode ABSENT and only the operator's typed choice travels;
  // unstripped, the blank decodes as a present empty string — why the strip
  // exists. Fakes only — no STACK motion.
  it("omits blank transfer params for STACK: the typed field decodes present, untouched fields decode absent", () => {
    const { tool } = installFakeTool("wire-stack", ToolType.stack);

    // Exactly as the page would send transfer: every field seeded "" (the
    // formValues seeding — no stack field has a defaultValue) and the operator
    // typed robot.
    const pageParams: Record<string, unknown> = {
      step_key: "",
      robot: "r1",
      labware_profile: "",
      source_device: "",
      source_deck: "",
      source_nest: "",
      source_transfer_profile: "",
      destination_device: "",
      destination_deck: "",
      destination_nest: "",
      destination_transfer_profile: "",
      timeout_s: "",
    };

    const strippedPayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "transfer",
      params: omitBlankParams(pageParams),
    });
    const strippedDecoded = tool_base.Command.decode(
      tool_base.Command.encode(strippedPayload).finish(),
    );
    expect(strippedDecoded.stack?.transfer?.robot).toBe("r1"); // the typed choice travels
    expect(strippedDecoded.stack?.transfer?.step_key).toBeUndefined(); // blank = omitted, never sent
    expect(strippedDecoded.stack?.transfer?.timeout_s).toBeUndefined();

    // The same params WITHOUT the strip: proto3 optional encodes on !==
    // undefined, so the blank reaches the wire as a present empty string.
    const unstrippedPayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "transfer",
      params: pageParams,
    });
    const unstrippedDecoded = tool_base.Command.decode(
      tool_base.Command.encode(unstrippedPayload).finish(),
    );
    expect(unstrippedDecoded.stack?.transfer?.robot).toBe("r1");
    expect(unstrippedDecoded.stack?.transfer?.step_key).toBe(""); // present WITH the empty string
    expect(unstrippedDecoded.stack?.transfer?.step_key).toBeDefined();
  });

  // CR-01 (05-04 gap closure): the page stores the operator's typed value in a
  // boolean field as the STRING "false" (<Input type="boolean"> falls back to a
  // text input), and protobufjs Writer.bool is value ? 1 : 0 — so the
  // uncoerced string encodes as true and NO input could send false. Proven on
  // the REAL generated encoder through the page-shaped params the page actually
  // produces: coercion (coerceBooleanParams) then the blank strip
  // (omitBlankParams) — exactly the handleSubmit STACK pipeline order. Fakes
  // only — no STACK motion.
  it("sends a real boolean for a STACK refresh field: a typed 'false' decodes false after coercion (and still decodes true without it)", () => {
    const { tool } = installFakeTool("wire-stack", ToolType.stack);

    // Exactly as the page would send list_devices after the operator typed
    // into the boolean text field: the stored value is the STRING "false".
    const booleanFields = [{ name: "refresh", type: "boolean" }];
    const pageParams: Record<string, unknown> = { refresh: "false" };

    const uncoercedPayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "list_devices",
      params: omitBlankParams(pageParams),
    });
    const uncoercedDecoded = tool_base.Command.decode(
      tool_base.Command.encode(uncoercedPayload).finish(),
    );
    // The pinned CR-01 defect is now in the test: WITHOUT coercion the truthy
    // string encodes as 1 and decodes true — this is what the coercion closes.
    expect(uncoercedDecoded.stack?.list_devices?.refresh).toBe(true);

    // The fixed page pipeline: coerce boolean-typed strings first, then strip.
    const coercedParams = omitBlankParams(coerceBooleanParams(pageParams, booleanFields));
    const coercedPayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "list_devices",
      params: coercedParams,
    });
    const coercedDecoded = tool_base.Command.decode(
      tool_base.Command.encode(coercedPayload).finish(),
    );
    expect(coercedDecoded.stack?.list_devices?.refresh).toBe(false); // the operator's actual choice

    // A typed "true" keeps decoding true through the same pipeline.
    const trueParams = omitBlankParams(coerceBooleanParams({ refresh: "true" }, booleanFields));
    const truePayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "list_devices",
      params: trueParams,
    });
    const trueDecoded = tool_base.Command.decode(tool_base.Command.encode(truePayload).finish());
    expect(trueDecoded.stack?.list_devices?.refresh).toBe(true);

    // An untouched '' stays born-empty through coercion and is blank-stripped:
    // it decodes ABSENT (undefined) — never sent.
    const untouchedParams = omitBlankParams(coerceBooleanParams({ refresh: "" }, booleanFields));
    const untouchedPayload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "list_devices",
      params: untouchedParams,
    });
    const untouchedDecoded = tool_base.Command.decode(
      tool_base.Command.encode(untouchedPayload).finish(),
    );
    expect(untouchedDecoded.stack?.list_devices?.refresh).toBeUndefined();
  });

  // DRP-09 (D-15): a dropdown value is the plain string the operator would
  // have typed, so the encoded STACK Command is byte-identical either way and no
  // submit path changes. Options are built from the golden list-read replies
  // through the real parsers and the client view-model builders. Fakes only —
  // no STACK motion.
  it("encodes a dropdown-chosen STACK transfer to the same bytes as the same values typed", () => {
    const { tool } = installFakeTool("wire-stack", ToolType.stack);

    const robots = parseRobotStates(ROBOT_STATES_GOLDEN);
    const tree = parseDeviceTree(DEVICE_TREE_GOLDEN);
    if (typeof robots === "string" || robots.shape !== "list") throw new Error("robots");
    if (typeof tree === "string" || tree.shape !== "tree") throw new Error("tree");
    const robotData: OptionsResult = {
      status: "ok",
      source: "stack.robots",
      shape: "list",
      names: robots.names,
      degraded: robots.degraded,
      fetchedAt: 0,
    };

    const bound = (field: string) => {
      const found = lookupFieldBinding("stack", "transfer", field);
      if (found === undefined) throw new Error(field);
      return found;
    };
    // The operator's choices, each through applyChange like a host onChange.
    let chosen: Record<string, string | number> = {};
    const choose = (field: string, options: { value: string }[]) => {
      expect(options.length).toBe(1);
      chosen = { ...chosen, ...applyChange(bound(field), options[0].value) };
    };
    choose("robot", listOptions(robotData));
    choose("source_device", buildCascadeOptions(tree, bound("source_device"), chosen).options);
    choose("source_deck", buildCascadeOptions(tree, bound("source_deck"), chosen).options);
    choose("source_nest", buildCascadeOptions(tree, bound("source_nest"), chosen).options);

    const typed = {
      robot: "stack2-6",
      source_device: "nest-1",
      source_deck: "deck1",
      source_nest: "A1",
    };
    expect(chosen).toStrictEqual(typed);

    const encode = (params: Record<string, unknown>) =>
      Array.from(
        tool_base.Command.encode(
          tool._payloadForCommand({
            toolId: "wire-stack",
            toolType: ToolType.stack,
            command: "transfer",
            params: omitBlankParams(params),
          }),
        ).finish(),
      );
    expect(encode(chosen)).toStrictEqual(encode(typed));
  });

  it("carries run_state through StatusReply into the runState envelope", () => {
    const statusReply = {
      uptime: 3,
      status: tool_base.ToolStatus.BUSY,
      run_state: {
        state: "paused",
        percent: 40,
        pause: {
          errorCode: -645,
          errorName: "WrongPlateType",
          percent: 0,
          eventPayload: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          since: "2026-10-12T09:00:00Z",
        },
      },
    };

    const decoded = tool_base.StatusReply.decode(
      tool_base.StatusReply.encode(statusReply).finish(),
    );

    const result = extractRunState(decoded);
    expect(result).toEqual({
      ok: true,
      runState: {
        state: "paused",
        percent: 40,
        pause: {
          name: "WrongPlateType",
          code: -645,
          detail: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          startedAt: "2026-10-12T09:00:00Z",
        },
      },
    });
  });
});
