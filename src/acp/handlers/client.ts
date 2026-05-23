import { constants, access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ERR_INVALID_PARAMS, ERR_METHOD_NOT_FOUND, ERR_RESOURCE_NOT_FOUND } from "../protocol.js";
import type {
  CreateTerminalParams,
  CreateTerminalResult,
  KillTerminalParams,
  KillTerminalResult,
  ReadTextFileParams,
  ReadTextFileResult,
  ReleaseTerminalParams,
  ReleaseTerminalResult,
  TerminalOutputParams,
  TerminalOutputResult,
  WaitForTerminalExitParams,
  WaitForTerminalExitResult,
  WriteTextFileParams,
  WriteTextFileResult,
} from "../protocol.js";
import type { AcpServer } from "../server.js";

export function registerClientHandlers(server: AcpServer, defaultDir: string): void {
  // fs/read_text_file
  server.onRequest<ReadTextFileParams, ReadTextFileResult>("fs/read_text_file", async (params) => {
    if (!params || typeof params.path !== "string") {
      throw Object.assign(new Error("fs/read_text_file: missing path"), {
        code: ERR_INVALID_PARAMS,
      });
    }
    const abs = resolve(defaultDir, params.path);
    try {
      await access(abs, constants.R_OK);
    } catch {
      throw Object.assign(new Error(`fs/read_text_file: file not found: ${abs}`), {
        code: ERR_RESOURCE_NOT_FOUND,
      });
    }
    const raw = await readFile(abs, "utf-8");
    let content = raw;
    if (typeof params.line === "number" || typeof params.limit === "number") {
      const lines = raw.split("\n");
      const start = typeof params.line === "number" ? params.line : 1;
      const end = typeof params.limit === "number" ? start + params.limit : lines.length;
      content = lines.slice(start - 1, end).join("\n");
    }
    return { content, uri: `file://${abs}` };
  });

  // fs/write_text_file
  server.onRequest<WriteTextFileParams, WriteTextFileResult>(
    "fs/write_text_file",
    async (params) => {
      if (!params || typeof params.path !== "string") {
        throw Object.assign(new Error("fs/write_text_file: missing path"), {
          code: ERR_INVALID_PARAMS,
        });
      }
      if (typeof params.content !== "string") {
        throw Object.assign(new Error("fs/write_text_file: missing content"), {
          code: ERR_INVALID_PARAMS,
        });
      }
      const abs = resolve(defaultDir, params.path);
      await writeFile(abs, params.content, "utf-8");
      return { uri: `file://${abs}` };
    },
  );

  // terminal stubs
  const terminalStub = (method: string) => () => {
    throw Object.assign(new Error(`${method}: not supported in local mode`), {
      code: ERR_METHOD_NOT_FOUND,
    });
  };

  server.onRequest<CreateTerminalParams, CreateTerminalResult>(
    "terminal/create",
    terminalStub("terminal/create"),
  );
  server.onRequest<TerminalOutputParams, TerminalOutputResult>(
    "terminal/output",
    terminalStub("terminal/output"),
  );
  server.onRequest<WaitForTerminalExitParams, WaitForTerminalExitResult>(
    "terminal/wait_for_exit",
    terminalStub("terminal/wait_for_exit"),
  );
  server.onRequest<KillTerminalParams, KillTerminalResult>(
    "terminal/kill",
    terminalStub("terminal/kill"),
  );
  server.onRequest<ReleaseTerminalParams, ReleaseTerminalResult>(
    "terminal/release",
    terminalStub("terminal/release"),
  );
}
