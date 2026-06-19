# Lessons Learned: md-crawler LLM Integration & Interactive CLI

This document details the architectural decisions, debugging journeys, and key lessons compiled throughout the development of **md-crawler**—a token-efficient local documentation agent shell.

---

## 📂 Project Architecture

The md-crawler PoC is organized as follows:
* **`examples/markdown_files/`**: Hierarchical documentation files (`index.md`, `getting-started.md`, `guides/`, `reference/`) cross-linked via relative markdown links. Includes the auto-generated `.md-crawler-sitemap.json` sitemap.
* **`src/core/mlx_chat_llm.js`**: Standalone OpenAI-compatible custom LangChain Chat Model adapter linking local servers with SSE buffering and direct token streaming.
* **[src/core/tools.js](file:///Users/mohsinali/work/quick-repos/langchain-test/src/core/tools.js)**: Tool definitions factory and the automated sitemap compiler that parses markdown headers to build light file summaries.
* **[src/cli.js](file:///Users/mohsinali/work/quick-repos/langchain-test/src/cli.js)**: The main CLI executable runner, implementing options parsing, server diagnostics checks, and the readline interactive loop.
* **[test/sse-parser.test.js](file:///Users/mohsinali/work/quick-repos/langchain-test/test/sse-parser.test.js)**: Standalone assertion script validating parser behavior on varied payloads.
* **[package.json](file:///Users/mohsinali/work/quick-repos/langchain-test/package.json)**: Node dependencies (`chalk`, `marked`, `marked-terminal`) and scripts for executing tests and running the CLI.

---

## ⚡ 1. LangGraph Console Streaming Challenge

### The Problem:
When calling `agent.streamEvents(...)` on a compiled LangGraph agent, the model's text response was *not* streaming token-by-token in real-time.
* **Analysis**: LangGraph's internal `AgentNode` executes the LLM using a synchronous `.invoke()` call:
  ```javascript
  const response = await modelWithTools.invoke(messages, ...);
  ```
  Since the graph calls `.invoke()` rather than `.stream()`, LangChain does not emit `on_chat_model_stream` events, causing the terminal to hang until the LLM finishes generating the entire response.

### The Solution:
We introduced a custom parameter `streamToConsole: true` in our custom `MLXChatLLM` class. Inside the generator method `_streamResponseChunks()` (which is called by `.stream()` or by our `.invoke()` under the hood), we write incoming text/reasoning tokens directly to `process.stdout` in real-time. This provides instant console feedback without altering the agent's graph design.

---

## 🔌 2. Robust Server-Sent Events (SSE) Parsing

Local models/servers sometimes split chunk data across packets or send fragmented TCP payloads.
* **Legacy Bug**: Splitting raw buffers by the `"data: "` prefix and processing indices up to `chunks.length - 1` skipped the final token or tool call chunks when the stream terminated abruptly.
* **Robust SSE Parser**: We replaced this with a standard line-buffer parser:
  ```javascript
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Save incomplete line to buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const chunk = this._parseSseLine(trimmed);
    if (chunk) yield chunk;
  }
  ```
  This ensures 100% of the payload data is processed, handling custom `"reasoning"` delta fields (returned by Qwen models) and tool calls reliably.

---

## 🧠 3. Interactive CLI Loop & Context Memory

To create a CLI chat tool resembling `claude code`, we implemented:
* **Readline Loop**: Leveraged Node's native `readline/promises` to capture user queries iteratively.
* **Slash Commands**:
  * `/clear`: Resets the context memory array (`messages = []`).
  * `/exit`: Exits the read loop cleanly.
* **Conversation State & Memory**:
  We maintained a running array of messages (`messages = []`). After each turn, the user's new question and the agent's completed completion (retrieved from `on_chat_model_end` event) are pushed to the list. 
  By passing the cumulative `messages` array in `agent.streamEvents({ messages })`, the model retains full context of previous turns.

---

## 🎨 4. Rich Terminal Aesthetics & Formatting

To deliver a premium terminal experience, we installed `chalk`, `marked`, and `marked-terminal`:
* **Aesthetic Formatting**:
  * **Tool Calls**: Color-coded in bold cyan (`🛠️  [Calling Tool: name]`) with tool parameters in dim gray.
  * **Tool Completions**: Marked in bold green (`🔌 [Tool Finished]`) with summaries in gray.
  * **Reasoning Stream**: Printed in real-time in dim gray (`chalk.gray`) to look like the agent's internal monologue.
* **Final Markdown Output**:
  At the end of the streaming loop, if no tool calls are pending, the model prints a bold magenta header (`🎨 [Formatted Markdown Response]:`) and uses `marked.parse()` to render the final response as fully styled terminal output (headers, lists, boxed unicode tables, and highlighted code blocks).

---

## 🧠 5. LangChain Data Structures: Critical Types

### ChatResult (for `_generate`, non-streaming)
```javascript
{
  generations: [
    {
      text: string,
      message: AIMessage  // NOT AIMessageChunk
    }
  ],
  llmOutput?: Record<string, any>
}
```
* Flat generations array (not nested).
* message must be `AIMessage` (for non-streaming).

### ChatGenerationChunk (for `_streamResponseChunks`, streaming)
```javascript
new ChatGenerationChunk({
  text: string,
  message: AIMessageChunk
})
```
* Both `text` and `message` required.
* LangChain validates `.message.id` during streaming iteration; must use `AIMessageChunk`.

---

## 🛡️ 6. Enforcing Agent Constraints & Security

* **Sitemap Constraint Prompt**:
  We programmatically injected strict behavioral rules into the agent's `systemPrompt` constructor field:
  ```
  CRITICAL RULE: If the user query is related to "markdown", "docs", "documentation", or "files", you MUST ALWAYS call the 'read_documentation_sitemap' tool first to read the documentation sitemap...
  ```
* **Directory Traversal Protection**:
  Inside [src/core/tools.js](file:///Users/mohsinali/work/quick-repos/langchain-test/src/core/tools.js), we resolved paths using `path.resolve` and validated prefix containment:
  ```javascript
  const safePath = path.normalize(input.filePath).replace(/^(\.\.(\/|\\))+/, '');
  const fullPath = path.resolve(resolvedDocsDir, safePath);
  if (!fullPath.startsWith(resolvedDocsDir)) {
    return `Error: Access denied. Path must be inside the documentation directory.`;
  }
  ```

---

## 🏆 Validation & Quality Assurance
Run unit tests to verify the custom SSE parser:
```bash
pnpm test
```
To run the interactive md-crawler documentation chat shell:
```bash
pnpm md-crawler
```
