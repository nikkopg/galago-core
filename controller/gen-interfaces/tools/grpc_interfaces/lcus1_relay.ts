/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "com.science.foundry.tools.grpc_interfaces.lcus1_relay";

export interface Command {
  switch?: Command_Switch | undefined;
  timed_switch?: Command_TimedSwitch | undefined;
}

export interface Command_Switch {
  on: boolean;
}

export interface Command_TimedSwitch {
  duration_seconds: number;
}

export interface Config {
  com_port: string;
}

function createBaseCommand(): Command {
  return { switch: undefined, timed_switch: undefined };
}

export const Command = {
  encode(message: Command, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.switch !== undefined) {
      Command_Switch.encode(message.switch, writer.uint32(10).fork()).ldelim();
    }
    if (message.timed_switch !== undefined) {
      Command_TimedSwitch.encode(message.timed_switch, writer.uint32(18).fork()).ldelim();
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

          message.switch = Command_Switch.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.timed_switch = Command_TimedSwitch.decode(reader, reader.uint32());
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
      switch: isSet(object.switch) ? Command_Switch.fromJSON(object.switch) : undefined,
      timed_switch: isSet(object.timed_switch) ? Command_TimedSwitch.fromJSON(object.timed_switch) : undefined,
    };
  },

  toJSON(message: Command): unknown {
    const obj: any = {};
    message.switch !== undefined && (obj.switch = message.switch ? Command_Switch.toJSON(message.switch) : undefined);
    message.timed_switch !== undefined &&
      (obj.timed_switch = message.timed_switch ? Command_TimedSwitch.toJSON(message.timed_switch) : undefined);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command>, I>>(base?: I): Command {
    return Command.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command>, I>>(object: I): Command {
    const message = createBaseCommand();
    message.switch = (object.switch !== undefined && object.switch !== null)
      ? Command_Switch.fromPartial(object.switch)
      : undefined;
    message.timed_switch = (object.timed_switch !== undefined && object.timed_switch !== null)
      ? Command_TimedSwitch.fromPartial(object.timed_switch)
      : undefined;
    return message;
  },
};

function createBaseCommand_Switch(): Command_Switch {
  return { on: false };
}

export const Command_Switch = {
  encode(message: Command_Switch, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.on === true) {
      writer.uint32(8).bool(message.on);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_Switch {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_Switch();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.on = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_Switch {
    return { on: isSet(object.on) ? Boolean(object.on) : false };
  },

  toJSON(message: Command_Switch): unknown {
    const obj: any = {};
    message.on !== undefined && (obj.on = message.on);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Switch>, I>>(base?: I): Command_Switch {
    return Command_Switch.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Switch>, I>>(object: I): Command_Switch {
    const message = createBaseCommand_Switch();
    message.on = object.on ?? false;
    return message;
  },
};

function createBaseCommand_TimedSwitch(): Command_TimedSwitch {
  return { duration_seconds: 0 };
}

export const Command_TimedSwitch = {
  encode(message: Command_TimedSwitch, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.duration_seconds !== 0) {
      writer.uint32(13).float(message.duration_seconds);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_TimedSwitch {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_TimedSwitch();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 13) {
            break;
          }

          message.duration_seconds = reader.float();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_TimedSwitch {
    return { duration_seconds: isSet(object.duration_seconds) ? Number(object.duration_seconds) : 0 };
  },

  toJSON(message: Command_TimedSwitch): unknown {
    const obj: any = {};
    message.duration_seconds !== undefined && (obj.duration_seconds = message.duration_seconds);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_TimedSwitch>, I>>(base?: I): Command_TimedSwitch {
    return Command_TimedSwitch.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_TimedSwitch>, I>>(object: I): Command_TimedSwitch {
    const message = createBaseCommand_TimedSwitch();
    message.duration_seconds = object.duration_seconds ?? 0;
    return message;
  },
};

function createBaseConfig(): Config {
  return { com_port: "" };
}

export const Config = {
  encode(message: Config, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.com_port !== "") {
      writer.uint32(10).string(message.com_port);
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

          message.com_port = reader.string();
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
    return { com_port: isSet(object.com_port) ? String(object.com_port) : "" };
  },

  toJSON(message: Config): unknown {
    const obj: any = {};
    message.com_port !== undefined && (obj.com_port = message.com_port);
    return obj;
  },

  create<I extends Exact<DeepPartial<Config>, I>>(base?: I): Config {
    return Config.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Config>, I>>(object: I): Config {
    const message = createBaseConfig();
    message.com_port = object.com_port ?? "";
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
