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
  flattenPrompt,
} from "../src/acp/protocol.js";

describe("ACP protocol constants", () => {
  it("pins protocol version to 1", () => {
    expect(ACP_PROTOCOL_VERSION).toBe(1);
  });

  it("exports all JSON-RPC + ACP error codes", () => {
    expect(ERR_PARSE).toBe(-32700);
    expect(ERR_INVALID_REQUEST).toBe(-32600);
    expect(ERR_METHOD_NOT_FOUND).toBe(-32601);
    expect(ERR_INVALID_PARAMS).toBe(-32602);
    expect(ERR_INTERNAL).toBe(-32603);
    expect(ERR_AUTH_REQUIRED).toBe(-32000);
    expect(ERR_RESOURCE_NOT_FOUND).toBe(-32002);
  });
});

describe("flattenPrompt", () => {
  it("concatenates text blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ];
    expect(flattenPrompt(blocks)).toBe("hello\n\nworld");
  });

  it("includes resource blocks with inline text", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "analyze this" },
      {
        type: "resource",
        resource: { uri: "file:///x.py", mimeType: "text/x-python", text: "print('hi')" },
      },
    ];
    expect(flattenPrompt(blocks)).toBe("analyze this\n\nprint('hi')");
  });

  it("skips resource_link blocks (no inline text)", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "check this" },
      {
        type: "resource_link",
        uri: "file:///x.py",
        name: "x.py",
        mimeType: "text/x-python",
        size: 1234,
      },
      { type: "text", text: "thanks" },
    ];
    expect(flattenPrompt(blocks)).toBe("check this\n\nthanks");
  });

  it("skips image and audio blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "image", mimeType: "image/png", data: "AAAA" },
      { type: "audio", mimeType: "audio/wav", data: "AAAA" },
      { type: "text", text: "only text survives" },
    ];
    expect(flattenPrompt(blocks)).toBe("only text survives");
  });

  it("skips resource blocks without inline text", () => {
    const blocks: ContentBlock[] = [
      {
        type: "resource",
        resource: { uri: "file:///x.bin", mimeType: "application/octet-stream" },
      },
      { type: "text", text: "text part" },
    ];
    expect(flattenPrompt(blocks)).toBe("text part");
  });

  it("returns empty string for empty or non-text blocks", () => {
    expect(flattenPrompt([])).toBe("");
    expect(
      flattenPrompt([
        {
          type: "resource_link",
          uri: "file:///a.txt",
          name: "a.txt",
        },
      ]),
    ).toBe("");
  });
});
