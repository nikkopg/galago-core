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
  throw new Error("installFakeTool not implemented");
}

export async function removeFakeTool(toolId: string): Promise<void> {
  throw new Error("removeFakeTool not implemented");
}

export function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  isSettled: () => boolean;
} {
  throw new Error("deferred not implemented");
}
