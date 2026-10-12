process.env.SQLITE_DB_PATH = ":memory:";

import { vi } from "vitest";

vi.mock("@/db/client", () => {
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__unitTestMock") {
          return true;
        }
        if (typeof prop === "symbol" || prop === "then") {
          return undefined;
        }
        throw new Error("@/db/client is mocked in unit tests: " + String(prop));
      },
    },
  );
  return { db, sqlite: {} };
});

vi.mock("@/server/logger", () => {
  return { logAction: vi.fn() };
});

vi.mock("@/logger", () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("@/server/runs", () => {
  class RunStoreStub {
    static get global() {
      return new RunStoreStub();
    }
  }
  return { default: RunStoreStub };
});

vi.mock("@/server/utils/integrationsLocal", () => {
  return {
    sendEmailMessage: vi.fn(),
    sendSlackMessage: vi.fn(),
  };
});
