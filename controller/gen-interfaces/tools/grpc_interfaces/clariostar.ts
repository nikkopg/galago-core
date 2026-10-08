/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "com.science.foundry.tools.grpc_interfaces.clariostar";

export interface Command {
  open_carrier?: Command_OpenCarrier | undefined;
  close_carrier?: Command_CloseCarrier | undefined;
  start_read?: Command_StartRead | undefined;
  set_temperature?: Command_SetTemperature | undefined;
}

export interface Command_OpenCarrier {
}

export interface Command_CloseCarrier {
}

export interface Command_StartRead {
  protocol_name: string;
  plate_id?: string | undefined;
  assay_id?: string | undefined;
  timepoint?: string | undefined;
}

export interface Command_SetTemperature {
  temperature: number;
}

export interface Config {
  protocol_dir: string;
  data_dir: string;
  device_name: string;
  output_dir: string;
}

function createBaseCommand(): Command {
  return { open_carrier: undefined, close_carrier: undefined, start_read: undefined, set_temperature: undefined };
}

export const Command = {
  encode(message: Command, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.open_carrier !== undefined) {
      Command_OpenCarrier.encode(message.open_carrier, writer.uint32(10).fork()).ldelim();
    }
    if (message.close_carrier !== undefined) {
      Command_CloseCarrier.encode(message.close_carrier, writer.uint32(18).fork()).ldelim();
    }
    if (message.start_read !== undefined) {
      Command_StartRead.encode(message.start_read, writer.uint32(26).fork()).ldelim();
    }
    if (message.set_temperature !== undefined) {
      Command_SetTemperature.encode(message.set_temperature, writer.uint32(34).fork()).ldelim();
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

          message.open_carrier = Command_OpenCarrier.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.close_carrier = Command_CloseCarrier.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.start_read = Command_StartRead.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.set_temperature = Command_SetTemperature.decode(reader, reader.uint32());
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
      open_carrier: isSet(object.open_carrier) ? Command_OpenCarrier.fromJSON(object.open_carrier) : undefined,
      close_carrier: isSet(object.close_carrier) ? Command_CloseCarrier.fromJSON(object.close_carrier) : undefined,
      start_read: isSet(object.start_read) ? Command_StartRead.fromJSON(object.start_read) : undefined,
      set_temperature: isSet(object.set_temperature)
        ? Command_SetTemperature.fromJSON(object.set_temperature)
        : undefined,
    };
  },

  toJSON(message: Command): unknown {
    const obj: any = {};
    message.open_carrier !== undefined &&
      (obj.open_carrier = message.open_carrier ? Command_OpenCarrier.toJSON(message.open_carrier) : undefined);
    message.close_carrier !== undefined &&
      (obj.close_carrier = message.close_carrier ? Command_CloseCarrier.toJSON(message.close_carrier) : undefined);
    message.start_read !== undefined &&
      (obj.start_read = message.start_read ? Command_StartRead.toJSON(message.start_read) : undefined);
    message.set_temperature !== undefined && (obj.set_temperature = message.set_temperature
      ? Command_SetTemperature.toJSON(message.set_temperature)
      : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command>, I>>(base?: I): Command {
    return Command.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command>, I>>(object: I): Command {
    const message = createBaseCommand();
    message.open_carrier = (object.open_carrier !== undefined && object.open_carrier !== null)
      ? Command_OpenCarrier.fromPartial(object.open_carrier)
      : undefined;
    message.close_carrier = (object.close_carrier !== undefined && object.close_carrier !== null)
      ? Command_CloseCarrier.fromPartial(object.close_carrier)
      : undefined;
    message.start_read = (object.start_read !== undefined && object.start_read !== null)
      ? Command_StartRead.fromPartial(object.start_read)
      : undefined;
    message.set_temperature = (object.set_temperature !== undefined && object.set_temperature !== null)
      ? Command_SetTemperature.fromPartial(object.set_temperature)
      : undefined;
    return message;
  },
};

function createBaseCommand_OpenCarrier(): Command_OpenCarrier {
  return {};
}

export const Command_OpenCarrier = {
  encode(_: Command_OpenCarrier, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_OpenCarrier {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_OpenCarrier();
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

  fromJSON(_: any): Command_OpenCarrier {
    return {};
  },

  toJSON(_: Command_OpenCarrier): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_OpenCarrier>, I>>(base?: I): Command_OpenCarrier {
    return Command_OpenCarrier.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_OpenCarrier>, I>>(_: I): Command_OpenCarrier {
    const message = createBaseCommand_OpenCarrier();
    return message;
  },
};

function createBaseCommand_CloseCarrier(): Command_CloseCarrier {
  return {};
}

export const Command_CloseCarrier = {
  encode(_: Command_CloseCarrier, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_CloseCarrier {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_CloseCarrier();
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

  fromJSON(_: any): Command_CloseCarrier {
    return {};
  },

  toJSON(_: Command_CloseCarrier): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_CloseCarrier>, I>>(base?: I): Command_CloseCarrier {
    return Command_CloseCarrier.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_CloseCarrier>, I>>(_: I): Command_CloseCarrier {
    const message = createBaseCommand_CloseCarrier();
    return message;
  },
};

function createBaseCommand_StartRead(): Command_StartRead {
  return { protocol_name: "", plate_id: undefined, assay_id: undefined, timepoint: undefined };
}

export const Command_StartRead = {
  encode(message: Command_StartRead, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.protocol_name !== "") {
      writer.uint32(10).string(message.protocol_name);
    }
    if (message.plate_id !== undefined) {
      writer.uint32(18).string(message.plate_id);
    }
    if (message.assay_id !== undefined) {
      writer.uint32(26).string(message.assay_id);
    }
    if (message.timepoint !== undefined) {
      writer.uint32(34).string(message.timepoint);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_StartRead {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_StartRead();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.protocol_name = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.plate_id = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.assay_id = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.timepoint = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_StartRead {
    return {
      protocol_name: isSet(object.protocol_name) ? String(object.protocol_name) : "",
      plate_id: isSet(object.plate_id) ? String(object.plate_id) : undefined,
      assay_id: isSet(object.assay_id) ? String(object.assay_id) : undefined,
      timepoint: isSet(object.timepoint) ? String(object.timepoint) : undefined,
    };
  },

  toJSON(message: Command_StartRead): unknown {
    const obj: any = {};
    message.protocol_name !== undefined && (obj.protocol_name = message.protocol_name);
    message.plate_id !== undefined && (obj.plate_id = message.plate_id);
    message.assay_id !== undefined && (obj.assay_id = message.assay_id);
    message.timepoint !== undefined && (obj.timepoint = message.timepoint);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_StartRead>, I>>(base?: I): Command_StartRead {
    return Command_StartRead.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_StartRead>, I>>(object: I): Command_StartRead {
    const message = createBaseCommand_StartRead();
    message.protocol_name = object.protocol_name ?? "";
    message.plate_id = object.plate_id ?? undefined;
    message.assay_id = object.assay_id ?? undefined;
    message.timepoint = object.timepoint ?? undefined;
    return message;
  },
};

function createBaseCommand_SetTemperature(): Command_SetTemperature {
  return { temperature: 0 };
}

export const Command_SetTemperature = {
  encode(message: Command_SetTemperature, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.temperature !== 0) {
      writer.uint32(13).float(message.temperature);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_SetTemperature {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_SetTemperature();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 13) {
            break;
          }

          message.temperature = reader.float();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_SetTemperature {
    return { temperature: isSet(object.temperature) ? Number(object.temperature) : 0 };
  },

  toJSON(message: Command_SetTemperature): unknown {
    const obj: any = {};
    message.temperature !== undefined && (obj.temperature = message.temperature);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_SetTemperature>, I>>(base?: I): Command_SetTemperature {
    return Command_SetTemperature.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_SetTemperature>, I>>(object: I): Command_SetTemperature {
    const message = createBaseCommand_SetTemperature();
    message.temperature = object.temperature ?? 0;
    return message;
  },
};

function createBaseConfig(): Config {
  return { protocol_dir: "", data_dir: "", device_name: "", output_dir: "" };
}

export const Config = {
  encode(message: Config, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.protocol_dir !== "") {
      writer.uint32(10).string(message.protocol_dir);
    }
    if (message.data_dir !== "") {
      writer.uint32(18).string(message.data_dir);
    }
    if (message.device_name !== "") {
      writer.uint32(26).string(message.device_name);
    }
    if (message.output_dir !== "") {
      writer.uint32(34).string(message.output_dir);
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

          message.protocol_dir = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.data_dir = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.device_name = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.output_dir = reader.string();
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
      protocol_dir: isSet(object.protocol_dir) ? String(object.protocol_dir) : "",
      data_dir: isSet(object.data_dir) ? String(object.data_dir) : "",
      device_name: isSet(object.device_name) ? String(object.device_name) : "",
      output_dir: isSet(object.output_dir) ? String(object.output_dir) : "",
    };
  },

  toJSON(message: Config): unknown {
    const obj: any = {};
    message.protocol_dir !== undefined && (obj.protocol_dir = message.protocol_dir);
    message.data_dir !== undefined && (obj.data_dir = message.data_dir);
    message.device_name !== undefined && (obj.device_name = message.device_name);
    message.output_dir !== undefined && (obj.output_dir = message.output_dir);
    return obj;
  },

  create<I extends Exact<DeepPartial<Config>, I>>(base?: I): Config {
    return Config.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Config>, I>>(object: I): Config {
    const message = createBaseConfig();
    message.protocol_dir = object.protocol_dir ?? "";
    message.data_dir = object.data_dir ?? "";
    message.device_name = object.device_name ?? "";
    message.output_dir = object.output_dir ?? "";
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
