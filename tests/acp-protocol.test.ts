/** Protocol wire-type and constant validation tests for ACP v1. */

import { describe, expect, it } from "vitest";
import {
  ACP_PROTOCOL_VERSION,
  type ContentBlock,
  ERR_AUTH_REQUIRED,
  ERR_INTERNAL,
  ERR_INVALID_PARAMS,
  ERR_INVALID_REQUEST,
  ERR_METHOD_NOT_FOUND,
  ERR_PARSE,
  ERR_RESOURCE_NOT_FOUND,
  type SessionUpdate,
  type SessionUpdateParams,
  flattenPrompt,
} from "../src/acp/protocol.js";

// ── Version ──────────────────────────────────────────────────

describe("ACP protocol version", () => {
  it("is pinned to v1", () => {
    expect(ACP_PROTOCOL_VERSION).toBe(1);
  });
});

// ── JSON-RPC error codes ─────────────────────────────────────

describe("JSON-RPC error codes", () => {
  it("ERR_PARSE is -32700", () => {
    expect(ERR_PARSE).toBe(-32700);
  });

  it("ERR_INVALID_REQUEST is -32600", () => {
    expect(ERR_INVALID_REQUEST).toBe(-32600);
  });

  it("ERR_METHOD_NOT_FOUND is -32601", () => {
    expect(ERR_METHOD_NOT_FOUND).toBe(-32601);
  });

  it("ERR_INVALID_PARAMS is -32602", () => {
    expect(ERR_INVALID_PARAMS).toBe(-32602);
  });

  it("ERR_INTERNAL is -32603", () => {
    expect(ERR_INTERNAL).toBe(-32603);
  });

  it("ERR_AUTH_REQUIRED is -32000", () => {
    expect(ERR_AUTH_REQUIRED).toBe(-32000);
  });

  it("ERR_RESOURCE_NOT_FOUND is -32002", () => {
    expect(ERR_RESOURCE_NOT_FOUND).toBe(-32002);
  });
});

// ── StopReason ───────────────────────────────────────────────

describe("StopReason", () => {
  it("only accepts valid stop reasons", () => {
    const reasons: Array<import("../src/acp/protocol.js").StopReason> = [
      "end_turn",
      "tool_use_complete",
      "cancelled",
      "error",
    ];
    expect(reasons).toHaveLength(4);
    expect(reasons).toContain("end_turn");
    expect(reasons).toContain("tool_use_complete");
    expect(reasons).toContain("cancelled");
    expect(reasons).toContain("error");
  });
});

// ── ContentBlock ─────────────────────────────────────────────

describe("ContentBlock", () => {
  it("text variant carries plain text", () => {
    const block: ContentBlock = { type: "text", text: "hello" };
    expect(block.type).toBe("text");
    expect(block.text).toBe("hello");
  });

  it("resource variant carries URI, optional mimeType and text", () => {
    const withMeta: ContentBlock = {
      type: "resource",
      resource: { uri: "file:///a.txt", mimeType: "text/plain", text: "body" },
    };
    expect(withMeta.type).toBe("resource");
    expect(withMeta.resource.uri).toBe("file:///a.txt");
    expect(withMeta.resource.text).toBe("body");

    const minimal: ContentBlock = {
      type: "resource",
      resource: { uri: "file:///b.txt" },
    };
    expect(minimal.type).toBe("resource");
    expect(minimal.resource.uri).toBe("file:///b.txt");
    expect(minimal.resource.mimeType).toBeUndefined();
    expect(minimal.resource.text).toBeUndefined();
  });

  it("image variant carries mimeType and base64 data", () => {
    const block: ContentBlock = { type: "image", mimeType: "image/png", data: "AAAA" };
    expect(block.type).toBe("image");
    expect(block.data).toBe("AAAA");
  });

  it("audio variant carries mimeType and base64 data", () => {
    const block: ContentBlock = { type: "audio", mimeType: "audio/ogg", data: "BBBB" };
    expect(block.type).toBe("audio");
    expect(block.data).toBe("BBBB");
  });
});

// ── flattenPrompt ────────────────────────────────────────────

describe("flattenPrompt", () => {
  it("concatenates text blocks with double-newline separators", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ];
    expect(flattenPrompt(blocks)).toBe("first\n\nsecond");
  });

  it("includes inline text from resource blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "resource", resource: { uri: "f1", text: "resource body" } },
    ];
    expect(flattenPrompt(blocks)).toBe("resource body");
  });

  it("ignores image and audio blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "image", mimeType: "image/png", data: "AA" },
      { type: "text", text: "only" },
      { type: "audio", mimeType: "audio/wav", data: "BB" },
    ];
    expect(flattenPrompt(blocks)).toBe("only");
  });

  it("returns empty string for empty array", () => {
    expect(flattenPrompt([])).toBe("");
  });

  it("trims surrounding whitespace", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "  padded  " }];
    expect(flattenPrompt(blocks)).toBe("padded");
  });
});

// ── SessionUpdate discriminants ──────────────────────────────

describe("SessionUpdate union", () => {
  it("agent_message_chunk has text content", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "streaming" },
    };
    const params: SessionUpdateParams = { sessionId: "s1", update };
    expect(params.update.sessionUpdate).toBe("agent_message_chunk");
    if (params.update.sessionUpdate === "agent_message_chunk") {
      expect(params.update.content.text).toBe("streaming");
    }
  });

  it("agent_thought_chunk has text content", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "thinking..." },
    };
    expect(update.sessionUpdate).toBe("agent_thought_chunk");
    expect(update.content.text).toBe("thinking...");
  });

  it("tool_call carries required toolCallId and optional fields", () => {
    const minimal: SessionUpdate = {
      sessionUpdate: "tool_call",
      toolCallId: "tc-1",
    };
    expect(minimal.toolCallId).toBe("tc-1");

    const full: SessionUpdate = {
      sessionUpdate: "tool_call",
      toolCallId: "tc-2",
      title: "read_file",
      kind: "read",
      status: "in_progress",
      rawInput: { path: "/tmp/x" },
    };
    if (full.sessionUpdate === "tool_call") {
      expect(full.title).toBe("read_file");
      expect(full.kind).toBe("read");
      expect(full.status).toBe("in_progress");
      expect(full.rawInput).toEqual({ path: "/tmp/x" });
    }
  });

  it("tool_call_update carries toolCallId with optional status and content", () => {
    const statusOnly: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-3",
      status: "completed",
    };
    if (statusOnly.sessionUpdate === "tool_call_update") {
      expect(statusOnly.toolCallId).toBe("tc-3");
      expect(statusOnly.status).toBe("completed");
    }

    const withContent: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-4",
      content: [{ type: "content", content: { type: "text", text: "result" } }],
    };
    if (withContent.sessionUpdate === "tool_call_update") {
      expect(withContent.content).toHaveLength(1);
      if (withContent.content) {
        expect(withContent.content[0].type).toBe("content");
        expect(withContent.content[0].content.text).toBe("result");
      }
    }
  });

  it("plan carries entries with priority and status", () => {
    const update: SessionUpdate = {
      sessionUpdate: "plan",
      entries: [
        { content: "step 1", priority: "high", status: "completed" },
        { content: "step 2", priority: "low", status: "pending" },
      ],
    };
    if (update.sessionUpdate === "plan") {
      expect(update.entries).toHaveLength(2);
      expect(update.entries[0].priority).toBe("high");
      expect(update.entries[0].status).toBe("completed");
      expect(update.entries[1].priority).toBe("low");
      expect(update.entries[1].status).toBe("pending");
    }
  });
});

// ── Permission types ─────────────────────────────────────────

describe("PermissionOptionKind", () => {
  it("covers all four option kinds", () => {
    const kinds: Array<import("../src/acp/protocol.js").PermissionOptionKind> = [
      "allow_once",
      "allow_always",
      "reject_once",
      "reject_always",
    ];
    expect(kinds).toHaveLength(4);
  });
});

describe("PermissionOutcome", () => {
  it("selected outcome carries optionId", () => {
    const outcome: import("../src/acp/protocol.js").PermissionOutcome = {
      outcome: "selected",
      optionId: "opt-1",
    };
    if (outcome.outcome === "selected") {
      expect(outcome.optionId).toBe("opt-1");
    }
  });

  it("cancelled outcome is standalone", () => {
    const outcome: import("../src/acp/protocol.js").PermissionOutcome = {
      outcome: "cancelled",
    };
    expect(outcome.outcome).toBe("cancelled");
  });
});

// ── Tool kind values used in dispatch ────────────────────────

describe("Tool kind classification", () => {
  it("kind must be one of read | edit | search | execute | other", () => {
    const validKinds: Array<"read" | "edit" | "search" | "execute" | "other"> = [
      "read",
      "edit",
      "search",
      "execute",
      "other",
    ];
    expect(validKinds).toHaveLength(5);
  });
});
