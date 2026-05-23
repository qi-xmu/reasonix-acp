import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerClientHandlers } from "../src/acp/handlers/client.js";
import {
  ERR_INVALID_PARAMS,
  ERR_METHOD_NOT_FOUND,
  ERR_RESOURCE_NOT_FOUND,
} from "../src/acp/protocol.js";
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

describe("ACP client handlers", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "acp-client-test-"));
    writeFileSync(join(tmpDir, "hello.txt"), "line 1\nline 2\nline 3\nline 4\nline 5\n");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("fs/read_text_file", () => {
    it("reads an existing file and returns content", async () => {
      const { server, send, reads } = makePair();
      registerClientHandlers(server, tmpDir);
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "fs/read_text_file",
        params: { path: "hello.txt" },
      });
      await wait();
      const reply = JSON.parse(reads()[0] ?? "{}");
      expect(reply.id).toBe(1);
      expect(reply.result.content).toBe("line 1\nline 2\nline 3\nline 4\nline 5\n");
      expect(reply.result.uri).toBe(`file://${join(tmpDir, "hello.txt")}`);
      expect(reply.error).toBeUndefined();
      server.close();
    });

    it("returns ERR_INVALID_PARAMS when path is missing", async () => {
      const { server, send, reads } = makePair();
      registerClientHandlers(server, tmpDir);
      send({
        jsonrpc: "2.0",
        id: 2,
        method: "fs/read_text_file",
        params: {},
      });
      await wait();
      const reply = JSON.parse(reads()[0] ?? "{}");
      expect(reply.id).toBe(2);
      expect(reply.error.code).toBe(ERR_INVALID_PARAMS);
      expect(reply.error.message).toContain("missing path");
      server.close();
    });

    it("returns ERR_RESOURCE_NOT_FOUND when file does not exist", async () => {
      const { server, send, reads } = makePair();
      registerClientHandlers(server, tmpDir);
      send({
        jsonrpc: "2.0",
        id: 3,
        method: "fs/read_text_file",
        params: { path: "nonexistent.txt" },
      });
      await wait();
      const reply = JSON.parse(reads()[0] ?? "{}");
      expect(reply.id).toBe(3);
      expect(reply.error.code).toBe(ERR_RESOURCE_NOT_FOUND);
      expect(reply.error.message).toContain("file not found");
      server.close();
    });
  });

  describe("fs/write_text_file", () => {
    it("writes content and returns URI", async () => {
      const { server, send, reads } = makePair();
      registerClientHandlers(server, tmpDir);
      send({
        jsonrpc: "2.0",
        id: 4,
        method: "fs/write_text_file",
        params: { path: "output.txt", content: "written content" },
      });
      await wait();
      const reply = JSON.parse(reads()[0] ?? "{}");
      expect(reply.id).toBe(4);
      expect(reply.result.uri).toBe(`file://${join(tmpDir, "output.txt")}`);
      expect(reply.error).toBeUndefined();

      const written = readFileSync(join(tmpDir, "output.txt"), "utf-8");
      expect(written).toBe("written content");
      server.close();
    });

    it("returns ERR_INVALID_PARAMS when content is missing", async () => {
      const { server, send, reads } = makePair();
      registerClientHandlers(server, tmpDir);
      send({
        jsonrpc: "2.0",
        id: 5,
        method: "fs/write_text_file",
        params: { path: "output.txt" },
      });
      await wait();
      const reply = JSON.parse(reads()[0] ?? "{}");
      expect(reply.id).toBe(5);
      expect(reply.error.code).toBe(ERR_INVALID_PARAMS);
      expect(reply.error.message).toContain("missing content");
      server.close();
    });
  });

  describe("terminal stubs", () => {
    const terminalMethods = [
      "terminal/create",
      "terminal/output",
      "terminal/wait_for_exit",
      "terminal/kill",
      "terminal/release",
    ];

    for (const method of terminalMethods) {
      it(`${method} returns ERR_METHOD_NOT_FOUND`, async () => {
        const { server, send, reads } = makePair();
        registerClientHandlers(server, tmpDir);
        send({
          jsonrpc: "2.0",
          id: 6,
          method,
          params: { terminalId: "t1" },
        });
        await wait();
        const reply = JSON.parse(reads()[0] ?? "{}");
        expect(reply.id).toBe(6);
        expect(reply.error.code).toBe(ERR_METHOD_NOT_FOUND);
        expect(reply.error.message).toContain("not supported in local mode");
        server.close();
      });
    }
  });
});
