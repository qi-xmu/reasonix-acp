import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { registerSessionManagementHandlers } from "../src/acp/handlers/session-mgmt.js";
import { ERR_INVALID_PARAMS } from "../src/acp/protocol.js";
import { AcpServer } from "../src/acp/server.js";

function makePair() {
  const input = new PassThrough();
  const output = new PassThrough();
  const collected: string[] = [];
  output.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed) collected.push(trimmed);
    }
  });
  const server = new AcpServer({ input, output });
  return {
    server,
    send: (msg: unknown) => input.write(`${JSON.stringify(msg)}\n`),
    reads: () => collected.slice(),
  };
}

function wait(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSession(
  overrides: {
    id?: string;
    rootDir?: string;
    model?: string;
  } = {},
) {
  const aborter = new AbortController();
  const onClose = vi.fn().mockResolvedValue(undefined);
  const onAbort = vi.fn();
  aborter.signal.addEventListener("abort", onAbort);
  return {
    session: {
      id: overrides.id ?? "sess_001",
      rootDir: overrides.rootDir ?? "/tmp/test",
      model: overrides.model ?? "test-model",
      aborter,
      mcpClients: [{ close: onClose }],
    },
    onAbort,
    onClose,
  };
}

describe("session/close", () => {
  it("aborts, closes MCP clients, and removes session from Map", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();
    const { session, onAbort, onClose } = makeSession();
    sessions.set(session.id, session);

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "session/close",
      params: { sessionId: session.id },
    });
    await wait();

    expect(onAbort).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(sessions.has(session.id)).toBe(false);

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(1);
    expect(reply.result).toEqual({});
    server.close();
  });

  it("returns {} for unknown sessionId (idempotent)", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 2,
      method: "session/close",
      params: { sessionId: "nonexistent" },
    });
    await wait();

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(2);
    expect(reply.result).toEqual({});
    server.close();
  });

  it("returns error when sessionId is missing", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 3,
      method: "session/close",
      params: {},
    });
    await wait();

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(3);
    expect(reply.error).toBeDefined();
    expect(reply.error.code).toBe(ERR_INVALID_PARAMS);
    server.close();
  });

  it("returns error when params is completely missing", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 4,
      method: "session/close",
    });
    await wait();

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(4);
    expect(reply.error).toBeDefined();
    expect(reply.error.code).toBe(ERR_INVALID_PARAMS);
    server.close();
  });
});

describe("session/list", () => {
  it("returns empty array when no sessions exist", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "session/list",
    });
    await wait();

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(1);
    expect(reply.result).toEqual({ sessions: [] });
    server.close();
  });

  it("returns correct SessionInfo for multiple sessions", async () => {
    const { server, send, reads } = makePair();
    const sessions = new Map();
    const s1 = makeSession({ id: "sess_001", rootDir: "/tmp/a" });
    const s2 = makeSession({ id: "sess_002", rootDir: "/tmp/b" });
    sessions.set(s1.session.id, s1.session);
    sessions.set(s2.session.id, s2.session);

    registerSessionManagementHandlers(server, sessions);

    send({
      jsonrpc: "2.0",
      id: 2,
      method: "session/list",
    });
    await wait();

    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.id).toBe(2);
    expect(reply.result.sessions).toHaveLength(2);

    const session1 = reply.result.sessions.find(
      (s: { sessionId: string }) => s.sessionId === "sess_001",
    );
    const session2 = reply.result.sessions.find(
      (s: { sessionId: string }) => s.sessionId === "sess_002",
    );

    expect(session1).toBeDefined();
    expect(session1.cwd).toBe("/tmp/a");
    expect(session1.title).toContain("/tmp/a");
    expect(session1.updatedAt).toEqual(expect.any(String));

    expect(session2).toBeDefined();
    expect(session2.cwd).toBe("/tmp/b");
    expect(session2.title).toContain("/tmp/b");
    expect(session2.updatedAt).toEqual(expect.any(String));

    server.close();
  });
});
