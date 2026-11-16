// LAN-01 / D-09 golden transcripts of the flag-off command queue.
// Captured once at the unmodified commit named below, before any Phase 8
// production edit. NEVER regenerate this file after Phase 8 production edits:
// a re-capture would hide a flag-off regression.
export const GOLDEN_CAPTURE_SHA = "0c1e06e5458b790be068c78341bbcb2302c77f28";

export const GOLDEN_TRANSCRIPTS: Record<string, unknown> = {
  S0: {
    actions: [
      {
        level: "info",
        action: "Queue Started",
        details: "Command Queue started by user. The queue is empty.",
      },
      {
        level: "info",
        action: "Queue stopped",
        details: "Queue stopped.",
      },
    ],
    states: [
      "CommandQueue state: READY (was OFFLINE)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: OFFLINE (was BUSY)",
      "CommandQueue state: OFFLINE (was OFFLINE)",
    ],
    dispatched: [],
    grpcSends: [],
    midStep: null,
    rows: [],
    error: null,
  },
  S1: {
    actions: [
      {
        level: "info",
        action: "Queue Started",
        details:
          "Command Queue started by user. Will run 6 queued steps from 1 run. Queue order: queueId=1 runId=run-1 status=CREATED; queueId=2 runId=run-1 status=CREATED; queueId=3 runId=run-1 status=CREATED; queueId=4 runId=run-1 status=CREATED; queueId=5 runId=run-1 status=CREATED; queueId=6 runId=run-1 status=CREATED",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"a"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue Paused",
        details: "Queue paused with message: Check the plate at 2026-01-01T00:00:04.500Z",
      },
      {
        level: "info",
        action: "Queue Resumed",
        details: "Queue execution resumed after 0 seconds of pause",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: fast-1, Params:"tag":"b"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue Showing Message",
        details: "Queue showing message: Plates placed at 2026-01-01T00:00:09.700Z",
      },
      {
        level: "info",
        action: "Queue Resumed",
        details: "Queue execution resumed after 0 seconds of message",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"c"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue stopped",
        details: "Queue stopped.",
      },
    ],
    states: [
      "CommandQueue state: READY (was OFFLINE)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: OFFLINE (was BUSY)",
      "CommandQueue state: OFFLINE (was OFFLINE)",
    ],
    dispatched: [
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "a",
        },
      },
      {
        toolId: "fast-1",
        command: "transfer",
        params: {
          tag: "b",
        },
      },
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "c",
        },
      },
    ],
    grpcSends: [
      {
        stack: {
          transfer: {
            tag: "a",
          },
        },
      },
      {
        fast: {
          transfer: {
            tag: "b",
          },
        },
      },
      {
        stack: {
          transfer: {
            tag: "c",
          },
        },
      },
    ],
    midStep: {
      runningStep: {
        queueId: 4,
        runId: "run-1",
        toolId: "fast-1",
        toolType: "fast",
        command: "transfer",
        startedAt: 1767225606050,
      },
      runState: {
        running: true,
        queueId: 4,
        runId: "run-1",
        toolId: "fast-1",
        toolType: "fast",
        command: "transfer",
        status: "ok",
        runState: {
          state: "RUNNING",
          percent: 40,
          pause: null,
        },
        updatedAt: 1767225608050,
      },
    },
    rows: [
      {
        queueId: 1,
        runId: "run-1",
        status: "COMPLETED",
      },
      {
        queueId: 2,
        runId: "run-1",
        status: "COMPLETED",
      },
      {
        queueId: 3,
        runId: "run-1",
        status: "COMPLETED",
      },
      {
        queueId: 4,
        runId: "run-1",
        status: "COMPLETED",
      },
      {
        queueId: 5,
        runId: "run-1",
        status: "COMPLETED",
      },
      {
        queueId: 6,
        runId: "run-1",
        status: "COMPLETED",
      },
    ],
    error: null,
  },
  S2: {
    actions: [
      {
        level: "info",
        action: "Queue Started",
        details:
          "Command Queue started by user. Will run 2 queued steps from 1 run. Queue order: queueId=1 runId=run-2 status=CREATED; queueId=2 runId=run-2 status=CREATED",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"f1"',
      },
      {
        level: "error",
        action: "Tool Command Execution Error",
        details:
          'Failed to execute command: transfer, Tool: stack-1. Error: Invalid arguments provided for command "transfer". Check the parameters and try again. Tool said: bad nest (Code: INVALID_ARGUMENTS)',
      },
      {
        level: "error",
        action: "Command Failed",
        details:
          'Command failed: Invalid arguments provided for command "transfer". Check the parameters and try again. Tool said: bad nest',
      },
      {
        level: "info",
        action: "Queue Started",
        details:
          "Command Queue started by user. Will run 2 queued steps from 1 run; 1 failed before and will be retried first. Queue order: queueId=1 runId=run-2 status=FAILED; queueId=2 runId=run-2 status=CREATED",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"f1"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"f2"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue stopped",
        details: "Queue stopped.",
      },
    ],
    states: [
      "CommandQueue state: READY (was OFFLINE)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: FAILED (was BUSY)",
      "CommandQueue state: READY (was FAILED)",
      "CommandQueue state: READY (was READY)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: OFFLINE (was BUSY)",
      "CommandQueue state: OFFLINE (was OFFLINE)",
    ],
    dispatched: [
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "f1",
        },
      },
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "f1",
        },
      },
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "f2",
        },
      },
    ],
    grpcSends: [
      {
        stack: {
          transfer: {
            tag: "f1",
          },
        },
      },
      {
        stack: {
          transfer: {
            tag: "f1",
          },
        },
      },
      {
        stack: {
          transfer: {
            tag: "f2",
          },
        },
      },
    ],
    midStep: null,
    rows: [
      {
        queueId: 1,
        runId: "run-2",
        status: "COMPLETED",
      },
      {
        queueId: 2,
        runId: "run-2",
        status: "COMPLETED",
      },
    ],
    error: null,
  },
  S3: {
    actions: [
      {
        level: "info",
        action: "Queue Started",
        details:
          "Command Queue started by user. Will run 2 queued steps from 1 run. Queue order: queueId=1 runId=run-3 status=CREATED; queueId=2 runId=run-3 status=CREATED",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: fast-1, Params:"tag":"p1"',
      },
      {
        level: "warning",
        action: "Queue Start Ignored",
        details:
          "A queue start was ignored because the queue is already running; nothing was dispatched again. source=operator inFlightQueueId=1 inFlightRunId=run-3 state=OFFLINE",
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue stopped",
        details: "Queue stopped.",
      },
      {
        level: "info",
        action: "Queue Started",
        details:
          "Command Queue started by user. Will run 1 queued step from 1 run. Queue order: queueId=2 runId=run-3 status=CREATED",
      },
      {
        level: "info",
        action: "Tool Command Execution",
        details: 'Executing command: transfer, Tool: stack-1, Params:"tag":"p2"',
      },
      {
        level: "info",
        action: "Command Executed",
        details: "Command executed successfully.",
      },
      {
        level: "info",
        action: "Queue stopped",
        details: "Queue stopped.",
      },
    ],
    states: [
      "CommandQueue state: READY (was OFFLINE)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: OFFLINE (was BUSY)",
      "CommandQueue state: OFFLINE (was OFFLINE)",
      "CommandQueue state: READY (was OFFLINE)",
      "CommandQueue state: BUSY (was READY)",
      "CommandQueue state: OFFLINE (was BUSY)",
      "CommandQueue state: OFFLINE (was OFFLINE)",
    ],
    dispatched: [
      {
        toolId: "fast-1",
        command: "transfer",
        params: {
          tag: "p1",
        },
      },
      {
        toolId: "stack-1",
        command: "transfer",
        params: {
          tag: "p2",
        },
      },
    ],
    grpcSends: [
      {
        fast: {
          transfer: {
            tag: "p1",
          },
        },
      },
      {
        stack: {
          transfer: {
            tag: "p2",
          },
        },
      },
    ],
    midStep: null,
    rows: [
      {
        queueId: 1,
        runId: "run-3",
        status: "COMPLETED",
      },
      {
        queueId: 2,
        runId: "run-3",
        status: "COMPLETED",
      },
    ],
    error: null,
  },
};
