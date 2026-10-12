import { vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import Tool from "@/server/tools";

export type FakeGrpc = {
  executeCommand: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
  configure: ReturnType<typeof vi.fn>;
  estimateDuration: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

export function installFakeTool(
  toolId: string,
  toolType: ToolType,
): { tool: Tool; grpc: FakeGrpc } {
  const tool = Tool.forId(toolId, "127.0.0.1", 1, toolType);
  tool.stopHeartbeat();

  const originalGrpc = tool.grpc as unknown as { close?: () => unknown };
  if (typeof originalGrpc?.close === "function") {
    originalGrpc.close();
  }

  const fake: FakeGrpc = {
    executeCommand: vi.fn(),
    getStatus: vi.fn(),
    configure: vi.fn(),
    estimateDuration: vi.fn(),
    close: vi.fn(),
  };

  tool.grpc = fake as unknown as Tool["grpc"];

  return { tool, grpc: fake };
}

export function removeFakeTool(toolId: string): Promise<void> {
  return Tool.removeTool(toolId);
}

export function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  isSettled: () => boolean;
} {
  let settled = false;
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = (value: T) => {
      settled = true;
      resolve(value);
    };
    rejectFn = (reason?: unknown) => {
      settled = true;
      reject(reason);
    };
  });

  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    isSettled: () => settled,
  };
}
