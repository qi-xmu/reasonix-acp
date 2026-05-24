import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { sendAvailableCommands } from "../src/acp/dispatch.js";
import { type ContentBlock, type SkillResolver, flattenPrompt } from "../src/acp/protocol.js";
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

describe("sendAvailableCommands", () => {
  it("emits available_commands_update notification with slash commands", () => {
    const { server, reads } = makePair();
    sendAvailableCommands(server, "s1", []);
    const parsed = reads().map((l) => JSON.parse(l));
    const update = parsed.find((m) => m.method === "session/update");
    expect(update).toBeDefined();
    expect(update.params.sessionId).toBe("s1");
    expect(update.params.update.sessionUpdate).toBe("available_commands_update");
    expect(update.params.update.availableCommands.length).toBeGreaterThan(0);
    server.close();
  });

  it("prepends skills as commands, deduplicating against slash commands", () => {
    const { server, reads } = makePair();
    const skills = [
      { name: "pdf", description: "Process PDF files" },
      { name: "xlsx", description: "Handle spreadsheets" },
    ];
    sendAvailableCommands(server, "s1", skills);
    const parsed = reads().map((l) => JSON.parse(l));
    const cmds = parsed.find((m) => m.method === "session/update")?.params.update
      .availableCommands as Array<{
      name: string;
    }>;
    const skillCmd = cmds.find((c) => c.name === "pdf");
    expect(skillCmd).toBeDefined();
    // "/help" comes from slash commands when no skill named "help"
    const helpIdx = cmds.findIndex((c) => c.name === "help");
    if (helpIdx >= 0) {
      // slash command "help" should still appear since no skill named "help"
      expect(cmds[helpIdx]?.description).toBeTruthy();
    }
    server.close();
  });

  it("skills shadow same-named slash commands", () => {
    const { server, reads } = makePair();
    // "help" exists in SLASH_COMMANDS — verify skill "help" takes over
    const skills = [{ name: "help", description: "Custom help skill" }];
    sendAvailableCommands(server, "s1", skills);
    const parsed = reads().map((l) => JSON.parse(l));
    const cmds = parsed.find((m) => m.method === "session/update")?.params.update
      .availableCommands as Array<{
      name: string;
      description: string;
    }>;
    const helpCmd = cmds.find((c) => c.name === "help");
    expect(helpCmd).toBeDefined();
    expect(helpCmd?.description).toBe("Custom help skill");
    server.close();
  });

  it("includes input hint from argsHint when present", () => {
    const { server, reads } = makePair();
    sendAvailableCommands(server, "s1", []);
    const parsed = reads().map((l) => JSON.parse(l));
    const cmds = parsed.find((m) => m.method === "session/update")?.params.update
      .availableCommands as Array<{
      name: string;
      input?: { hint: string } | null;
    }>;
    const modelCmd = cmds.find((c) => c.name === "model");
    expect(modelCmd?.input).toEqual({ hint: "<id>" });
    server.close();
  });
});

describe("flattenPrompt with skillResolver", () => {
  function resolver(skills: Record<string, string>): SkillResolver {
    return {
      read(name) {
        const body = skills[name];
        return body ? { name, body } : undefined;
      },
    };
  }

  it("passes through plain text when no slash prefix", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "hello world" }];
    expect(flattenPrompt(blocks, resolver({ pdf: "do PDF stuff" }))).toBe("hello world");
  });

  it("expands known skill name with no args", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/pdf" }];
    expect(flattenPrompt(blocks, resolver({ pdf: "Process PDF files with care." }))).toBe(
      "[skill: pdf]\nProcess PDF files with care.",
    );
  });

  it("expands known skill name with trailing args", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/pdf analyze this report" }];
    expect(flattenPrompt(blocks, resolver({ pdf: "Process PDF files." }))).toBe(
      "[skill: pdf]\nProcess PDF files.\nTask: analyze this report",
    );
  });

  it("passes through unknown slash command unchanged", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/foobar do stuff" }];
    expect(flattenPrompt(blocks, resolver({ pdf: "body" }))).toBe("/foobar do stuff");
  });

  it("works without skillResolver (backward compat)", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/pdf report" }];
    expect(flattenPrompt(blocks)).toBe("/pdf report");
  });

  it("expands skill from leading slash in multi-block input", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "/xlsx" },
      {
        type: "resource",
        resource: { uri: "file:///data.csv", text: "col1,col2\n1,2" },
      },
      { type: "text", text: "summarize trends" },
    ];
    expect(flattenPrompt(blocks, resolver({ xlsx: "Handle spreadsheets." }))).toBe(
      "[skill: xlsx]\nHandle spreadsheets.\nTask: col1,col2\n1,2\n\nsummarize trends",
    );
  });

  it("expands skill when slash is the only block", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "  /xlsx generate pivot table  " }];
    expect(flattenPrompt(blocks, resolver({ xlsx: "Spreadsheet skill body." }))).toBe(
      "[skill: xlsx]\nSpreadsheet skill body.\nTask: generate pivot table",
    );
  });

  it("does NOT expand slash in middle of text", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "preface\n/xlsx do stuff" }];
    expect(flattenPrompt(blocks, resolver({ xlsx: "body" }))).toBe("preface\n/xlsx do stuff");
  });

  it("does NOT expand when slash command has only known slash commands ", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/help" }];
    // "help" is a slash command, not a skill — skillResolver won't find it
    expect(flattenPrompt(blocks, resolver({}))).toBe("/help");
  });

  it("null skillResolver is ignored", () => {
    const blocks: ContentBlock[] = [{ type: "text", text: "/pdf report" }];
    expect(flattenPrompt(blocks, undefined)).toBe("/pdf report");
  });
});
