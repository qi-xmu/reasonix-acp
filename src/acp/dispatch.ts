/** Map kernel events (model.delta / tool.preparing|intent|result) to ACP session/update notifications. */

import { toolKindFor } from "@reasonix/core-utils";
import { SLASH_COMMANDS } from "../cli/ui/slash/commands.js";
import type { Event as KernelEvent } from "../core/events.js";
import type { SessionUpdateParams } from "./protocol.js";
import type { AcpServer } from "./server.js";
export { toolKindFor } from "@reasonix/core-utils";
export type { AcpToolKind } from "@reasonix/core-utils";

/** Send `available_commands_update` notification to advertise slash commands and skills.
 *  Skills appear as first-class commands (e.g. `/pdf`) taking precedence over built-in
 *  slash commands with the same name. */
export function sendAvailableCommands(
  server: AcpServer,
  sessionId: string,
  skills: ReadonlyArray<{ name: string; description: string }> = [],
): void {
  const skillNames = new Set(skills.map((s) => s.name));
  const skillCommands = skills.map((s) => ({
    name: s.name,
    description: s.description,
    input: { hint: "[args]" } as const,
  }));
  const slashCommands = SLASH_COMMANDS.filter((c) => !skillNames.has(c.cmd)).map((c) => ({
    name: c.cmd,
    description: c.summary,
    ...(c.argsHint ? { input: { hint: c.argsHint } } : {}),
  }));

  server.sendNotification("session/update", {
    sessionId,
    update: {
      sessionUpdate: "available_commands_update",
      availableCommands: [...skillCommands, ...slashCommands],
    },
  } satisfies SessionUpdateParams);
}

function tryParseJson(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Stateless mapping from one kernel event to (zero or more) ACP session/update notifications. */
export function dispatchKernelEvent(server: AcpServer, sessionId: string, ev: KernelEvent): void {
  switch (ev.type) {
    case "model.delta": {
      if (!ev.text) return;
      const variant = ev.channel === "reasoning" ? "agent_thought_chunk" : "agent_message_chunk";
      emit(server, {
        sessionId,
        update: { sessionUpdate: variant, content: { type: "text", text: ev.text } },
      });
      return;
    }
    case "tool.preparing": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId: ev.callId,
          title: ev.name,
          kind: toolKindFor(ev.name),
          status: "pending",
        },
      });
      return;
    }
    case "tool.intent": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: ev.callId,
          status: "in_progress",
        },
      });
      const rawInput = tryParseJson(ev.args);
      if (rawInput !== undefined) {
        emit(server, {
          sessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: ev.callId,
            title: ev.name,
            kind: toolKindFor(ev.name),
            status: "in_progress",
            rawInput,
          },
        });
      }
      return;
    }
    case "tool.result": {
      emit(server, {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: ev.callId,
          status: ev.ok ? "completed" : "failed",
          content: [
            {
              type: "content",
              content: { type: "text", text: clip(ev.output) },
            },
          ],
        },
      });
      return;
    }
    default:
      return;
  }
}

const MAX_RESULT_CHARS = 8000;
function clip(text: string): string {
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}\n…(${text.length - MAX_RESULT_CHARS} more chars truncated)`;
}

function emit(server: AcpServer, params: SessionUpdateParams): void {
  server.sendNotification("session/update", params);
}
