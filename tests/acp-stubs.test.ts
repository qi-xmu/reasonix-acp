import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { registerStubHandlers } from "../src/acp/handlers/stubs.js";
import { ERR_METHOD_NOT_FOUND } from "../src/acp/protocol.js";
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

describe("ACP stub handlers", () => {
  it("session/load returns ERR_METHOD_NOT_FOUND", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({ jsonrpc: "2.0", id: 1, method: "session/load", params: { sessionId: "s1" } });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.error?.code).toBe(ERR_METHOD_NOT_FOUND);
    expect(reply.error?.message).toBe("session/load: not supported");
    server.close();
  });

  it("session/resume returns ERR_METHOD_NOT_FOUND", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({ jsonrpc: "2.0", id: 2, method: "session/resume", params: { sessionId: "s1" } });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.error?.code).toBe(ERR_METHOD_NOT_FOUND);
    expect(reply.error?.message).toBe("session/resume: not supported");
    server.close();
  });

  it("authenticate returns {}", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({ jsonrpc: "2.0", id: 3, method: "authenticate", params: { method: "none" } });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.result).toEqual({});
    server.close();
  });

  it("logout returns {}", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({ jsonrpc: "2.0", id: 4, method: "logout", params: {} });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.result).toEqual({});
    server.close();
  });

  it("session/set_mode returns {}", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({
      jsonrpc: "2.0",
      id: 5,
      method: "session/set_mode",
      params: { sessionId: "s1", mode: "architect" },
    });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.result).toEqual({});
    server.close();
  });

  it("session/set_config_option returns {}", async () => {
    const { server, send, reads } = makePair();
    registerStubHandlers(server);
    send({
      jsonrpc: "2.0",
      id: 6,
      method: "session/set_config_option",
      params: { sessionId: "s1", key: "temperature", value: 0.7 },
    });
    await wait();
    const reply = JSON.parse(reads()[0] ?? "{}");
    expect(reply.result).toEqual({});
    server.close();
  });
});
