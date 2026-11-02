/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "com.science.foundry.tools.grpc_interfaces.stack";

/**
 * Frozen v2 command surface of the STACK tool (Phase 4 D-01..D-05). galago-core
 * generates its ts-proto types and commandFields.stack from this file once;
 * any change here re-opens that work and needs the user's sign-off.
 */
export interface Command {
  transfer?: Command_Transfer | undefined;
  get_manager_state?: Command_GetManagerState | undefined;
  get_robot_states?: Command_GetRobotStates | undefined;
  list_devices?: Command_ListDevices | undefined;
  list_labware_profiles?: Command_ListLabwareProfiles | undefined;
  list_transfer_profiles?: Command_ListTransferProfiles | undefined;
  get_labware_presence?: Command_GetLabwarePresence | undefined;
  get_transfer_estimate?: Command_GetTransferEstimate | undefined;
  acknowledge_failure?: Command_AcknowledgeFailure | undefined;
  get_failure_latch?: Command_GetFailureLatch | undefined;
}

/** step_key must be unique per Galago run step (it keys the transfer ledger). */
export interface Command_Transfer {
  step_key?: string | undefined;
  robot?: string | undefined;
  labware_profile?: string | undefined;
  source_device?: string | undefined;
  source_deck?: string | undefined;
  source_nest?: string | undefined;
  source_transfer_profile?: string | undefined;
  destination_device?: string | undefined;
  destination_deck?: string | undefined;
  destination_nest?: string | undefined;
  destination_transfer_profile?: string | undefined;
  timeout_s?: number | undefined;
}

export interface Command_GetManagerState {
}

export interface Command_GetRobotStates {
}

export interface Command_ListDevices {
  refresh?: boolean | undefined;
}

export interface Command_ListLabwareProfiles {
  refresh?: boolean | undefined;
}

export interface Command_ListTransferProfiles {
  refresh?: boolean | undefined;
}

export interface Command_GetLabwarePresence {
  robot?: string | undefined;
}

export interface Command_GetTransferEstimate {
  robot?: string | undefined;
  labware_profile?: string | undefined;
  source_device?: string | undefined;
  source_deck?: string | undefined;
  source_nest?: string | undefined;
  source_transfer_profile?: string | undefined;
  destination_device?: string | undefined;
  destination_deck?: string | undefined;
  destination_nest?: string | undefined;
  destination_transfer_profile?: string | undefined;
}

/**
 * arm_inspected is "yes" only after the arm was inspected and STACK
 * recovered in the STACK Manager; only the exact strings "yes" and "no"
 * are accepted.
 */
export interface Command_AcknowledgeFailure {
  guid?: string | undefined;
  arm_inspected?: string | undefined;
}

export interface Command_GetFailureLatch {
}

/**
 * Config scalars have no presence: 0 / "" mean unset.
 * There is deliberately no lock directory field: galago and stack-mcp must
 * contend on the same owner lock. Credentials come only from STACK_USER and
 * STACK_PASSWORD in the tool server's environment, never from Config.
 */
export interface Config {
  host: string;
  /** 0 means the default manager port (5005). */
  port: number;
  /** 0 means the adapter default (used from Phase 5). */
  transfer_timeout_s: number;
  /** Blank means the per-user state directory (used from Phase 5). */
  ledger_dir: string;
}

function createBaseCommand(): Command {
  return {
    transfer: undefined,
    get_manager_state: undefined,
    get_robot_states: undefined,
    list_devices: undefined,
    list_labware_profiles: undefined,
    list_transfer_profiles: undefined,
    get_labware_presence: undefined,
    get_transfer_estimate: undefined,
    acknowledge_failure: undefined,
    get_failure_latch: undefined,
  };
}

export const Command = {
  encode(message: Command, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.transfer !== undefined) {
      Command_Transfer.encode(message.transfer, writer.uint32(10).fork()).ldelim();
    }
    if (message.get_manager_state !== undefined) {
      Command_GetManagerState.encode(message.get_manager_state, writer.uint32(18).fork()).ldelim();
    }
    if (message.get_robot_states !== undefined) {
      Command_GetRobotStates.encode(message.get_robot_states, writer.uint32(26).fork()).ldelim();
    }
    if (message.list_devices !== undefined) {
      Command_ListDevices.encode(message.list_devices, writer.uint32(34).fork()).ldelim();
    }
    if (message.list_labware_profiles !== undefined) {
      Command_ListLabwareProfiles.encode(message.list_labware_profiles, writer.uint32(42).fork()).ldelim();
    }
    if (message.list_transfer_profiles !== undefined) {
      Command_ListTransferProfiles.encode(message.list_transfer_profiles, writer.uint32(50).fork()).ldelim();
    }
    if (message.get_labware_presence !== undefined) {
      Command_GetLabwarePresence.encode(message.get_labware_presence, writer.uint32(58).fork()).ldelim();
    }
    if (message.get_transfer_estimate !== undefined) {
      Command_GetTransferEstimate.encode(message.get_transfer_estimate, writer.uint32(66).fork()).ldelim();
    }
    if (message.acknowledge_failure !== undefined) {
      Command_AcknowledgeFailure.encode(message.acknowledge_failure, writer.uint32(74).fork()).ldelim();
    }
    if (message.get_failure_latch !== undefined) {
      Command_GetFailureLatch.encode(message.get_failure_latch, writer.uint32(82).fork()).ldelim();
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

          message.get_manager_state = Command_GetManagerState.decode(reader, reader.uint32());
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.get_robot_states = Command_GetRobotStates.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.list_devices = Command_ListDevices.decode(reader, reader.uint32());
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.list_labware_profiles = Command_ListLabwareProfiles.decode(reader, reader.uint32());
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.list_transfer_profiles = Command_ListTransferProfiles.decode(reader, reader.uint32());
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.get_labware_presence = Command_GetLabwarePresence.decode(reader, reader.uint32());
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.get_transfer_estimate = Command_GetTransferEstimate.decode(reader, reader.uint32());
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.acknowledge_failure = Command_AcknowledgeFailure.decode(reader, reader.uint32());
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.get_failure_latch = Command_GetFailureLatch.decode(reader, reader.uint32());
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
      get_manager_state: isSet(object.get_manager_state)
        ? Command_GetManagerState.fromJSON(object.get_manager_state)
        : undefined,
      get_robot_states: isSet(object.get_robot_states)
        ? Command_GetRobotStates.fromJSON(object.get_robot_states)
        : undefined,
      list_devices: isSet(object.list_devices) ? Command_ListDevices.fromJSON(object.list_devices) : undefined,
      list_labware_profiles: isSet(object.list_labware_profiles)
        ? Command_ListLabwareProfiles.fromJSON(object.list_labware_profiles)
        : undefined,
      list_transfer_profiles: isSet(object.list_transfer_profiles)
        ? Command_ListTransferProfiles.fromJSON(object.list_transfer_profiles)
        : undefined,
      get_labware_presence: isSet(object.get_labware_presence)
        ? Command_GetLabwarePresence.fromJSON(object.get_labware_presence)
        : undefined,
      get_transfer_estimate: isSet(object.get_transfer_estimate)
        ? Command_GetTransferEstimate.fromJSON(object.get_transfer_estimate)
        : undefined,
      acknowledge_failure: isSet(object.acknowledge_failure)
        ? Command_AcknowledgeFailure.fromJSON(object.acknowledge_failure)
        : undefined,
      get_failure_latch: isSet(object.get_failure_latch)
        ? Command_GetFailureLatch.fromJSON(object.get_failure_latch)
        : undefined,
    };
  },

  toJSON(message: Command): unknown {
    const obj: any = {};
    message.transfer !== undefined &&
      (obj.transfer = message.transfer ? Command_Transfer.toJSON(message.transfer) : undefined);
    message.get_manager_state !== undefined && (obj.get_manager_state = message.get_manager_state
      ? Command_GetManagerState.toJSON(message.get_manager_state)
      : undefined);
    message.get_robot_states !== undefined && (obj.get_robot_states = message.get_robot_states
      ? Command_GetRobotStates.toJSON(message.get_robot_states)
      : undefined);
    message.list_devices !== undefined &&
      (obj.list_devices = message.list_devices ? Command_ListDevices.toJSON(message.list_devices) : undefined);
    message.list_labware_profiles !== undefined && (obj.list_labware_profiles = message.list_labware_profiles
      ? Command_ListLabwareProfiles.toJSON(message.list_labware_profiles)
      : undefined);
    message.list_transfer_profiles !== undefined && (obj.list_transfer_profiles = message.list_transfer_profiles
      ? Command_ListTransferProfiles.toJSON(message.list_transfer_profiles)
      : undefined);
    message.get_labware_presence !== undefined && (obj.get_labware_presence = message.get_labware_presence
      ? Command_GetLabwarePresence.toJSON(message.get_labware_presence)
      : undefined);
    message.get_transfer_estimate !== undefined && (obj.get_transfer_estimate = message.get_transfer_estimate
      ? Command_GetTransferEstimate.toJSON(message.get_transfer_estimate)
      : undefined);
    message.acknowledge_failure !== undefined && (obj.acknowledge_failure = message.acknowledge_failure
      ? Command_AcknowledgeFailure.toJSON(message.acknowledge_failure)
      : undefined);
    message.get_failure_latch !== undefined && (obj.get_failure_latch = message.get_failure_latch
      ? Command_GetFailureLatch.toJSON(message.get_failure_latch)
      : undefined);
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
    message.get_manager_state = (object.get_manager_state !== undefined && object.get_manager_state !== null)
      ? Command_GetManagerState.fromPartial(object.get_manager_state)
      : undefined;
    message.get_robot_states = (object.get_robot_states !== undefined && object.get_robot_states !== null)
      ? Command_GetRobotStates.fromPartial(object.get_robot_states)
      : undefined;
    message.list_devices = (object.list_devices !== undefined && object.list_devices !== null)
      ? Command_ListDevices.fromPartial(object.list_devices)
      : undefined;
    message.list_labware_profiles =
      (object.list_labware_profiles !== undefined && object.list_labware_profiles !== null)
        ? Command_ListLabwareProfiles.fromPartial(object.list_labware_profiles)
        : undefined;
    message.list_transfer_profiles =
      (object.list_transfer_profiles !== undefined && object.list_transfer_profiles !== null)
        ? Command_ListTransferProfiles.fromPartial(object.list_transfer_profiles)
        : undefined;
    message.get_labware_presence = (object.get_labware_presence !== undefined && object.get_labware_presence !== null)
      ? Command_GetLabwarePresence.fromPartial(object.get_labware_presence)
      : undefined;
    message.get_transfer_estimate =
      (object.get_transfer_estimate !== undefined && object.get_transfer_estimate !== null)
        ? Command_GetTransferEstimate.fromPartial(object.get_transfer_estimate)
        : undefined;
    message.acknowledge_failure = (object.acknowledge_failure !== undefined && object.acknowledge_failure !== null)
      ? Command_AcknowledgeFailure.fromPartial(object.acknowledge_failure)
      : undefined;
    message.get_failure_latch = (object.get_failure_latch !== undefined && object.get_failure_latch !== null)
      ? Command_GetFailureLatch.fromPartial(object.get_failure_latch)
      : undefined;
    return message;
  },
};

function createBaseCommand_Transfer(): Command_Transfer {
  return {
    step_key: undefined,
    robot: undefined,
    labware_profile: undefined,
    source_device: undefined,
    source_deck: undefined,
    source_nest: undefined,
    source_transfer_profile: undefined,
    destination_device: undefined,
    destination_deck: undefined,
    destination_nest: undefined,
    destination_transfer_profile: undefined,
    timeout_s: undefined,
  };
}

export const Command_Transfer = {
  encode(message: Command_Transfer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.step_key !== undefined) {
      writer.uint32(10).string(message.step_key);
    }
    if (message.robot !== undefined) {
      writer.uint32(18).string(message.robot);
    }
    if (message.labware_profile !== undefined) {
      writer.uint32(26).string(message.labware_profile);
    }
    if (message.source_device !== undefined) {
      writer.uint32(34).string(message.source_device);
    }
    if (message.source_deck !== undefined) {
      writer.uint32(42).string(message.source_deck);
    }
    if (message.source_nest !== undefined) {
      writer.uint32(50).string(message.source_nest);
    }
    if (message.source_transfer_profile !== undefined) {
      writer.uint32(58).string(message.source_transfer_profile);
    }
    if (message.destination_device !== undefined) {
      writer.uint32(66).string(message.destination_device);
    }
    if (message.destination_deck !== undefined) {
      writer.uint32(74).string(message.destination_deck);
    }
    if (message.destination_nest !== undefined) {
      writer.uint32(82).string(message.destination_nest);
    }
    if (message.destination_transfer_profile !== undefined) {
      writer.uint32(90).string(message.destination_transfer_profile);
    }
    if (message.timeout_s !== undefined) {
      writer.uint32(97).double(message.timeout_s);
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
          if (tag !== 10) {
            break;
          }

          message.step_key = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.robot = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.labware_profile = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.source_device = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.source_deck = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.source_nest = reader.string();
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.source_transfer_profile = reader.string();
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.destination_device = reader.string();
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.destination_deck = reader.string();
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.destination_nest = reader.string();
          continue;
        case 11:
          if (tag !== 90) {
            break;
          }

          message.destination_transfer_profile = reader.string();
          continue;
        case 12:
          if (tag !== 97) {
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

  fromJSON(object: any): Command_Transfer {
    return {
      step_key: isSet(object.step_key) ? String(object.step_key) : undefined,
      robot: isSet(object.robot) ? String(object.robot) : undefined,
      labware_profile: isSet(object.labware_profile) ? String(object.labware_profile) : undefined,
      source_device: isSet(object.source_device) ? String(object.source_device) : undefined,
      source_deck: isSet(object.source_deck) ? String(object.source_deck) : undefined,
      source_nest: isSet(object.source_nest) ? String(object.source_nest) : undefined,
      source_transfer_profile: isSet(object.source_transfer_profile)
        ? String(object.source_transfer_profile)
        : undefined,
      destination_device: isSet(object.destination_device) ? String(object.destination_device) : undefined,
      destination_deck: isSet(object.destination_deck) ? String(object.destination_deck) : undefined,
      destination_nest: isSet(object.destination_nest) ? String(object.destination_nest) : undefined,
      destination_transfer_profile: isSet(object.destination_transfer_profile)
        ? String(object.destination_transfer_profile)
        : undefined,
      timeout_s: isSet(object.timeout_s) ? Number(object.timeout_s) : undefined,
    };
  },

  toJSON(message: Command_Transfer): unknown {
    const obj: any = {};
    message.step_key !== undefined && (obj.step_key = message.step_key);
    message.robot !== undefined && (obj.robot = message.robot);
    message.labware_profile !== undefined && (obj.labware_profile = message.labware_profile);
    message.source_device !== undefined && (obj.source_device = message.source_device);
    message.source_deck !== undefined && (obj.source_deck = message.source_deck);
    message.source_nest !== undefined && (obj.source_nest = message.source_nest);
    message.source_transfer_profile !== undefined && (obj.source_transfer_profile = message.source_transfer_profile);
    message.destination_device !== undefined && (obj.destination_device = message.destination_device);
    message.destination_deck !== undefined && (obj.destination_deck = message.destination_deck);
    message.destination_nest !== undefined && (obj.destination_nest = message.destination_nest);
    message.destination_transfer_profile !== undefined &&
      (obj.destination_transfer_profile = message.destination_transfer_profile);
    message.timeout_s !== undefined && (obj.timeout_s = message.timeout_s);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_Transfer>, I>>(base?: I): Command_Transfer {
    return Command_Transfer.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_Transfer>, I>>(object: I): Command_Transfer {
    const message = createBaseCommand_Transfer();
    message.step_key = object.step_key ?? undefined;
    message.robot = object.robot ?? undefined;
    message.labware_profile = object.labware_profile ?? undefined;
    message.source_device = object.source_device ?? undefined;
    message.source_deck = object.source_deck ?? undefined;
    message.source_nest = object.source_nest ?? undefined;
    message.source_transfer_profile = object.source_transfer_profile ?? undefined;
    message.destination_device = object.destination_device ?? undefined;
    message.destination_deck = object.destination_deck ?? undefined;
    message.destination_nest = object.destination_nest ?? undefined;
    message.destination_transfer_profile = object.destination_transfer_profile ?? undefined;
    message.timeout_s = object.timeout_s ?? undefined;
    return message;
  },
};

function createBaseCommand_GetManagerState(): Command_GetManagerState {
  return {};
}

export const Command_GetManagerState = {
  encode(_: Command_GetManagerState, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetManagerState {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetManagerState();
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

  fromJSON(_: any): Command_GetManagerState {
    return {};
  },

  toJSON(_: Command_GetManagerState): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetManagerState>, I>>(base?: I): Command_GetManagerState {
    return Command_GetManagerState.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetManagerState>, I>>(_: I): Command_GetManagerState {
    const message = createBaseCommand_GetManagerState();
    return message;
  },
};

function createBaseCommand_GetRobotStates(): Command_GetRobotStates {
  return {};
}

export const Command_GetRobotStates = {
  encode(_: Command_GetRobotStates, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetRobotStates {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetRobotStates();
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

  fromJSON(_: any): Command_GetRobotStates {
    return {};
  },

  toJSON(_: Command_GetRobotStates): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetRobotStates>, I>>(base?: I): Command_GetRobotStates {
    return Command_GetRobotStates.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetRobotStates>, I>>(_: I): Command_GetRobotStates {
    const message = createBaseCommand_GetRobotStates();
    return message;
  },
};

function createBaseCommand_ListDevices(): Command_ListDevices {
  return { refresh: undefined };
}

export const Command_ListDevices = {
  encode(message: Command_ListDevices, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.refresh !== undefined) {
      writer.uint32(8).bool(message.refresh);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_ListDevices {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_ListDevices();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.refresh = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_ListDevices {
    return { refresh: isSet(object.refresh) ? Boolean(object.refresh) : undefined };
  },

  toJSON(message: Command_ListDevices): unknown {
    const obj: any = {};
    message.refresh !== undefined && (obj.refresh = message.refresh);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_ListDevices>, I>>(base?: I): Command_ListDevices {
    return Command_ListDevices.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_ListDevices>, I>>(object: I): Command_ListDevices {
    const message = createBaseCommand_ListDevices();
    message.refresh = object.refresh ?? undefined;
    return message;
  },
};

function createBaseCommand_ListLabwareProfiles(): Command_ListLabwareProfiles {
  return { refresh: undefined };
}

export const Command_ListLabwareProfiles = {
  encode(message: Command_ListLabwareProfiles, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.refresh !== undefined) {
      writer.uint32(8).bool(message.refresh);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_ListLabwareProfiles {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_ListLabwareProfiles();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.refresh = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_ListLabwareProfiles {
    return { refresh: isSet(object.refresh) ? Boolean(object.refresh) : undefined };
  },

  toJSON(message: Command_ListLabwareProfiles): unknown {
    const obj: any = {};
    message.refresh !== undefined && (obj.refresh = message.refresh);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_ListLabwareProfiles>, I>>(base?: I): Command_ListLabwareProfiles {
    return Command_ListLabwareProfiles.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_ListLabwareProfiles>, I>>(object: I): Command_ListLabwareProfiles {
    const message = createBaseCommand_ListLabwareProfiles();
    message.refresh = object.refresh ?? undefined;
    return message;
  },
};

function createBaseCommand_ListTransferProfiles(): Command_ListTransferProfiles {
  return { refresh: undefined };
}

export const Command_ListTransferProfiles = {
  encode(message: Command_ListTransferProfiles, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.refresh !== undefined) {
      writer.uint32(8).bool(message.refresh);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_ListTransferProfiles {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_ListTransferProfiles();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.refresh = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_ListTransferProfiles {
    return { refresh: isSet(object.refresh) ? Boolean(object.refresh) : undefined };
  },

  toJSON(message: Command_ListTransferProfiles): unknown {
    const obj: any = {};
    message.refresh !== undefined && (obj.refresh = message.refresh);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_ListTransferProfiles>, I>>(base?: I): Command_ListTransferProfiles {
    return Command_ListTransferProfiles.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_ListTransferProfiles>, I>>(object: I): Command_ListTransferProfiles {
    const message = createBaseCommand_ListTransferProfiles();
    message.refresh = object.refresh ?? undefined;
    return message;
  },
};

function createBaseCommand_GetLabwarePresence(): Command_GetLabwarePresence {
  return { robot: undefined };
}

export const Command_GetLabwarePresence = {
  encode(message: Command_GetLabwarePresence, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.robot !== undefined) {
      writer.uint32(10).string(message.robot);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetLabwarePresence {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetLabwarePresence();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.robot = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_GetLabwarePresence {
    return { robot: isSet(object.robot) ? String(object.robot) : undefined };
  },

  toJSON(message: Command_GetLabwarePresence): unknown {
    const obj: any = {};
    message.robot !== undefined && (obj.robot = message.robot);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetLabwarePresence>, I>>(base?: I): Command_GetLabwarePresence {
    return Command_GetLabwarePresence.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetLabwarePresence>, I>>(object: I): Command_GetLabwarePresence {
    const message = createBaseCommand_GetLabwarePresence();
    message.robot = object.robot ?? undefined;
    return message;
  },
};

function createBaseCommand_GetTransferEstimate(): Command_GetTransferEstimate {
  return {
    robot: undefined,
    labware_profile: undefined,
    source_device: undefined,
    source_deck: undefined,
    source_nest: undefined,
    source_transfer_profile: undefined,
    destination_device: undefined,
    destination_deck: undefined,
    destination_nest: undefined,
    destination_transfer_profile: undefined,
  };
}

export const Command_GetTransferEstimate = {
  encode(message: Command_GetTransferEstimate, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.robot !== undefined) {
      writer.uint32(10).string(message.robot);
    }
    if (message.labware_profile !== undefined) {
      writer.uint32(18).string(message.labware_profile);
    }
    if (message.source_device !== undefined) {
      writer.uint32(26).string(message.source_device);
    }
    if (message.source_deck !== undefined) {
      writer.uint32(34).string(message.source_deck);
    }
    if (message.source_nest !== undefined) {
      writer.uint32(42).string(message.source_nest);
    }
    if (message.source_transfer_profile !== undefined) {
      writer.uint32(50).string(message.source_transfer_profile);
    }
    if (message.destination_device !== undefined) {
      writer.uint32(58).string(message.destination_device);
    }
    if (message.destination_deck !== undefined) {
      writer.uint32(66).string(message.destination_deck);
    }
    if (message.destination_nest !== undefined) {
      writer.uint32(74).string(message.destination_nest);
    }
    if (message.destination_transfer_profile !== undefined) {
      writer.uint32(82).string(message.destination_transfer_profile);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetTransferEstimate {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetTransferEstimate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.robot = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.labware_profile = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.source_device = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.source_deck = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.source_nest = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.source_transfer_profile = reader.string();
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.destination_device = reader.string();
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.destination_deck = reader.string();
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.destination_nest = reader.string();
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.destination_transfer_profile = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_GetTransferEstimate {
    return {
      robot: isSet(object.robot) ? String(object.robot) : undefined,
      labware_profile: isSet(object.labware_profile) ? String(object.labware_profile) : undefined,
      source_device: isSet(object.source_device) ? String(object.source_device) : undefined,
      source_deck: isSet(object.source_deck) ? String(object.source_deck) : undefined,
      source_nest: isSet(object.source_nest) ? String(object.source_nest) : undefined,
      source_transfer_profile: isSet(object.source_transfer_profile)
        ? String(object.source_transfer_profile)
        : undefined,
      destination_device: isSet(object.destination_device) ? String(object.destination_device) : undefined,
      destination_deck: isSet(object.destination_deck) ? String(object.destination_deck) : undefined,
      destination_nest: isSet(object.destination_nest) ? String(object.destination_nest) : undefined,
      destination_transfer_profile: isSet(object.destination_transfer_profile)
        ? String(object.destination_transfer_profile)
        : undefined,
    };
  },

  toJSON(message: Command_GetTransferEstimate): unknown {
    const obj: any = {};
    message.robot !== undefined && (obj.robot = message.robot);
    message.labware_profile !== undefined && (obj.labware_profile = message.labware_profile);
    message.source_device !== undefined && (obj.source_device = message.source_device);
    message.source_deck !== undefined && (obj.source_deck = message.source_deck);
    message.source_nest !== undefined && (obj.source_nest = message.source_nest);
    message.source_transfer_profile !== undefined && (obj.source_transfer_profile = message.source_transfer_profile);
    message.destination_device !== undefined && (obj.destination_device = message.destination_device);
    message.destination_deck !== undefined && (obj.destination_deck = message.destination_deck);
    message.destination_nest !== undefined && (obj.destination_nest = message.destination_nest);
    message.destination_transfer_profile !== undefined &&
      (obj.destination_transfer_profile = message.destination_transfer_profile);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetTransferEstimate>, I>>(base?: I): Command_GetTransferEstimate {
    return Command_GetTransferEstimate.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetTransferEstimate>, I>>(object: I): Command_GetTransferEstimate {
    const message = createBaseCommand_GetTransferEstimate();
    message.robot = object.robot ?? undefined;
    message.labware_profile = object.labware_profile ?? undefined;
    message.source_device = object.source_device ?? undefined;
    message.source_deck = object.source_deck ?? undefined;
    message.source_nest = object.source_nest ?? undefined;
    message.source_transfer_profile = object.source_transfer_profile ?? undefined;
    message.destination_device = object.destination_device ?? undefined;
    message.destination_deck = object.destination_deck ?? undefined;
    message.destination_nest = object.destination_nest ?? undefined;
    message.destination_transfer_profile = object.destination_transfer_profile ?? undefined;
    return message;
  },
};

function createBaseCommand_AcknowledgeFailure(): Command_AcknowledgeFailure {
  return { guid: undefined, arm_inspected: undefined };
}

export const Command_AcknowledgeFailure = {
  encode(message: Command_AcknowledgeFailure, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.guid !== undefined) {
      writer.uint32(10).string(message.guid);
    }
    if (message.arm_inspected !== undefined) {
      writer.uint32(18).string(message.arm_inspected);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_AcknowledgeFailure {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_AcknowledgeFailure();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.guid = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.arm_inspected = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Command_AcknowledgeFailure {
    return {
      guid: isSet(object.guid) ? String(object.guid) : undefined,
      arm_inspected: isSet(object.arm_inspected) ? String(object.arm_inspected) : undefined,
    };
  },

  toJSON(message: Command_AcknowledgeFailure): unknown {
    const obj: any = {};
    message.guid !== undefined && (obj.guid = message.guid);
    message.arm_inspected !== undefined && (obj.arm_inspected = message.arm_inspected);
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_AcknowledgeFailure>, I>>(base?: I): Command_AcknowledgeFailure {
    return Command_AcknowledgeFailure.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_AcknowledgeFailure>, I>>(object: I): Command_AcknowledgeFailure {
    const message = createBaseCommand_AcknowledgeFailure();
    message.guid = object.guid ?? undefined;
    message.arm_inspected = object.arm_inspected ?? undefined;
    return message;
  },
};

function createBaseCommand_GetFailureLatch(): Command_GetFailureLatch {
  return {};
}

export const Command_GetFailureLatch = {
  encode(_: Command_GetFailureLatch, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Command_GetFailureLatch {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommand_GetFailureLatch();
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

  fromJSON(_: any): Command_GetFailureLatch {
    return {};
  },

  toJSON(_: Command_GetFailureLatch): unknown {
    const obj: any = {};
    return obj;
  },

  create<I extends Exact<DeepPartial<Command_GetFailureLatch>, I>>(base?: I): Command_GetFailureLatch {
    return Command_GetFailureLatch.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Command_GetFailureLatch>, I>>(_: I): Command_GetFailureLatch {
    const message = createBaseCommand_GetFailureLatch();
    return message;
  },
};

function createBaseConfig(): Config {
  return { host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" };
}

export const Config = {
  encode(message: Config, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.host !== "") {
      writer.uint32(10).string(message.host);
    }
    if (message.port !== 0) {
      writer.uint32(16).int32(message.port);
    }
    if (message.transfer_timeout_s !== 0) {
      writer.uint32(25).double(message.transfer_timeout_s);
    }
    if (message.ledger_dir !== "") {
      writer.uint32(34).string(message.ledger_dir);
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
          if (tag !== 25) {
            break;
          }

          message.transfer_timeout_s = reader.double();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.ledger_dir = reader.string();
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
      transfer_timeout_s: isSet(object.transfer_timeout_s) ? Number(object.transfer_timeout_s) : 0,
      ledger_dir: isSet(object.ledger_dir) ? String(object.ledger_dir) : "",
    };
  },

  toJSON(message: Config): unknown {
    const obj: any = {};
    message.host !== undefined && (obj.host = message.host);
    message.port !== undefined && (obj.port = Math.round(message.port));
    message.transfer_timeout_s !== undefined && (obj.transfer_timeout_s = message.transfer_timeout_s);
    message.ledger_dir !== undefined && (obj.ledger_dir = message.ledger_dir);
    return obj;
  },

  create<I extends Exact<DeepPartial<Config>, I>>(base?: I): Config {
    return Config.fromPartial(base ?? {});
  },

  fromPartial<I extends Exact<DeepPartial<Config>, I>>(object: I): Config {
    const message = createBaseConfig();
    message.host = object.host ?? "";
    message.port = object.port ?? 0;
    message.transfer_timeout_s = object.transfer_timeout_s ?? 0;
    message.ledger_dir = object.ledger_dir ?? "";
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
