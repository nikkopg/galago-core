// React-free: no react import, and the server module is imported for TYPES only
// (`import type` is erased, so no server value ever reaches the client bundle).
// This module decides which command fields are instrument-fed dropdowns and
// turns a tool.options result into the view the shared OptionsSelect renders.
// commandFields stays untouched (STK-07): a bound field is still a typed
// "text" field there, which is exactly what the unavailable mode falls back to.
import type { OptionSourceId, OptionsResult, StackDevice } from "@/server/toolOptions";
import { WELL_FIELDS, plateLabel, wellFieldPatch } from "@/components/tools/wellGeometry";
import type { PlateListInput, WellField } from "@/components/tools/wellGeometry";
import { isVariableLike } from "@/utils/variableRef";
import { int32FromDigits } from "@/utils/int32";

export const OPTIONS_STALE_MS = 15000;
export const UNAVAILABLE_HINT = "Instrument list unavailable — type the value";
export const NOT_REPORTED_SUFFIX = " (not reported by instrument)";
export const LOADING_LABEL = "Loading…";
export const AMBIGUOUS_SUFFIX = " (ambiguous — adapter will refuse)";
export const DUPLICATE_SUFFIX = " (duplicate id — check instrument)";
export const NO_CALIBRATED_DECKS = "No calibrated decks on this device";
export const NO_CALIBRATED_NESTS = "No calibrated nests on this deck";
export const VARIABLE_PARENT_HINT = "child list unavailable while the parent is a variable";
export const DEGRADED_SUFFIX = " · some entries skipped";
export const REFRESH_LABEL = "Refresh";
export const REFRESHING_LABEL = "Refreshing…";

// The one definition of the F.A.S.T. deck-slot count (D-08). It mirrors
// _DECK_SLOTS = 6 in vendor/galago-tools/tools/fast/server.py:129; the adapter
// refuses a source_deck or dest_deck outside 1-DECK_SLOTS before any motion.
// The deck option list below is derived from it, never written out.
export const DECK_SLOTS = 6;
export const DECK_SLOT_OPTIONS: readonly number[] = Array.from(
  { length: DECK_SLOTS },
  (_, index) => index + 1,
);
export const NOT_A_DECK_SLOT_SUFFIX = " (not a deck slot 1-6)";
export const REUSE_TIPS_LABEL = "Reuse tips";
export const TIP_REUSE_HELPER = "Checked sends reuse, unchecked sends fresh.";

// The {source} word in the Refresh button's aria-label ("Refresh {source} list").
export const SOURCE_LABELS: Record<OptionSourceId, string> = {
  "stack.robots": "robots",
  "stack.devices": "devices",
  "stack.labwareProfiles": "labware profiles",
  "stack.transferProfiles": "transfer profiles",
  "fast.plates": "plates",
};

export type CascadeSide = "source" | "destination";
export type CascadeLevel = "device" | "deck" | "nest";

export type FieldRole =
  | { kind: "list" }
  | { kind: "cascade"; side: CascadeSide; level: CascadeLevel }
  | { kind: "plate"; side: CascadeSide };

export interface FieldBinding {
  field: string;
  source: OptionSourceId;
  role: FieldRole;
}

function list(field: string, source: OptionSourceId): FieldBinding {
  return { field, source, role: { kind: "list" } };
}

function cascade(field: string, side: CascadeSide, level: CascadeLevel): FieldBinding {
  return { field, source: "stack.devices", role: { kind: "cascade", side, level } };
}

function plate(field: string, side: CascadeSide): FieldBinding {
  return { field, source: "fast.plates", role: { kind: "plate", side } };
}

function byField(bindings: FieldBinding[]): Record<string, FieldBinding> {
  const out: Record<string, FieldBinding> = {};
  for (const binding of bindings) {
    out[binding.field] = binding;
  }
  return out;
}

// transfer and get_transfer_estimate share the same bound fields; both get their
// own array so neither can alias the other. step_key, timeout_s, refresh and every
// list_* / get_* command stay typed inputs (D-10).
function transferBindings(): FieldBinding[] {
  return [
    list("robot", "stack.robots"),
    list("labware_profile", "stack.labwareProfiles"),
    cascade("source_device", "source", "device"),
    cascade("source_deck", "source", "deck"),
    cascade("source_nest", "source", "nest"),
    list("source_transfer_profile", "stack.transferProfiles"),
    cascade("destination_device", "destination", "device"),
    cascade("destination_deck", "destination", "deck"),
    cascade("destination_nest", "destination", "nest"),
    list("destination_transfer_profile", "stack.transferProfiles"),
  ];
}

export const FIELD_BINDINGS: Record<string, Record<string, Record<string, FieldBinding>>> = {
  stack: {
    transfer: byField(transferBindings()),
    get_transfer_estimate: byField(transferBindings()),
    get_labware_presence: byField([list("robot", "stack.robots")]),
  },
  // Decks, tip_reuse and the well fields are local bindings, not instrument-fed.
  fast: {
    transfer: byField([plate("source_plate_id", "source"), plate("dest_plate_id", "destination")]),
  },
};

function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

// Own-property checks at every level: a field named "constructor" or
// "__proto__" must never resolve through the prototype chain.
export function lookupFieldBinding(
  toolType: string,
  command: string | undefined,
  fieldName: string,
): FieldBinding | undefined {
  if (command === undefined) return undefined;
  const commands = own(FIELD_BINDINGS, toolType);
  if (commands === undefined) return undefined;
  const fields = own(commands, command);
  if (fields === undefined) return undefined;
  return own(fields, fieldName);
}

// ---------------------------------------------------------------------------
// Local bindings (PLT-06): F.A.S.T. fields whose control needs no instrument
// read. A static binding offers an in-code option list (the deck slots). It is
// a separate map from FIELD_BINDINGS so lookupFieldBinding stays unchanged and
// no field is ever both instrument-fed and local.

export type StaticRole = {
  kind: "static";
  options: readonly number[];
  notListedSuffix: string;
};

export interface StaticBinding {
  field: string;
  role: StaticRole;
}

export type CheckboxRole = { kind: "checkbox"; checked: string; unchecked: string };

export interface CheckboxBinding {
  field: string;
  role: CheckboxRole;
}

// The six well fields share one picker (D-11): each is a typed input whose
// writes go through wellFieldPatch, and the host renders the picker once at the
// first of them.
export interface WellsBinding {
  field: string;
  role: { kind: "wells" };
}

export type LocalBinding = StaticBinding | CheckboxBinding | WellsBinding;

export function isWellsBinding(b: LocalBinding): b is WellsBinding {
  return b.role.kind === "wells";
}

export function isStaticBinding(b: LocalBinding): b is StaticBinding {
  return b.role.kind === "static";
}

export function isCheckboxBinding(b: LocalBinding): b is CheckboxBinding {
  return b.role.kind === "checkbox";
}

function deckBinding(field: string): StaticBinding {
  return {
    field,
    role: { kind: "static", options: DECK_SLOT_OPTIONS, notListedSuffix: NOT_A_DECK_SLOT_SUFFIX },
  };
}

function byLocalField(bindings: LocalBinding[]): Record<string, LocalBinding> {
  const out: Record<string, LocalBinding> = {};
  for (const binding of bindings) {
    out[binding.field] = binding;
  }
  return out;
}

export const LOCAL_BINDINGS: Record<string, Record<string, Record<string, LocalBinding>>> = {
  fast: {
    transfer: byLocalField([
      deckBinding("source_deck"),
      deckBinding("dest_deck"),
      {
        field: "tip_reuse",
        role: { kind: "checkbox", checked: "reuse", unchecked: "fresh" },
      },
      ...WELL_FIELDS.map((field): LocalBinding => ({ field, role: { kind: "wells" } })),
    ]),
  },
};

// Same own-property discipline as lookupFieldBinding at every level.
export function lookupLocalBinding(
  toolType: string,
  command: string | undefined,
  fieldName: string,
): LocalBinding | undefined {
  if (command === undefined) return undefined;
  const commands = own(LOCAL_BINDINGS, toolType);
  if (commands === undefined) return undefined;
  const fields = own(commands, command);
  if (fields === undefined) return undefined;
  return own(fields, fieldName);
}

export type OptionsMode = "loading" | "ok" | "unavailable";

// isError is checked first (a query in error keeps its previous data, which
// would otherwise show a stale list), then an explicit unavailable result, then
// the first load. An idle query (disabled) reads as unavailable so a form is
// never blocked behind a read that is not running.
export function deriveOptionsMode(q: {
  isError: boolean;
  isInitialLoading: boolean;
  data: OptionsResult | undefined;
}): OptionsMode {
  if (q.isError) return "unavailable";
  if (q.data !== undefined && q.data.status === "unavailable") return "unavailable";
  if (q.isInitialLoading) return "loading";
  if (q.data !== undefined && q.data.status === "ok") return "ok";
  return "unavailable";
}

export interface SelectOption {
  key: string;
  value: string;
  label: string;
  flag?: "ambiguous" | "not-reported" | "duplicate";
  // Cascade options only: the adapter's "/"-joined path (what ambiguous lists)
  // and the plain names it was built from.
  pathKey?: string;
  names?: { deviceName: string; deckName?: string; nestName?: string };
}

export interface SelectView {
  mode: "loading" | "ok" | "unavailable" | "variable-bound" | "child-of-variable";
  value: string;
  options: SelectOption[];
  disabled: boolean;
  hint?: string;
  note?: string;
}

export function listOptions(data: OptionsResult | undefined): SelectOption[] {
  if (data === undefined || data.status !== "ok" || data.shape !== "list") return [];
  return data.names.map((name, index) => ({
    key: String(index),
    value: name,
    label: name,
  }));
}

// One option per plate entry in reply order, labelled like the grid caption
// (plateLabel). Every entry sharing an id is flagged and kept: nothing is
// collapsed or deduplicated, so the operator sees the clash and chooses (D-05,
// PLT-04). The value is String(id) of a server-validated integer id.
export function plateOptions(data: OptionsResult | undefined): SelectOption[] {
  if (data === undefined || data.status !== "ok" || data.shape !== "plates") return [];
  const counts = new Map<number, number>();
  for (const entry of data.plates) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  return data.plates.map((entry, index) => {
    const duplicate = (counts.get(entry.id) ?? 0) > 1;
    const option: SelectOption = {
      key: String(index),
      value: String(entry.id),
      label: plateLabel(entry.id, entry.description) + (duplicate ? DUPLICATE_SUFFIX : ""),
    };
    if (duplicate) option.flag = "duplicate";
    return option;
  });
}

function isBlankValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

// Precedence (D-11, D-13): variable-bound, then child-of-variable (both only
// when the host allows variables), then unavailable, loading, ok. The optional
// inputs default to the 06-01 behaviour when omitted. A view never carries a
// patch: the value shown is always the value passed in, untouched.
export function buildSelectView(input: {
  mode: OptionsMode;
  value: unknown;
  offered: SelectOption[];
  allowVariables?: boolean;
  ancestorVariableBound?: boolean;
  parentBlank?: boolean;
  emptyNote?: string;
  notListedSuffix?: string;
}): SelectView {
  const { mode, value, offered } = input;
  const blank = isBlankValue(value);
  const current = blank ? "" : String(value);

  if (input.allowVariables === true && isVariableLike(value)) {
    return {
      mode: "variable-bound",
      value: current,
      options: [{ key: "variable", value: current, label: current }],
      disabled: true,
    };
  }

  if (input.allowVariables === true && input.ancestorVariableBound === true) {
    return {
      mode: "child-of-variable",
      value: current,
      options: [],
      disabled: false,
      hint: VARIABLE_PARENT_HINT,
    };
  }

  if (mode === "unavailable") {
    return {
      mode: "unavailable",
      value: current,
      options: [],
      disabled: false,
      hint: UNAVAILABLE_HINT,
    };
  }

  if (mode === "loading") {
    const options: SelectOption[] = [{ key: "loading", value: "", label: LOADING_LABEL }];
    if (!blank) {
      options.push({ key: "saved", value: current, label: current });
    }
    return { mode: "loading", value: current, options, disabled: true };
  }

  // ok: born on the explicit empty option; nothing is ever picked for the operator.
  const emptyOption: SelectOption = { key: "empty", value: "", label: "" };
  if (input.parentBlank === true && blank) {
    return { mode: "ok", value: "", options: [emptyOption], disabled: true };
  }
  const options: SelectOption[] = [emptyOption, ...offered];
  if (!blank && !offered.some((option) => String(option.value) === current)) {
    options.push({
      key: "not-reported",
      value: current,
      label: current + (input.notListedSuffix ?? NOT_REPORTED_SUFFIX),
      flag: "not-reported",
    });
  }
  const view: SelectView = { mode: "ok", value: current, options, disabled: false };
  if (input.emptyNote !== undefined) view.note = input.emptyNote;
  return view;
}

// One option per slot, in order. Read-free: the list is the binding's own.
export function staticOptions(binding: StaticBinding): SelectOption[] {
  return binding.role.options.map((n) => ({
    key: "slot-" + n,
    value: String(n),
    label: String(n),
  }));
}

// A static field is born on the explicit empty option; a saved value that is not
// one of the slots stays selected as one flagged extra option and is never
// rewritten (D-08). A view never carries a patch.
export function buildStaticView(input: {
  binding: StaticBinding;
  value: unknown;
  allowVariables: boolean;
}): SelectView {
  return buildSelectView({
    mode: "ok",
    value: input.value,
    offered: staticOptions(input.binding),
    allowVariables: input.allowVariables,
    notListedSuffix: input.binding.role.notListedSuffix,
  });
}

// An all-ASCII-digit string becomes a number (the wire field is an int32);
// anything else, including "", "3.5" and " 3", is returned verbatim so
// re-selecting a saved odd option never turns it into NaN.
export function numericPatch(field: string, value: string): Record<string, string | number> {
  if (/^[0-9]+$/.test(value)) return { [field]: Number(value) };
  return { [field]: value };
}

// The only producer of patches for a local binding. Nothing calls it except an
// operator event; opening or rendering a form never does. A static binding
// writes a number for an all-digit choice; a checkbox binding writes the string
// it is given.
export function applyLocalChange(
  binding: LocalBinding,
  value: string,
): Record<string, string | number> {
  if (isCheckboxBinding(binding)) return { [binding.field]: value };
  if (isWellsBinding(binding)) return wellFieldPatch(binding.field as WellField, value);
  return numericPatch(binding.field, value);
}

// True only for the first name, in the host's own field order, whose local
// binding is wells: where that host renders the picker once (D-11).
export function isWellGroupAnchor(
  fieldNames: readonly string[],
  toolType: string,
  command: string | undefined,
  fieldName: string,
): boolean {
  for (const name of fieldNames) {
    const binding = lookupLocalBinding(toolType, command, name);
    if (binding !== undefined && isWellsBinding(binding)) return name === fieldName;
  }
  return false;
}

// The picker's plate list from the shared fast.plates read. Anything but an ok
// plates result reads as unavailable; loading carries no plates.
export function plateListInput(mode: OptionsMode, data: OptionsResult | undefined): PlateListInput {
  if (mode === "loading") return { mode: "loading", plates: [] };
  if (mode === "ok" && data !== undefined && data.status === "ok" && data.shape === "plates") {
    return { mode: "ok", plates: data.plates };
  }
  return { mode: "unavailable", plates: [] };
}

export type CheckboxState = "checked" | "unchecked" | "indeterminate";

export interface CheckboxView {
  state: CheckboxState;
  disabled: boolean;
  flag?: string;
  variable?: string;
}

// The flag for a saved value that is neither of the two the checkbox writes.
export function checkboxFlag(binding: CheckboxBinding, value: unknown): string {
  const { checked, unchecked } = binding.role;
  const pair = " \u2014 not " + checked + "/" + unchecked + ")";
  if (isBlankValue(value)) return "(saved value is blank" + pair;
  return "(saved value '" + String(value) + "'" + pair;
}

// Exact, case-sensitive strict equality: no trim, no case folding. A view never
// carries a patch; opening a saved value never writes.
export function checkboxView(input: {
  binding: CheckboxBinding;
  value: unknown;
  allowVariables: boolean;
}): CheckboxView {
  const { binding, value } = input;
  if (input.allowVariables && isVariableLike(value)) {
    return { state: "indeterminate", disabled: true, variable: String(value) };
  }
  if (value === binding.role.checked) return { state: "checked", disabled: false };
  if (value === binding.role.unchecked) return { state: "unchecked", disabled: false };
  return { state: "indeterminate", disabled: false, flag: checkboxFlag(binding, value) };
}

// What a click writes: checked flips to unchecked, anything else becomes checked.
export function checkboxNextValue(binding: CheckboxBinding, state: CheckboxState): string {
  return state === "checked" ? binding.role.unchecked : binding.role.checked;
}

// Fields whose unset value is saved as "" and never as 0 (D-07, PLT-04: "an
// unset plate is never saved as 0"). A 0 would read as a real plate or deck;
// the adapter refuses a blank before any motion. Every other field keeps the
// legacy save-time fill-in.
export const NO_ZERO_FILL_FIELDS: Record<string, Record<string, readonly string[]>> = {
  fast: {
    transfer: ["source_deck", "dest_deck", "source_plate_id", "dest_plate_id"],
  },
};

export function isNoZeroFillField(
  toolType: string,
  command: string | undefined,
  fieldName: string,
): boolean {
  if (command === undefined) return false;
  const commands = own(NO_ZERO_FILL_FIELDS, toolType);
  if (commands === undefined) return false;
  const names = own(commands, command);
  return names !== undefined && names.includes(fieldName);
}

// The one allowed default on a Transfer field (PLT-07, user decision
// 2026-11-06): a new F.A.S.T. transfer form starts with tip_reuse "reuse". It is
// written only when a new form initialises, never when a saved step opens.
const NEW_STEP_DEFAULTS: Record<string, Record<string, Record<string, string>>> = {
  fast: { transfer: { tip_reuse: "reuse" } },
};

export function newStepDefaults(
  toolType: string,
  command: string | undefined,
): Record<string, string> {
  if (command === undefined) return {};
  const commands = own(NEW_STEP_DEFAULTS, toolType);
  if (commands === undefined) return {};
  const defaults = own(commands, command);
  return defaults === undefined ? {} : { ...defaults };
}

// ---------------------------------------------------------------------------
// Location cascade (D-06, D-07, D-08). Built from the one stack.devices tree by
// position: device index, deck index, nest index. A value is only ever the
// plain name the operator would have typed; every comparison is
// String(a) === String(b), never trimmed or case-folded.

export interface CascadeTree {
  devices: StackDevice[];
  ambiguous: string[];
}

export interface CascadeOptions {
  options: SelectOption[];
  parentBlank: boolean;
  emptyNote?: string;
}

function sameName(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

function sideField(side: CascadeSide, level: CascadeLevel): string {
  return side + "_" + level;
}

function cascadeOption(
  key: string,
  value: string,
  pathKey: string,
  names: { deviceName: string; deckName?: string; nestName?: string },
  ambiguous: boolean,
): SelectOption {
  const option: SelectOption = {
    key,
    value,
    label: ambiguous ? value + AMBIGUOUS_SUFFIX : value,
    pathKey,
    names,
  };
  if (ambiguous) option.flag = "ambiguous";
  return option;
}

// Flag rule (D-08, RESEARCH Open Question 1, knowledge.py from_devices): a
// device is flagged when its name is listed; a deck when "device/deck" or the
// device is; a nest when "device/deck/nest", "device/deck" or the device is.
// Exact membership on the adapter's bare "/" join, so a name containing "/"
// that collides with a listed path is flagged too. A flag never hides,
// disables, merges or picks an option: the operator sees it and chooses.
//
// A saved device name shared by several rows offers the decks of every row
// with that name, in index order (all flagged, since the name is listed): the
// stored value is only the name, so which row was meant is unknowable, and the
// adapter refuses ambiguous names anyway.
export function buildCascadeOptions(
  tree: CascadeTree,
  binding: FieldBinding,
  values: Record<string, unknown>,
): CascadeOptions {
  const role = binding.role;
  if (role.kind !== "cascade") return { options: [], parentBlank: false };
  const { side, level } = role;
  const listed = new Set<string>(Array.isArray(tree.ambiguous) ? tree.ambiguous : []);
  const devices = Array.isArray(tree.devices) ? tree.devices : [];

  if (level === "device") {
    const options = devices.map((device, d) =>
      cascadeOption(
        side + ":device:" + d,
        device.deviceName,
        device.deviceName,
        { deviceName: device.deviceName },
        listed.has(device.deviceName),
      ),
    );
    return { options, parentBlank: false };
  }

  const deviceValue = values[sideField(side, "device")];
  if (isBlankValue(deviceValue)) return { options: [], parentBlank: true };

  if (level === "deck") {
    const options: SelectOption[] = [];
    let matchedDevice = false;
    devices.forEach((device, d) => {
      if (!sameName(device.deviceName, deviceValue)) return;
      matchedDevice = true;
      device.decks.forEach((deck, k) => {
        if (deck.isCalibrated !== true) return;
        const path = device.deviceName + "/" + deck.deckName;
        options.push(
          cascadeOption(
            side + ":deck:" + d + ":" + k,
            deck.deckName,
            path,
            { deviceName: device.deviceName, deckName: deck.deckName },
            listed.has(device.deviceName) || listed.has(path),
          ),
        );
      });
    });
    const result: CascadeOptions = { options, parentBlank: false };
    if (matchedDevice && options.length === 0) result.emptyNote = NO_CALIBRATED_DECKS;
    return result;
  }

  // nest: both the device and the deck govern it; either blank means there is
  // no parent to list from.
  const deckValue = values[sideField(side, "deck")];
  if (isBlankValue(deckValue)) return { options: [], parentBlank: true };

  const options: SelectOption[] = [];
  let matchedDeck = false;
  devices.forEach((device, d) => {
    if (!sameName(device.deviceName, deviceValue)) return;
    device.decks.forEach((deck, k) => {
      if (deck.isCalibrated !== true || !sameName(deck.deckName, deckValue)) return;
      matchedDeck = true;
      const deckPath = device.deviceName + "/" + deck.deckName;
      const deckFlagged = listed.has(device.deviceName) || listed.has(deckPath);
      deck.nests.forEach((nest, n) => {
        if (nest.isCalibrated !== true) return;
        const path = deckPath + "/" + nest.nestName;
        options.push(
          cascadeOption(
            side + ":nest:" + d + ":" + k + ":" + n,
            nest.nestName,
            path,
            { deviceName: device.deviceName, deckName: deck.deckName, nestName: nest.nestName },
            deckFlagged || listed.has(path),
          ),
        );
      });
    });
  });
  const result: CascadeOptions = { options, parentBlank: false };
  if (matchedDeck && options.length === 0) result.emptyNote = NO_CALIBRATED_NESTS;
  return result;
}

// How the operator changed a field: "select" is a choice from the instrument
// list (cascade clears apply), "typed" is a keystroke in the typed fallback
// input, which writes only its own field so editing a saved device or deck
// name never wipes the children below it.
export type ChangeKind = "select" | "typed";

// The only producer of param patches (D-09, DRP-05). It reads no option list
// and never picks a first child: an operator's device choice clears the same
// side's deck and nest to "", a deck choice clears the nest, anything else
// (and any typed edit) returns only its own field. Loading or refreshing a
// list never calls this.
export function applyChange(
  binding: FieldBinding,
  newValue: string,
  kind: ChangeKind = "select",
): Record<string, string | number> {
  const role = binding.role;
  // A plate id is written as the number the operator would have typed. The
  // typed fallback keeps ASCII digits only, so a non-numeric string never
  // reaches the wire (RESEARCH Pitfall 2, T-07-24). An id above 2147483647
  // stays as the typed digit text, is flagged, and is refused at send time
  // (CR-01, D-04): it is never truncated into a different plate.
  if (role.kind === "plate") {
    if (kind === "select") return numericPatch(binding.field, newValue);
    const digits = newValue.replace(/[^0-9]/g, "");
    return { [binding.field]: digits === "" ? "" : int32FromDigits(digits) };
  }
  if (kind === "typed") return { [binding.field]: newValue };
  if (role.kind === "cascade" && role.level === "device") {
    return {
      [binding.field]: newValue,
      [sideField(role.side, "deck")]: "",
      [sideField(role.side, "nest")]: "",
    };
  }
  if (role.kind === "cascade" && role.level === "deck") {
    return { [binding.field]: newValue, [sideField(role.side, "nest")]: "" };
  }
  return { [binding.field]: newValue };
}

// Whether a cascade field's own-side parent (deck: the device; nest: the device
// or the deck) is a {{variable}} reference, so its list cannot be known.
export function cascadeAncestorBound(
  binding: FieldBinding,
  values: Record<string, unknown>,
): boolean {
  const role = binding.role;
  if (role.kind !== "cascade" || role.level === "device") return false;
  if (isVariableLike(values[sideField(role.side, "device")])) return true;
  return role.level === "nest" && isVariableLike(values[sideField(role.side, "deck")]);
}

// The single function every host renders a bound field from. It returns a
// view only, never a patch: the host's own onChange goes through applyChange.
// An ok mode whose data does not fit the binding's shape (a list for a cascade
// or a tree for a list) falls back to the typed input rather than guessing.
export function buildFieldView(input: {
  binding: FieldBinding;
  value: unknown;
  values: Record<string, unknown>;
  mode: OptionsMode;
  data: OptionsResult | undefined;
  allowVariables: boolean;
}): SelectView {
  const { binding, value, values, data, allowVariables } = input;
  let mode = input.mode;
  let offered: SelectOption[] = [];
  let parentBlank = false;
  let emptyNote: string | undefined;

  if (mode === "ok") {
    if (data === undefined || data.status !== "ok") {
      mode = "unavailable";
    } else if (binding.role.kind === "plate") {
      if (data.shape === "plates") offered = plateOptions(data);
      else mode = "unavailable";
    } else if (data.shape === "plates") {
      // A plates result never reaches the list or cascade builders.
      mode = "unavailable";
    } else if (binding.role.kind === "list") {
      if (data.shape === "list") offered = listOptions(data);
      else mode = "unavailable";
    } else if (data.shape === "tree") {
      const built = buildCascadeOptions(
        { devices: data.devices, ambiguous: data.ambiguous },
        binding,
        values,
      );
      offered = built.options;
      parentBlank = built.parentBlank;
      emptyNote = built.emptyNote;
    } else {
      mode = "unavailable";
    }
  }

  return buildSelectView({
    mode,
    value,
    offered,
    allowVariables,
    ancestorVariableBound: cascadeAncestorBound(binding, values),
    parentBlank,
    emptyNote,
  });
}

// The first field, in form order, bound to the given source: where that
// source's one Refresh row sits (D-12).
export function firstFieldForSource(
  fieldNames: string[],
  toolType: string,
  command: string | undefined,
  source: OptionSourceId,
): string | undefined {
  for (const name of fieldNames) {
    const binding = lookupFieldBinding(toolType, command, name);
    if (binding !== undefined && binding.source === source) return name;
  }
  return undefined;
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// "from instrument · N items · fetched hh:mm:ss" in local 24-hour time from the
// server's fetchedAt (a cached list shows its original read time). Built from
// getHours/getMinutes/getSeconds so the output never depends on the locale.
export function formatStatusLine(data: OptionsResult): string {
  if (data.status !== "ok") return "";
  const count =
    data.shape === "list"
      ? data.names.length
      : data.shape === "tree"
        ? data.devices.length
        : data.plates.length;
  const at = new Date(data.fetchedAt);
  const time = pad2(at.getHours()) + ":" + pad2(at.getMinutes()) + ":" + pad2(at.getSeconds());
  const line =
    "from instrument · " + count + (count === 1 ? " item" : " items") + " · fetched " + time;
  return data.degraded ? line + DEGRADED_SUFFIX : line;
}
