/** Wire types for the Agent Client Protocol — https://agentclientprotocol.com */

export const ACP_PROTOCOL_VERSION = 1;

export type JsonRpcId = string | number;

export interface JsonRpcRequest<P = unknown> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: P;
}

export interface JsonRpcNotification<P = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: P;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse<R = unknown> {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: R;
  error?: JsonRpcError;
}

// ── Initialize ──────────────────────────────────────────────

export interface InitializeParams {
  protocolVersion: number;
  clientCapabilities?: {
    fs?: { readTextFile?: boolean; writeTextFile?: boolean };
    terminal?: boolean;
  };
  clientInfo?: { name: string; title?: string; version?: string };
}

export interface InitializeResult {
  protocolVersion: number;
  agentCapabilities: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
    mcpCapabilities?: { http?: boolean; sse?: boolean };
    sessionCapabilities?: {
      close?: Record<string, never> | null;
      list?: Record<string, never> | null;
      resume?: Record<string, never> | null;
    };
  };
  agentInfo: { name: string; title?: string; version: string };
  authMethods: never[];
}

// ── Session new ─────────────────────────────────────────────

export interface SessionNewParams {
  cwd?: string;
  mcpServers?: Array<{
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

export interface SessionNewResult {
  sessionId: string;
}

// ── Content blocks ──────────────────────────────────────────

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } }
  | {
      type: "resource_link";
      uri: string;
      name: string;
      mimeType?: string;
      size?: number;
      description?: string;
    }
  | { type: "image"; mimeType: string; data: string }
  | { type: "audio"; mimeType: string; data: string };

// ── Session prompt ──────────────────────────────────────────

export interface SessionPromptParams {
  sessionId: string;
  prompt: ContentBlock[];
}

export type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";

export interface SessionPromptResult {
  stopReason: StopReason;
}

// ── Session update ──────────────────────────────────────────

export interface ToolCallLocation {
  path: string;
  line?: number | null;
}

export type ToolKind =
  | "read"
  | "edit"
  | "delete"
  | "move"
  | "search"
  | "execute"
  | "think"
  | "fetch"
  | "switch_mode"
  | "other";

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

export interface Diff {
  path: string;
  newText: string;
  oldText?: string | null;
}

export type ToolCallContent =
  | { type: "content"; content: { type: "text"; text: string } }
  | { type: "diff"; path: string; newText: string; oldText?: string | null };

export interface PlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}

export type SessionUpdate =
  | {
      sessionUpdate: "user_message_chunk";
      content: { type: "text"; text: string };
    }
  | {
      sessionUpdate: "agent_message_chunk";
      content: { type: "text"; text: string };
    }
  | {
      sessionUpdate: "agent_thought_chunk";
      content: { type: "text"; text: string };
    }
  | {
      sessionUpdate: "tool_call";
      toolCallId: string;
      title?: string;
      kind?: ToolKind;
      status?: ToolCallStatus;
      rawInput?: unknown;
      rawOutput?: unknown;
      locations?: ToolCallLocation[];
      content?: ToolCallContent[];
    }
  | {
      sessionUpdate: "tool_call_update";
      toolCallId: string;
      status?: ToolCallStatus;
      content?: ToolCallContent[];
      locations?: ToolCallLocation[];
    }
  | {
      sessionUpdate: "plan";
      entries: PlanEntry[];
    }
  | {
      sessionUpdate: "available_commands_update";
      availableCommands: Array<{
        name: string;
        description: string;
        input?: { hint: string } | null;
      }>;
    }
  | {
      sessionUpdate: "current_mode_update";
      currentModeId: string;
    }
  | {
      sessionUpdate: "config_option_update";
      configOptions: SessionConfigOption[];
    }
  | {
      sessionUpdate: "session_info_update";
      title?: string | null;
      updatedAt?: string | null;
    };

export interface SessionUpdateParams {
  sessionId: string;
  update: SessionUpdate;
}

// ── Session cancel ──────────────────────────────────────────

export interface SessionCancelParams {
  sessionId: string;
}

// ── Session close ───────────────────────────────────────────

export interface SessionCloseParams {
  sessionId: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface SessionCloseResult {}

// ── Session list ────────────────────────────────────────────

export interface SessionListParams {
  cursor?: string | null;
  cwd?: string | null;
}

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  title?: string | null;
  updatedAt?: string | null;
}

export interface SessionListResult {
  sessions: SessionInfo[];
  nextCursor?: string | null;
}

// ── Session load ────────────────────────────────────────────

export interface SessionLoadParams {
  sessionId: string;
  cwd: string;
  mcpServers: unknown[];
}

export interface SessionLoadResult {
  configOptions?: SessionConfigOption[] | null;
}

// ── Session resume ──────────────────────────────────────────

export interface SessionResumeParams {
  sessionId: string;
  cwd: string;
  mcpServers?: unknown[];
}

export interface SessionResumeResult {
  configOptions?: SessionConfigOption[] | null;
}

// ── Session set mode ────────────────────────────────────────

export interface SessionSetModeParams {
  sessionId: string;
  modeId: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface SessionSetModeResult {}

// ── Session set config option ───────────────────────────────

export interface SessionConfigSelectOption {
  value: string;
  name: string;
  description?: string | null;
}

export interface SessionConfigOption {
  id: string;
  name: string;
  type: "select";
  description?: string | null;
  category?: "mode" | "model" | "thought_level" | (string & {}) | null;
  currentValue: string;
  options: SessionConfigSelectOption[];
}

export interface SessionSetConfigOptionParams {
  sessionId: string;
  configId: string;
  value: string;
}

export interface SessionSetConfigOptionResult {
  configOptions: SessionConfigOption[];
}

// ── Authenticate / Logout ───────────────────────────────────

export interface AuthenticateParams {
  methodId: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface AuthenticateResult {}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface LogoutParams {}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface LogoutResult {}

// ── FS methods ──────────────────────────────────────────────

export interface ReadTextFileParams {
  sessionId: string;
  path: string;
  line?: number | null;
  limit?: number | null;
}

export interface ReadTextFileResult {
  content: string;
  uri?: string;
}

export interface WriteTextFileParams {
  sessionId: string;
  path: string;
  content: string;
}

export interface WriteTextFileResult {
  uri?: string;
}

// ── Terminal methods ────────────────────────────────────────

export interface CreateTerminalParams {
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string | null;
  env?: Array<{ name: string; value: string }>;
  outputByteLimit?: number | null;
}

export interface CreateTerminalResult {
  terminalId: string;
}

export interface TerminalOutputParams {
  sessionId: string;
  terminalId: string;
}

export interface TerminalExitStatus {
  exitCode?: number | null;
  signal?: string | null;
}

export interface TerminalOutputResult {
  output: string;
  truncated: boolean;
  exitStatus?: TerminalExitStatus | null;
}

export interface ReleaseTerminalParams {
  sessionId: string;
  terminalId: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface ReleaseTerminalResult {}

export interface KillTerminalParams {
  sessionId: string;
  terminalId: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: explicit protocol contract
export interface KillTerminalResult {}

export interface WaitForTerminalExitParams {
  sessionId: string;
  terminalId: string;
}

export interface WaitForTerminalExitResult {
  exitCode?: number | null;
  signal?: string | null;
}

// ── Permission request ──────────────────────────────────────

export type PermissionOptionKind = "allow_once" | "allow_always" | "reject_once" | "reject_always";

export interface PermissionOption {
  optionId: string;
  name: string;
  kind: PermissionOptionKind;
}

export interface PermissionRequestParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title?: string;
    kind?: ToolKind;
    status?: "pending";
    rawInput?: unknown;
  };
  options: PermissionOption[];
}

export type PermissionOutcome =
  | { outcome: "selected"; optionId: string }
  | { outcome: "cancelled" };

export interface PermissionRequestResult {
  outcome: PermissionOutcome;
}

// ── Error codes ─────────────────────────────────────────────

export const ERR_PARSE = -32700;
export const ERR_INVALID_REQUEST = -32600;
export const ERR_METHOD_NOT_FOUND = -32601;
export const ERR_INVALID_PARAMS = -32602;
export const ERR_INTERNAL = -32603;
export const ERR_AUTH_REQUIRED = -32000;
export const ERR_RESOURCE_NOT_FOUND = -32002;

// ── Helpers ─────────────────────────────────────────────────

/** Minimal resolver for /skillName expansion — pass a SkillStore or any object with `read`. */
export interface SkillResolver {
  read(name: string): { name: string; body: string } | undefined;
}

/** Extract the user prompt text out of ACP content blocks.
 *  If `skillResolver` is provided, a leading `/skillName` prefix is expanded:
 *  the skill body is prepended and trailing text becomes the task argument. */
export function flattenPrompt(blocks: ContentBlock[], skillResolver?: SkillResolver): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "text") parts.push(b.text);
    else if (b.type === "resource" && b.resource.text) parts.push(b.resource.text);
  }
  let text = parts.join("\n\n").trim();

  if (skillResolver && text.startsWith("/")) {
    const match = /^\/(\S+)(?:\s+(.*))?/s.exec(text);
    if (match) {
      const name = match[1]!;
      const args = (match[2] ?? "").trim();
      const skill = skillResolver.read(name);
      if (skill) {
        const expanded = [`[skill: ${skill.name}]`, skill.body];
        if (args) expanded.push(`Task: ${args}`);
        text = expanded.join("\n");
      }
    }
  }

  return text;
}
