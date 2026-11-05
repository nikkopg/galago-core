// React-free: no react import, and the server module is imported for TYPES only
// (`import type` is erased, so no server value ever reaches the client bundle).
// This module decides which command fields are instrument-fed dropdowns and
// turns a tool.options result into the view the shared OptionsSelect renders.
// commandFields stays untouched (STK-07): a bound field is still a typed
// "text" field there, which is exactly what the unavailable mode falls back to.
import type { OptionSourceId, OptionsResult } from "@/server/toolOptions";

export const OPTIONS_STALE_MS = 15000;
export const UNAVAILABLE_HINT = "Instrument list unavailable — type the value";
export const NOT_REPORTED_SUFFIX = " (not reported by instrument)";
export const LOADING_LABEL = "Loading…";

export type CascadeSide = "source" | "destination";
export type CascadeLevel = "device" | "deck" | "nest";

export type FieldRole =
  | { kind: "list" }
  | { kind: "cascade"; side: CascadeSide; level: CascadeLevel };

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
  flag?: "ambiguous" | "not-reported";
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

function isBlankValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export function buildSelectView(input: {
  mode: OptionsMode;
  value: unknown;
  offered: SelectOption[];
}): SelectView {
  const { mode, value, offered } = input;
  const blank = isBlankValue(value);
  const current = blank ? "" : String(value);

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
  const options: SelectOption[] = [{ key: "empty", value: "", label: "" }, ...offered];
  if (!blank && !offered.some((option) => String(option.value) === current)) {
    options.push({
      key: "not-reported",
      value: current,
      label: current + NOT_REPORTED_SUFFIX,
      flag: "not-reported",
    });
  }
  return { mode: "ok", value: current, options, disabled: false };
}
