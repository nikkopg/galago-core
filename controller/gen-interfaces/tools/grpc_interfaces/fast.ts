/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "com.science.foundry.tools.grpc_interfaces.fast";

export interface Command {
  transfer?: Command_Transfer | undefined;
  run_protocol?: Command_RunProtocol | undefined;
  validate_protocol?: Command_ValidateProtocol | undefined;
  get_status?: Command_GetStatus | undefined;
  get_tip_status?: Command_GetTipStatus | undefined;
  scan_tips?: Command_ScanTips | undefined;
  eject_tray?: Command_EjectTray | undefined;
  abort?: Command_Abort | undefined;
  resume?: Command_Resume | undefined;
  pause?: Command_Pause | undefined;
}

export interface Command_Transfer {
  source_deck?: number | undefined;
  dest_deck?: number | undefined;
  source_plate_id?: number | undefined;
  dest_plate_id?: number | undefined;
  source_start_row?: string | undefined;
  source_start_col?: number | undefined;
  dest_start_row?: string | undefined;
  dest_start_col?: number | undefined;
  num_rows?: number | undefined;
  num_cols?: number | undefined;
  volume?: number | undefined;
  tip_reuse?: string | undefined;
  expected_tray_id?: number | undefined;
}

export interface Command_RunProtocol {
  csv: string;
  timeout_s?: number | undefined;
}

export interface Command_ValidateProtocol {
  csv: string;
}

export interface Command_GetStatus {
}

export interface Command_GetTipStatus {
}

export interface Command_ScanTips {
  is_tip_broken: boolean;
}

export interface Command_EjectTray {
}

/**
 * Operator recovery from an instrument pause. The physical decision is a
 * required "yes"/"no" string, not a bool: galago-core's command form turns
 * an untouched boolean into false, so a bool could not tell "no" from
 * "never chosen". Unset or any other value is rejected as INVALID_ARGUMENTS.
 */
export interface Command_Abort {
  return_liquid?: string | undefined;
}

export interface Command_Resume {
  is_tip_broken?: string | undefined;
}

/**
 * The operator's pause of the running run. It is always a soft pause
 * (design D5), so it carries no hard/soft choice; the core refuses it
 * unless the instrument is running.
 */
export interface Command_Pause {
}

export interface Config {
  host: string;
  port: number;
  expected_tray_id: number;
  run_timeout_s: number;
}

function createBaseCommand(): Command {
  return {
    transfer: undefined,
    run_protocol: undefined,
    validate_protocol: undefined,
    get_status: undefined,
    get_tip_status: undefined,
    scan_tips: undefined,
    eject_tray: undefined,
    abort: undefined,
    resume: undefined,
    pause: undefined,
  };
}

export const Command = {
  encode(message: Command, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.transfer !== undefined) {
      Command_Transfer.encode(message.transfer, writer.uint32(10).fork()).ldelim();
    }
    if (message.run_protocol !== undefined) {
      Command_RunProtocol.encode(message.run_protocol, writer.uint32(18).fork()).ldelim();
    }
    if (message.validate_protocol !== undefined) {
      Command_ValidateProtocol.encode(message.validate_protocol, writer.uint32(26).fork()).ldelim();
    }
    if (message.get_status !== undefined) {
      Command_GetStatus.encode(message.get_status, writer.uint32(34).fork()).ldelim();
    }
    if (message.get_tip_status !== undefined) {
      Command_GetTipStatus.encode(message.get_tip_status, writer.uint32(42).fork()).ldelim();
    }
    if (message.scan_tips !== undefined) {
      Command_ScanTips.encode(message.scan_tips, writer.uint32(50).fork()).ldelim();
    }
    if (message.eject_tray !== undefined) {
      Command_EjectTray.encode(message.eject_tray, writer.uint32(58).fork()).ldelim();
    }
    if (message.abort !== undefined) {
      Command_Abort.encode(message.abort, writer.uint32(66).fork()).ldelim();
    }
    if (message.resume !== undefined) {
      Command_Resume.encode(message.resume, writer.uint32(74).fork()).ldelim();
    }
    if (message.pause !== undefined) {
      Command_Pause.encode(message.pause, writer.uint32(82).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.transfer = Command_Transfer.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.run_protocol = Command_RunProtocol.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.validate_protocol = Command_ValidateProtocol.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.get_status = Command_GetStatus.decode(reader, reader.uint32());
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.get_tip_status = Command_GetTipStatus.decode(reader, reader.uint32());
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.scan_tips = Command_ScanTips.decode(reader, reader.uint32());
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.eject_tray = Command_EjectTray.decode(reader, reader.uint32());
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.abort = Command_Abort.decode(reader, reader.uint32());
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.resume = Command_Resume.decode(reader, reader.uint32());
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.pause = Command_Pause.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command {
    return {
      transfer: isSet(object.transfer) ? Command_Transfer.fromJSON(object.transfer) : undefined,
      run_protocol: isSet(object.run_protocol) ? Command_RunProtocol.fromJSON(object.run_protocol) : undefined,
      validate_protocol: isSet(object.validate_protocol)
        ? Command_ValidateProtocol.fromJSON(object.validate_protocol)
        : undefined,
      get_status: isSet(object.get_status) ? Command_GetStatus.fromJSON(object.get_status) : undefined,
      get_tip_status: isSet(object.get_tip_status) ? Command_GetTipStatus.fromJSON(object.get_tip_status) : undefined,
      scan_tips: isSet(object.scan_tips) ? Command_ScanTips.fromJSON(object.scan_tips) : undefined,
      eject_tray: isSet(object.eject_tray) ? Command_EjectTray.fromJSON(object.eject_tray) : undefined,
      abort: isSet(object.abort) ? Command_Abort.fromJSON(object.abort) : undefined,
      resume: isSet(object.resume) ? Command_Resume.fromJSON(object.resume) : undefined,
      pause: isSet(object.pause) ? Command_Pause.fromJSON(object.pause) : undefined,
    };
  },

  toJSON(message: Command): unknown {
    const obj: any = {};
    message.transfer !== undefined &&
      (obj.transfer = message.transfer ? Command_Transfer.toJSON(message.transfer) : undefined);
    message.run_protocol !== undefined &&
      (obj.run_protocol = message.run_protocol ? Command_RunProtocol.toJSON(message.run_protocol) : undefined);
    message.validate_protocol !== undefined && (obj.validate_protocol = message.validate_protocol
      ? Command_ValidateProtocol.toJSON(message.validate_protocol)
      : undefined);
    message.get_status !== undefined &&
      (obj.get_status = message.get_status ? Command_GetStatus.toJSON(message.get_status) : undefined);
    message.get_tip_status !== undefined &&
      (obj.get_tip_status = message.get_tip_status ? Command_GetTipStatus.toJSON(message.get_tip_status) : undefined);
    message.scan_tips !== undefined &&
      (obj.scan_tips = message.scan_tips ? Command_ScanTips.toJSON(message.scan_tips) : undefined);
    message.eject_tray !== undefined &&
      (obj.eject_tray = message.eject_tray ? Command_EjectTray.toJSON(message.eject_tray) : undefined);
    message.abort !== undefined && (obj.abort = message.abort ? Command_Abort.toJSON(message.abort) : undefined);
    message.resume !== undefined && (obj.resume = message.resume ? Command_Resume.toJSON(message.resume) : undefined);
    message.pause !== undefined && (obj.pause = message.pause ? Command_Pause.toJSON(message.pause) : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command>, I>>(base?: I): Command {
    return Command.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command>, I>>(object: I): Command {
    const message = createBaseCommand();
    message.transfer = (object.transfer !== undefined && object.transfer !== null)
      ? Command_Transfer.fromPartial(object.transfer)
      : undefined;
    message.run_protocol = (object.run_protocol !== undefined && object.run_protocol !== null)
      ? Command_RunProtocol.fromPartial(object.run_protocol)
      : undefined;
    message.validate_protocol = (object.validate_protocol !== undefined && object.validate_protocol !== null)
      ? Command_ValidateProtocol.fromPartial(object.validate_protocol)
      : undefined;
    message.get_status = (object.get_status !== undefined && object.get_status !== null)
      ? Command_GetStatus.fromPartial(object.get_status)
      : undefined;
    message.get_tip_status = (object.get_tip_status !== undefined && object.get_tip_status !== null)
      ? Command_GetTipStatus.fromPartial(object.get_tip_status)
      : undefined;
    message.scan_tips = (object.scan_tips !== undefined && object.scan_tips !== null)
      ? Command_ScanTips.fromPartial(object.scan_tips)
      : undefined;
    message.eject_tray = (object.eject_tray !== undefined && object.eject_tray !== null)
      ? Command_EjectTray.fromPartial(object.eject_tray)
      : undefined;
    message.abort = (object.abort !== undefined && object.abort !== null)
      ? Command_Abort.fromPartial(object.abort)
      : undefined;
    message.resume = (object.resume !== undefined && object.resume !== null)
      ? Command_Resume.fromPartial(object.resume)
      : undefined;
    message.pause = (object.pause !== undefined && object.pause !== null)
      ? Command_Pause.fromPartial(object.pause)
      : undefined;
    return message;
  },
};

function createBaseCommand_Transfer(): Command_Transfer {
  return {
    source_deck: undefined,
    dest_deck: undefined,
    source_plate_id: undefined,
    dest_plate_id: undefined,
    source_start_row: undefined,
    source_start_col: undefined,
    dest_start_row: undefined,
    dest_start_col: undefined,
    num_rows: undefined,
    num_cols: undefined,
    volume: undefined,
    tip_reuse: undefined,
    expected_tray_id: undefined,
  };
}

export const Command_Transfer = {
  encode(message: Command_Transfer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.source_deck !== undefined) {
      writer.uint32(8).int32(message.source_deck);
    }
    if (message.dest_deck !== undefined) {
      writer.uint32(16).int32(message.dest_deck);
    }
    if (message.source_plate_id !== undefined) {
      writer.uint32(24).int32(message.source_plate_id);
    }
    if (message.dest_plate_id !== undefined) {
      writer.uint32(32).int32(message.dest_plate_id);
    }
    if (message.source_start_row !== undefined) {
      writer.uint32(42).string(message.source_start_row);
    }
    if (message.source_start_col !== undefined) {
      writer.uint32(48).int32(message.source_start_col);
    }
    if (message.dest_start_row !== undefined) {
      writer.uint32(58).string(message.dest_start_row);
    }
    if (message.dest_start_col !== undefined) {
      writer.uint32(64).int32(message.dest_start_col);
    }
    if (message.num_rows !== undefined) {
      writer.uint32(72).int32(message.num_rows);
    }
    if (message.num_cols !== undefined) {
      writer.uint32(80).int32(message.num_cols);
    }
    if (message.volume !== undefined) {
      writer.uint32(89).double(message.volume);
    }
    if (message.tip_reuse !== undefined) {
      writer.uint32(98).string(message.tip_reuse);
    }
    if (message.expected_tray_id !== undefined) {
      writer.uint32(104).int32(message.expected_tray_id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_Transfer {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_Transfer();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.source_deck = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.dest_deck = reader.int32();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.source_plate_id = reader.int32();
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.dest_plate_id = reader.int32();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.source_start_row = reader.string();
          continue;
        case 6:
          if (tag !== 48) {
            break;
          }

          message.source_start_col = reader.int32();
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.dest_start_row = reader.string();
          continue;
        case 8:
          if (tag !== 64) {
            break;
          }

          message.dest_start_col = reader.int32();
          continue;
        case 9:
          if (tag !== 72) {
            break;
          }

          message.num_rows = reader.int32();
          continue;
        case 10:
          if (tag !== 80) {
            break;
          }

          message.num_cols = reader.int32();
          continue;
        case 11:
          if (tag !== 89) {
            break;
          }

          message.volume = reader.double();
          continue;
        case 12:
          if (tag !== 98) {
            break;
          }

          message.tip_reuse = reader.string();
          continue;
        case 13:
          if (tag !== 104) {
            break;
          }

          message.expected_tray_id = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_Transfer {
    return {
      source_deck: isSet(object.source_deck) ? Number(object.source_deck) : undefined,
      dest_deck: isSet(object.dest_deck) ? Number(object.dest_deck) : undefined,
      source_plate_id: isSet(object.source_plate_id) ? Number(object.source_plate_id) : undefined,
      dest_plate_id: isSet(object.dest_plate_id) ? Number(object.dest_plate_id) : undefined,
      source_start_row: isSet(object.source_start_row) ? String(object.source_start_row) : undefined,
      source_start_col: isSet(object.source_start_col) ? Number(object.source_start_col) : undefined,
      dest_start_row: isSet(object.dest_start_row) ? String(object.dest_start_row) : undefined,
      dest_start_col: isSet(object.dest_start_col) ? Number(object.dest_start_col) : undefined,
      num_rows: isSet(object.num_rows) ? Number(object.num_rows) : undefined,
      num_cols: isSet(object.num_cols) ? Number(object.num_cols) : undefined,
      volume: isSet(object.volume) ? Number(object.volume) : undefined,
      tip_reuse: isSet(object.tip_reuse) ? String(object.tip_reuse) : undefined,
      expected_tray_id: isSet(object.expected_tray_id) ? Number(object.expected_tray_id) : undefined,
    };
  },

  toJSON(message: Command_Transfer): unknown {
    const obj: any = {};
    message.source_deck !== undefined && (obj.source_deck = Math.round(message.source_deck));
    message.dest_deck !== undefined && (obj.dest_deck = Math.round(message.dest_deck));
    message.source_plate_id !== undefined && (obj.source_plate_id = Math.round(message.source_plate_id));
    message.dest_plate_id !== undefined && (obj.dest_plate_id = Math.round(message.dest_plate_id));
    message.source_start_row !== undefined && (obj.source_start_row = message.source_start_row);
    message.source_start_col !== undefined && (obj.source_start_col = Math.round(message.source_start_col));
    message.dest_start_row !== undefined && (obj.dest_start_row = message.dest_start_row);
    message.dest_start_col !== undefined && (obj.dest_start_col = Math.round(message.dest_start_col));
    message.num_rows !== undefined && (obj.num_rows = Math.round(message.num_rows));
    message.num_cols !== undefined && (obj.num_cols = Math.round(message.num_cols));
    message.volume !== undefined && (obj.volume = message.volume);
    message.tip_reuse !== undefined && (obj.tip_reuse = message.tip_reuse);
    message.expected_tray_id !== undefined && (obj.expected_tray_id = Math.round(message.expected_tray_id));
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Transfer>, I>>(base?: I): Command_Transfer {
    return Command_Transfer.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Transfer>, I>>(object: I): Command_Transfer {
    const message = createBaseCommand_Transfer();
    message.source_deck = object.source_deck ?? undefined;
    message.dest_deck = object.dest_deck ?? undefined;
    message.source_plate_id = object.source_plate_id ?? undefined;
    message.dest_plate_id = object.dest_plate_id ?? undefined;
    message.source_start_row = object.source_start_row ?? undefined;
    message.source_start_col = object.source_start_col ?? undefined;
    message.dest_start_row = object.dest_start_row ?? undefined;
    message.dest_start_col = object.dest_start_col ?? undefined;
    message.num_rows = object.num_rows ?? undefined;
    message.num_cols = object.num_cols ?? undefined;
    message.volume = object.volume ?? undefined;
    message.tip_reuse = object.tip_reuse ?? undefined;
    message.expected_tray_id = object.expected_tray_id ?? undefined;
    return message;
  },
};

function createBaseCommand_RunProtocol(): Command_RunProtocol {
  return { csv: "", timeout_s: undefined };
}

export const Command_RunProtocol = {
  encode(message: Command_RunProtocol, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.csv !== "") {
      writer.uint32(10).string(message.csv);
    }
    if (message.timeout_s !== undefined) {
      writer.uint32(17).double(message.timeout_s);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_RunProtocol {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_RunProtocol();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.csv = reader.string();
          continue;
        case 2:
          if (tag !== 17) {
            break;
          }

          message.timeout_s = reader.double();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_RunProtocol {
    return {
      csv: isSet(object.csv) ? String(object.csv) : "",
      timeout_s: isSet(object.timeout_s) ? Number(object.timeout_s) : undefined,
    };
  },

  toJSON(message: Command_RunProtocol): unknown {
    const obj: any = {};
    message.csv !== undefined && (obj.csv = message.csv);
    message.timeout_s !== undefined && (obj.timeout_s = message.timeout_s);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_RunProtocol>, I>>(base?: I): Command_RunProtocol {
    return Command_RunProtocol.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_RunProtocol>, I>>(object: I): Command_RunProtocol {
    const message = createBaseCommand_RunProtocol();
    message.csv = object.csv ?? "";
    message.timeout_s = object.timeout_s ?? undefined;
    return message;
  },
};

function createBaseCommand_ValidateProtocol(): Command_ValidateProtocol {
  return { csv: "" };
}

export const Command_ValidateProtocol = {
  encode(message: Command_ValidateProtocol, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.csv !== "") {
      writer.uint32(10).string(message.csv);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_ValidateProtocol {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_ValidateProtocol();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.csv = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_ValidateProtocol {
    return { csv: isSet(object.csv) ? String(object.csv) : "" };
  },

  toJSON(message: Command_ValidateProtocol): unknown {
    const obj: any = {};
    message.csv !== undefined && (obj.csv = message.csv);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_ValidateProtocol>, I>>(base?: I): Command_ValidateProtocol {
    return Command_ValidateProtocol.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_ValidateProtocol>, I>>(object: I): Command_ValidateProtocol {
    const message = createBaseCommand_ValidateProtocol();
    message.csv = object.csv ?? "";
    return message;
  },
};

function createBaseCommand_GetStatus(): Command_GetStatus {
  return {};
}

export const Command_GetStatus = {
  encode(_: Command_GetStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetStatus {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): Command_GetStatus {
    return {};
  },

  toJSON(_: Command_GetStatus): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetStatus>, I>>(base?: I): Command_GetStatus {
    return Command_GetStatus.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetStatus>, I>>(_: I): Command_GetStatus {
    const message = createBaseCommand_GetStatus();
    return message;
  },
};

function createBaseCommand_GetTipStatus(): Command_GetTipStatus {
  return {};
}

export const Command_GetTipStatus = {
  encode(_: Command_GetTipStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetTipStatus {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetTipStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): Command_GetTipStatus {
    return {};
  },

  toJSON(_: Command_GetTipStatus): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetTipStatus>, I>>(base?: I): Command_GetTipStatus {
    return Command_GetTipStatus.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetTipStatus>, I>>(_: I): Command_GetTipStatus {
    const message = createBaseCommand_GetTipStatus();
    return message;
  },
};

function createBaseCommand_ScanTips(): Command_ScanTips {
  return { is_tip_broken: false };
}

export const Command_ScanTips = {
  encode(message: Command_ScanTips, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.is_tip_broken === true) {
      writer.uint32(8).bool(message.is_tip_broken);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_ScanTips {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_ScanTips();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.is_tip_broken = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_ScanTips {
    return { is_tip_broken: isSet(object.is_tip_broken) ? Boolean(object.is_tip_broken) : false };
  },

  toJSON(message: Command_ScanTips): unknown {
    const obj: any = {};
    message.is_tip_broken !== undefined && (obj.is_tip_broken = message.is_tip_broken);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_ScanTips>, I>>(base?: I): Command_ScanTips {
    return Command_ScanTips.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_ScanTips>, I>>(object: I): Command_ScanTips {
    const message = createBaseCommand_ScanTips();
    message.is_tip_broken = object.is_tip_broken ?? false;
    return message;
  },
};

function createBaseCommand_EjectTray(): Command_EjectTray {
  return {};
}

export const Command_EjectTray = {
  encode(_: Command_EjectTray, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_EjectTray {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_EjectTray();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): Command_EjectTray {
    return {};
  },

  toJSON(_: Command_EjectTray): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_EjectTray>, I>>(base?: I): Command_EjectTray {
    return Command_EjectTray.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_EjectTray>, I>>(_: I): Command_EjectTray {
    const message = createBaseCommand_EjectTray();
    return message;
  },
};

function createBaseCommand_Abort(): Command_Abort {
  return { return_liquid: undefined };
}

export const Command_Abort = {
  encode(message: Command_Abort, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.return_liquid !== undefined) {
      writer.uint32(10).string(message.return_liquid);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_Abort {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_Abort();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.return_liquid = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_Abort {
    return { return_liquid: isSet(object.return_liquid) ? String(object.return_liquid) : undefined };
  },

  toJSON(message: Command_Abort): unknown {
    const obj: any = {};
    message.return_liquid !== undefined && (obj.return_liquid = message.return_liquid);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Abort>, I>>(base?: I): Command_Abort {
    return Command_Abort.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Abort>, I>>(object: I): Command_Abort {
    const message = createBaseCommand_Abort();
    message.return_liquid = object.return_liquid ?? undefined;
    return message;
  },
};

function createBaseCommand_Resume(): Command_Resume {
  return { is_tip_broken: undefined };
}

export const Command_Resume = {
  encode(message: Command_Resume, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.is_tip_broken !== undefined) {
      writer.uint32(10).string(message.is_tip_broken);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_Resume {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_Resume();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.is_tip_broken = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_Resume {
    return { is_tip_broken: isSet(object.is_tip_broken) ? String(object.is_tip_broken) : undefined };
  },

  toJSON(message: Command_Resume): unknown {
    const obj: any = {};
    message.is_tip_broken !== undefined && (obj.is_tip_broken = message.is_tip_broken);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Resume>, I>>(base?: I): Command_Resume {
    return Command_Resume.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Resume>, I>>(object: I): Command_Resume {
    const message = createBaseCommand_Resume();
    message.is_tip_broken = object.is_tip_broken ?? undefined;
    return message;
  },
};

function createBaseCommand_Pause(): Command_Pause {
  return {};
}

export const Command_Pause = {
  encode(_: Command_Pause, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_Pause {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_Pause();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): Command_Pause {
    return {};
  },

  toJSON(_: Command_Pause): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Pause>, I>>(base?: I): Command_Pause {
    return Command_Pause.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Pause>, I>>(_: I): Command_Pause {
    const message = createBaseCommand_Pause();
    return message;
  },
};

function createBaseConfig(): Config {
  return { host: "", port: 0, expected_tray_id: 0, run_timeout_s: 0 };
}

export const Config = {
  encode(message: Config, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.host !== "") {
      writer.uint32(10).string(message.host);
    }
    if (message.port !== 0) {
      writer.uint32(16).int32(message.port);
    }
    if (message.expected_tray_id !== 0) {
      writer.uint32(24).int32(message.expected_tray_id);
    }
    if (message.run_timeout_s !== 0) {
      writer.uint32(33).double(message.run_timeout_s);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Config {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConfig();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.host = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.port = reader.int32();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.expected_tray_id = reader.int32();
          continue;
        case 4:
          if (tag !== 33) {
            break;
          }

          message.run_timeout_s = reader.double();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Config {
    return {
      host: isSet(object.host) ? String(object.host) : "",
      port: isSet(object.port) ? Number(object.port) : 0,
      expected_tray_id: isSet(object.expected_tray_id) ? Number(object.expected_tray_id) : 0,
      run_timeout_s: isSet(object.run_timeout_s) ? Number(object.run_timeout_s) : 0,
    };
  },

  toJSON(message: Config): unknown {
    const obj: any = {};
    message.host !== undefined && (obj.host = message.host);
    message.port !== undefined && (obj.port = Math.round(message.port));
    message.expected_tray_id !== undefined && (obj.expected_tray_id = Math.round(message.expected_tray_id));
    message.run_timeout_s !== undefined && (obj.run_timeout_s = message.run_timeout_s);
    return obj;
  },

  create<I extends Exact<DeepPartial<Config>, I>>(base?: I): Config {
    return Config.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Config>, I>>(object: I): Config {
    const message = createBaseConfig();
    message.host = object.host ?? "";
    message.port = object.port ?? 0;
    message.expected_tray_id = object.expected_tray_id ?? 0;
    message.run_timeout_s = object.run_timeout_s ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
