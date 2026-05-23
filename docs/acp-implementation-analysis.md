# ACP 协议实现分析

> 基于 `/Users/qi/Resources/ACP/` 中的 ACP v1 规范，分析 `src/acp/` 下的当前实现。

## 1. 规范概览

ACP (Agent Client Protocol) v1 是基于 **JSON-RPC 2.0** 通过 **NDJSON**（每行一个 JSON 对象）进行通信的代理-客户端协议。

### 方法清单

| 方向 | 方法 | 数量 |
|------|------|------|
| Client → Agent（Agent 方法） | `initialize`, `authenticate`, `logout`, `session/new`, `session/load`, `session/resume`, `session/list`, `session/close`, `session/prompt`, `session/cancel`, `session/set_mode`, `session/set_config_option` | 12 |
| Agent → Client（Client 方法） | `session/update`, `session/request_permission`, `fs/read_text_file`, `fs/write_text_file`, `terminal/create`, `terminal/output`, `terminal/wait_for_exit`, `terminal/kill`, `terminal/release` | 9 |

---

## 2. 整体完成度

```
                      Agent 方法     Client 方法
实现:    ████░░░░░░ 42% (5/12)     ██░░░░░░░░ 22% (2/9)
测试:    ████████░░ 高覆盖           ██████░░░░ 中覆盖
```

**结论**: 当前是一个聚焦于 "prompt 处理循环" 的最小可行代理，而非完整的 ACP 协议实现。

---

## 3. 逐项实现状态

### 3.1 传输层 & 基础框架 ✅

| 特性 | 状态 | 文件 |
|------|------|------|
| NDJSON 帧（每行一个 JSON 对象） | ✅ | `server.ts:84` |
| JSON-RPC 2.0 请求/响应/通知路由 | ✅ | `server.ts:91-142` |
| 出站请求（agent→client）及 ID 匹配 | ✅ | `server.ts:59-68` |
| 标准 JSON-RPC 错误码 | ✅ | `protocol.ts:153-157` |

### 3.2 Agent 方法（client → agent）

| 方法 | 状态 | 位置 | 备注 |
|------|------|------|------|
| `initialize` | ✅ | `acp.ts:239-252` | 缺少 `sessionCapabilities` 字段 |
| `authenticate` | ❌ | — | `authMethods` 恒为空数组，无认证支持 |
| `logout` | ❌ | — | |
| `session/new` | ✅ | `acp.ts:255-266` | 支持 cwd + MCP server 注入 |
| `session/load` | ❌ | — | `loadSession: false` |
| `session/resume` | ❌ | — | |
| `session/list` | ❌ | — | |
| `session/close` | ❌ | — | |
| `session/prompt` | ✅ | `acp.ts:268-322` | 核心功能，驱动推理循环 |
| `session/cancel` | ✅ | `acp.ts:325-328` | AbortController 实现 |
| `session/set_mode` | ❌ | — | |
| `session/set_config_option` | ❌ | — | |

### 3.3 Client 方法（agent → client）

| 方法 | 状态 | 位置 | 备注 |
|------|------|------|------|
| `session/update` | ✅ | `dispatch.ts` | 核心通知，支持 5 种 update 类型 |
| `session/request_permission` | ✅ | `gates.ts` | 桥接内核 PauseGate |
| `fs/read_text_file` | ❌ | — | Agent 不向 client 请求读文件 |
| `fs/write_text_file` | ❌ | — | Agent 不向 client 请求写文件 |
| `terminal/create` | ❌ | — | 终端托管完全未实现 |
| `terminal/output` | ❌ | — | |
| `terminal/wait_for_exit` | ❌ | — | |
| `terminal/kill` | ❌ | — | |
| `terminal/release` | ❌ | — | |

### 3.4 SessionUpdate 变体

| 变体 | 状态 | 备注 |
|------|------|------|
| `agent_message_chunk` | ✅ | 模型输出文本流 |
| `agent_thought_chunk` | ✅ | 推理过程文本流 |
| `tool_call` | ✅ | 工具调用创建/更新 |
| `tool_call_update` | ✅ | 工具调用状态变更 |
| `plan` | ✅ | 执行计划（Eventizer 产生） |
| `user_message_chunk` | ❌ | 用户消息回显 |
| `available_commands_update` | ❌ | 可用命令变更 |
| `current_mode_update` | ❌ | 模式切换通知 |
| `config_option_update` | ❌ | 配置选项变更 |
| `session_info_update` | ❌ | 会话元数据更新 |

---

## 4. 类型定义差异

### 4.1 StopReason

| | 当前实现 (`protocol.ts:78`) | ACP 规范 |
|------|------|------|
| ✅ | `end_turn` | `end_turn` |
| ✅ | `cancelled` | `cancelled` |
| ⚠️ | `tool_use_complete` | — |
| ⚠️ | `error` | — |
| ❌ | — | `max_tokens` |
| ❌ | — | `max_turn_requests` |
| ❌ | — | `refusal` |

**问题**: `tool_use_complete` 和 `error` 不在规范中；规范中的 `max_tokens`、`max_turn_requests`、`refusal` 未实现。

### 4.2 ContentBlock

当前定义 (`protocol.ts:67-71`):
```typescript
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri, mimeType?, text? } }
  | { type: "image"; mimeType: string; data: string }
  | { type: "audio"; mimeType: string; data: string }
```

**问题**: 规范区分了两种资源引用：
- `resource_link` — 仅含 `uri` + `name`，指向资源位置
- `resource` — 嵌入式上下文，含完整内容

当前实现合并为单一的 `resource` 类型，缺失 `resource_link`。

### 4.3 ToolKind

| 当前支持 (via `@reasonix/core-utils`) | 规范额外定义 |
|------|------|
| `read`, `edit`, `search`, `execute`, `other` | `delete`, `move`, `think`, `fetch`, `switch_mode` |

### 4.4 ToolCall 缺少字段

规范 ToolCall 对象包含以下字段，当前未填充：

| 字段 | 规范定义 | 实现状态 |
|------|------|------|
| `locations` | `ToolCallLocation[]` — 文件位置跟踪 | ❌ 未发送 |
| `rawOutput` | 工具原始输出 | ❌ 未发送 |
| `content` | `ToolCallContent[]`（支持 content/diff/terminal） | ❌ 仅在 `tool_call_update` 中发送 |

### 4.5 InitializeResult 不完整

当前实现 (`acp.ts:243-252`):
```typescript
agentCapabilities: {
  loadSession: false,
  promptCapabilities: { image: false, audio: false, embeddedContext: true },
  mcpCapabilities: { http: false, sse: false },
  // ❌ 缺少 sessionCapabilities
}
```

规范要求:
```json
"sessionCapabilities": {
  "close": null,    // null = 不支持
  "list": null,
  "resume": null
}
```

### 4.6 完全缺失的类型

| 类型 | 用途 |
|------|------|
| `Annotations` | 内容块注解（优先级、受众、修改时间） |
| `ToolCallLocation` | 文件位置跟踪（行号+路径） |
| `SessionMode` / `SessionModeState` / `SessionModeId` | 会话模式管理 |
| `SessionConfigOption` / `SessionConfigId` / `SessionConfigValueId` | 会话配置选项 |
| `SessionInfo` | `session/list` 响应 |
| `Diff` | 工具调用中的文件差异展示 |
| `AvailableCommand` / `AvailableCommandsUpdate` | 可用命令定义 |
| `Terminal` | 终端嵌入展示 |

### 4.7 可扩展性

规范所有消息都预留了 `_meta` 字段以实现扩展，当前实现完全未使用。

### 4.8 错误码

| 错误码 | 规范 | 实现 |
|------|------|------|
| `-32700` Parse error | ✅ | ✅ `ERR_PARSE` |
| `-32600` Invalid request | ✅ | ✅ `ERR_INVALID_REQUEST` |
| `-32601` Method not found | ✅ | ✅ `ERR_METHOD_NOT_FOUND` |
| `-32602` Invalid params | ✅ | ✅ `ERR_INVALID_PARAMS` |
| `-32603` Internal error | ✅ | ✅ `ERR_INTERNAL` |
| `-32000` Auth required | ✅ | ❌ 未定义 |
| `-32002` Resource not found | ✅ | ❌ 未定义 |

---

## 5. 架构评价

### 优点

- **传输层实现干净**: `server.ts` 仅 143 行，职责清晰，完全可测试
- **事件映射解耦**: `dispatch.ts` 无状态纯函数，内核事件→ACP 通知一对多映射
- **权限桥接合理**: `gates.ts` 复用了 `@reasonix/core-utils` 的审批语义，将 PauseGate 映射为 `session/request_permission`
- **测试覆盖充分**: `acp.test.ts` 500+ 行，覆盖 framing、dispatch、gates、handshake
- **MCP 集成**: session/new 时动态加载 MCP servers 并桥接工具，体现了 ACP 的设计意图

### 核心差距

1. **仅实现了 prompt 循环的最小子集**: 42% Agent 方法 + 22% Client 方法
2. **完全缺失终端托管**: 这是 ACP 最有特色的能力之一，允许 agent 在 client 端创建终端并获取输出
3. **Agent 不做 client 请求**: 所有文件/命令操作都在本地执行，不符合 ACP 的沙箱模型
4. **会话管理不完整**: 无 load/list/resume/close，会话仅存在于内存中
5. **类型与规范有出入**: StopReason 多两个、缺三个；ContentBlock 缺少 resource_link；ToolKind 缺五种
6. **无可扩展性**: 所有 `_meta` 字段均未使用

---

## 6. 文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/acp/protocol.ts` | 167 | 协议类型定义、常量、辅助函数 |
| `src/acp/server.ts` | 143 | NDJSON JSON-RPC 2.0 传输层 |
| `src/acp/dispatch.ts` | 100 | 内核事件 → ACP 通知映射 |
| `src/acp/gates.ts` | 93 | PauseGate → ACP 权限请求桥接 |
| `src/cli/commands/acp.ts` | 343 | CLI 入口，组装完整代理 |
| `tests/acp.test.ts` | 536 | 核心 ACP 测试 |
| `tests/acp-mcp.test.ts` | 141 | MCP 加载器测试 |

---

## 7. 改进建议优先级

| 优先级 | 改进项 | 原因 |
|------|------|------|
| 🔴 高 | 修复 `StopReason` 定义，对齐规范 | 类型不匹配会导致客户端解析失败 |
| 🔴 高 | 添加 `resource_link` ContentBlock 变体 | 客户端依赖此类型区分引用和嵌入 |
| 🔴 高 | 补全 `InitializeResult.sessionCapabilities` | 初始化握手不完整 |
| 🟡 中 | 实现 `session/close` | 资源清理基本需求 |
| 🟡 中 | 补充 `ToolKind`（delete/move/think/fetch） | 丰富客户端 UI 展示 |
| 🟡 中 | 添加 `ToolCallLocation` 支持 | 客户端"跟随"功能的基础 |
| 🟢 低 | 实现终端托管 (`terminal/*`) | 高价值但量大 |
| 🟢 低 | 实现 `fs/read_text_file` 和 `fs/write_text_file` | 沙箱模型的关键能力 |
| 🟢 低 | 实现 `session/list` / `session/load` / `session/resume` | 会话持久化的基础 |
