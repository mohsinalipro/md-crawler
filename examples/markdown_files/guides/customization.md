# 🔌 Custom Chat LLM Adapter

This guide details the implementation of the OpenAI-compatible custom LangChain Chat Model in `src/core/mlx_chat_llm.ts`.

---

## 🏗️ Subclassing BaseChatModel

`MLXChatLLM` extends `@langchain/core/language_models/chat_models` directly:
```typescript
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export default class MLXChatLLM extends BaseChatModel {
  // Custom implementation
}
```
This direct subclassing enables native LangChain bindings, callback management, templates, and agent orchestration.

---

## ⚡ Real-Time Console Monologue Streaming

In LangGraph structures (e.g. `ReactAgent`), internal execution loops invoke the LLM using synchronous calls:
```javascript
const response = await model.invoke(messages);
```
This blocks standard event-based streaming and causes the console to freeze until the response completes.

We solve this using the custom `streamToConsole: true` flag. In `_streamResponseChunks()`, we hook into the generator stream and print incoming reasoning monologues and message tokens directly to `stdout`:
```typescript
if (this.streamToConsole) {
  process.stdout.write(chalk.gray(chunk.message.content));
}
```

---

## 🔌 Robust Server-Sent Events (SSE) Parsing

To resolve issues where local servers stream fragmented TCP payloads, the model implements a line-buffered parser:
```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n");
buffer = lines.pop() || ""; // Buffer the incomplete line specifier

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const chunk = this._parseSseLine(trimmed);
  if (chunk) yield chunk;
}
```
This guarantees all text and tool calling chunks are processed without loss.
