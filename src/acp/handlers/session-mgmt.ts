import { ERR_INVALID_PARAMS } from "../protocol.js";
import type {
  SessionCloseParams,
  SessionCloseResult,
  SessionInfo,
  SessionListParams,
  SessionListResult,
} from "../protocol.js";
import type { AcpServer } from "../server.js";

interface Session {
  id: string;
  rootDir: string;
  model: string;
  aborter: AbortController | null;
  mcpClients: { close(): Promise<unknown> }[];
}

export function registerSessionManagementHandlers(
  server: AcpServer,
  sessions: Map<string, Session>,
): void {
  server.onRequest<SessionCloseParams, SessionCloseResult>("session/close", async (params) => {
    if (!params?.sessionId) {
      throw Object.assign(new Error("session/close: missing sessionId"), {
        code: ERR_INVALID_PARAMS,
      });
    }
    const session = sessions.get(params.sessionId);
    if (session) {
      session.aborter?.abort();
      await Promise.all(session.mcpClients.map((mcp) => mcp.close().catch(() => undefined)));
      sessions.delete(params.sessionId);
    }
    return {};
  });

  server.onRequest<SessionListParams, SessionListResult>("session/list", (_params) => {
    const sessionInfos: SessionInfo[] = [];
    for (const [id, session] of sessions) {
      sessionInfos.push({
        sessionId: id,
        cwd: session.rootDir,
        title: `reasonix: ${session.rootDir}`,
        updatedAt: new Date().toISOString(),
      });
    }
    return { sessions: sessionInfos };
  });
}
