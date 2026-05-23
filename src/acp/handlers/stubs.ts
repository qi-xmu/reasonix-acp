import { ERR_METHOD_NOT_FOUND } from "../protocol.js";
import type {
  AuthenticateParams,
  AuthenticateResult,
  LogoutParams,
  LogoutResult,
  SessionLoadParams,
  SessionLoadResult,
  SessionResumeParams,
  SessionResumeResult,
  SessionSetConfigOptionParams,
  SessionSetConfigOptionResult,
  SessionSetModeParams,
  SessionSetModeResult,
} from "../protocol.js";
import type { AcpServer } from "../server.js";

export function registerStubHandlers(server: AcpServer): void {
  server.onRequest<SessionLoadParams, SessionLoadResult>("session/load", () => {
    throw Object.assign(new Error("session/load: not supported"), {
      code: ERR_METHOD_NOT_FOUND,
    });
  });

  server.onRequest<SessionResumeParams, SessionResumeResult>("session/resume", () => {
    throw Object.assign(new Error("session/resume: not supported"), {
      code: ERR_METHOD_NOT_FOUND,
    });
  });

  server.onRequest<AuthenticateParams, AuthenticateResult>("authenticate", () => {
    return {};
  });

  server.onRequest<LogoutParams, LogoutResult>("logout", () => {
    return {};
  });

  server.onRequest<SessionSetModeParams, SessionSetModeResult>("session/set_mode", () => {
    return {};
  });

  server.onRequest<SessionSetConfigOptionParams, SessionSetConfigOptionResult>(
    "session/set_config_option",
    () => {
      return {};
    },
  );
}
