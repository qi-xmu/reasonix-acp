# ACP 通信测试验证

> 通过 NDJSON stdio 发送 JSON-RPC 请求，验证 ACP v1 协议的端到端通信。

## 测试环境

| 项目 | 值 |
|------|-----|
| 命令 | `node dist/cli/index.js acp --yolo --dir /tmp` |
| 传输 | stdio NDJSON（每行一个 JSON 对象） |
| 协议版本 | 1 |

## 测试流程

### 1. 初始化握手

**发送 →**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true}}}}
```

**← 响应**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": false,
      "promptCapabilities": { "image": false, "audio": false, "embeddedContext": true },
      "mcpCapabilities": { "http": false, "sse": false },
      "sessionCapabilities": { "close": {}, "list": {} }
    },
    "agentInfo": { "name": "reasonix", "title": "Reasonix", "version": "0.49.0" },
    "authMethods": []
  }
}
```

**验证项**:

| 字段 | 预期 | 结果 |
|------|------|------|
| `protocolVersion` | 1 | ✅ |
| `promptCapabilities.embeddedContext` | true | ✅ |
| `sessionCapabilities.close` | {} | ✅ |
| `sessionCapabilities.list` | {} | ✅ |
| `agentInfo.name` | "reasonix" | ✅ |
| `authMethods` | [] | ✅ |

---

### 2. 创建会话

**发送 →**
```json
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/tmp"}}
```

**← 响应**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessionId": "sess_202605232013-59lqdu"
  }
}
```

**验证项**:

| 字段 | 预期 | 结果 |
|------|------|------|
| `sessionId` | 格式 `sess_<timestamp>-<random>` | ✅ |

---

### 3. 列出会话

**发送 →**
```json
{"jsonrpc":"2.0","id":3,"method":"session/list","params":{}}
```

**← 响应（无会话时）**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": { "sessions": [] }
}
```

**← 响应（有会话时，session/new 完成后）**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "sessions": [
      { "sessionId": "sess_202605232013-59lqdu", "cwd": "/tmp" }
    ]
  }
}
```

---

### 4. 关闭会话

**发送 →（有效 sessionId）**
```json
{"jsonrpc":"2.0","id":4,"method":"session/close","params":{"sessionId":"sess_202605232013-59lqdu"}}
```

**← 响应**
```json
{ "jsonrpc": "2.0", "id": 4, "result": {} }
```

**发送 →（未知 sessionId — 幂等）**
```json
{"jsonrpc":"2.0","id":5,"method":"session/close","params":{"sessionId":"NOT-FOUND"}}
```

**← 响应**
```json
{ "jsonrpc": "2.0", "id": 5, "result": {} }
```

**发送 →（缺少 sessionId — 错误）**
```json
{"jsonrpc":"2.0","id":6,"method":"session/close","params":{}}
```

**← 响应**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "error": { "code": -32602, "message": "session/close: missing sessionId" }
}
```

---

### 5. 取消会话（通知，无响应）

**发送 →**
```json
{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"sess_202605232013-59lqdu"}}
```

**← 无响应**（通知类型，符合 JSON-RPC 规范）

---

## 错误处理测试

### 未知方法

**发送 →**
```json
{"jsonrpc":"2.0","id":100,"method":"session/load","params":{}}
```

**← 响应**
```json
{
  "jsonrpc": "2.0",
  "id": 100,
  "error": { "code": -32601, "message": "method not found: session/load" }
}
```

### 格式错误

**发送 →**
```
not-json
```

**← 响应**
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": { "code": -32700, "message": "parse error" }
}
```

---

## 完整测试脚本

```bash
cat <<'SCRIPT' | timeout 12 node dist/cli/index.js acp --yolo --dir /tmp 2>/dev/null
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/tmp"}}
{"jsonrpc":"2.0","id":3,"method":"session/list","params":{}}
{"jsonrpc":"2.0","id":4,"method":"session/close","params":{"sessionId":"NOT-FOUND"}}
SCRIPT
```

---

## 错误码参考

| 错误码 | 常量 | 含义 |
|--------|------|------|
| -32700 | `ERR_PARSE` | JSON 解析错误 |
| -32600 | `ERR_INVALID_REQUEST` | 无效请求 |
| -32601 | `ERR_METHOD_NOT_FOUND` | 方法未注册 |
| -32602 | `ERR_INVALID_PARAMS` | 参数无效 |
| -32603 | `ERR_INTERNAL` | 内部错误 |
| -32000 | `ERR_AUTH_REQUIRED` | 需要认证 |
| -32002 | `ERR_RESOURCE_NOT_FOUND` | 资源不存在 |

---

## 测试结论

| 方法 | 实现状态 | 通信验证 |
|------|----------|----------|
| `initialize` | ✅ 真实 | ✅ 通过 |
| `session/new` | ✅ 真实 | ✅ 通过 |
| `session/prompt` | ✅ 真实 | — 需 API key |
| `session/cancel` | ✅ 真实 | ✅ 通过（通知无响应） |
| `session/close` | ✅ 真实 | ✅ 通过 |
| `session/list` | ✅ 真实 | ✅ 通过 |
| `session/load` | ⚠️ 桩 (not-supported) | ✅ 返回 -32601 |
| `session/resume` | ⚠️ 桩 (not-supported) | — |
| `authenticate` | ⚠️ 桩 (返回 {}) | — |
| `logout` | ⚠️ 桩 (返回 {}) | — |
| `session/set_mode` | ⚠️ 桩 (返回 {}) | — |
| `session/set_config_option` | ⚠️ 桩 (返回 {}) | — |
| `fs/read_text_file` | ⚠️ 桩 (not-supported) | — |
| `fs/write_text_file` | ⚠️ 桩 (not-supported) | — |
| `terminal/*` | ⚠️ 桩 (not-supported) | — |
