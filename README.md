# 🚀 md-crawler

**md-crawler** is a token-efficient local markdown documentation traversing agent shell. Built on top of **LangChain**, it allows you to chat with your local documentation files using local LLMs (such as [MLX](https://github.com/ml-explore/mlx-lm) or llama.cpp) by only loading and reading the minimum required files to answer queries, saving massive context window tokens.

---

## 📂 Project Architecture

```
├── examples/
│   ├── markdown_files/      # Sample documentation hierarchy
│   │   ├── index.md         # Documentation root index
│   │   ├── getting-started.md
│   │   ├── guides/
│   │   └── reference/
│   ├── agent-demo.ts        # Agent execution example
│   └── non-streaming.ts     # Direct non-streaming example
├── src/
│   ├── index.ts             # CLI binary entry point
│   ├── cli.ts               # CLI options parsing, health checks & interactive loop
│   └── core/
│       ├── mlx_chat_llm.ts  # Custom LangChain Chat Model with console streaming & robust SSE
│       └── tools.ts         # File system traversal, path validation & sitemap compiler
├── test/
│   └── sse-parser.test.ts   # Unit tests for the SSE line parser
├── docs/
│   └── LESSONS_LEARNED.md   # Detailed logs, architecture takeaways & design lessons
├── package.json             # Scripts and dependencies
├── LICENSE                  # ISC License
└── README.md                # This showcase documentation
```

---

## ✨ Features

- **Token-Efficient Traversing**: Automatically compiles a `.md-crawler-sitemap.json` summarizing files and headers. The agent reads this sitemap first to pinpoint exactly which files are relevant before loading full text.
- **Custom [MLX](https://github.com/ml-explore/mlx-lm) Local LLM Integration**: Standalone custom OpenAI-compatible LangChain Chat Model adapter tailored for local servers (such as [MLX](https://github.com/ml-explore/mlx-lm), llama.cpp, Ollama).
- **Direct Monologue & Output Streaming**: Bypasses the synchronous LangGraph ReactAgent `.invoke()` limitation by writing reasoning/output tokens directly to `process.stdout` in real-time.
- **Robust SSE Parser**: Implements standard line-buffering to prevent truncated TCP packets from skipping final tokens or tool calls.
- **Rich Terminal Aesthetics**: Styled console outputs utilizing `chalk`, `marked`, and `marked-terminal` for fully rendered markdown headers, tables, code blocks, and color-coded tool executions.
- **Directory Traversal Protection**: Secure path checking prevents the agent from resolving files outside the designated documentation directory.
- **Configurable Output Formats**: Supports `text`, `json`, `jsonl`, and `structured` output modes — making it easy to pipe responses into other developer tools.
- **Streaming Toggle**: Enable or disable real-time token streaming at startup via `--stream true|false`.

---

## 🔌 Core Highlight: Standalone MLX LLM Adapter (`src/core/mlx_chat_llm.ts`)

The heart of the `md-crawler` is its custom, standalone chat model adapter located in [src/core/mlx_chat_llm.ts](file:///Users/mohsinali/work/quick-repos/langchain-test/src/core/mlx_chat_llm.ts). Rather than wrapping external clients, it inherits directly from LangChain's `BaseChatModel`.

### Technical Key Strengths:
1. **Direct Inherited Integration**: Subclasses `BaseChatModel` from `@langchain/core/language_models/chat_models`, making it 100% compatible with LangChain's native pipelines, system prompts, template formats, and callbacks.
2. **On-Demand Console Streaming (`streamToConsole: true`)**: Bypasses the limitation where LangGraph's internal `AgentNode` calls the LLM using synchronous `.invoke()`. It monitors token chunks inside its generator method (`_streamResponseChunks()`) and outputs reasoning and response tokens dynamically to standard output.
3. **Resilient Chunk Buffer Parser**: Standard local model servers (like [`mlx_lm.server`](https://github.com/ml-explore/mlx-lm)) often yield fragmented Server-Sent Event (SSE) packages. The class uses a strict line-buffered accumulator to ensure that no tokens, tool-calling JSON chunks, or final completions are omitted.
4. **Unified Tool Mapping**: Implements `.bindTools()` using LangChain's `convertToOpenAITool` schema conversion, letting you bind standard javascript tool definitions seamlessly.
5. **Rich Terminal Formatting**: Features a built-in terminal markdown compiler configured via `marked` and `marked-terminal`, translating raw streamed text into fully formatted headers, tables, and colored boxes natively in the console.

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later
- **pnpm** (or npm/yarn)
- **[MLX](https://github.com/ml-explore/mlx-lm) Local LLM Server Setup (Apple Silicon)**:
  Install the [mlx-lm](https://github.com/ml-explore/mlx-lm) library:
  ```bash
  pip install mlx-lm
  ```
  Start the local server hosting your model on port `8080`:
  ```bash
  mlx_lm.server --model mlx-community/Qwen3.5-9B-4bit --port 8080
  ```

### 2. Installation
Clone the repository and install the dependencies:
```bash
pnpm install
```

### 3. Running the Tests
Verify the robustness of the SSE chunk parser by running:
```bash
pnpm test
```

### 4. Launching md-crawler CLI
Run the interactive documentation chat shell:
```bash
pnpm md-crawler
```

You can customize the parameters via CLI flags:
```bash
pnpm md-crawler --docs-dir ./examples/markdown_files --port 8080 --model mlx-community/Qwen3.5-9B-4bit --temperature 0.2 --output-format json --stream false
```

### CLI Options

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--docs-dir` | `-d` | Path to markdown docs folder | `./examples/markdown_files` |
| `--port` | `-p` | Port of local MLX/OpenAI server | `8080` |
| `--model` | `-m` | Model name | `mlx-community/Qwen3.5-9B-4bit` |
| `--temperature` | `-t` | Generation temperature | `0.2` |
| `--output-format` | `-o` | Output format (`text`, `json`, `jsonl`, `structured`) | `text` |
| `--stream` | `-s` | Enable/disable streaming (`true`, `false`) | `true` |

---

## 📦 Structured Output Schema

When using `--output-format json`, `jsonl`, or `structured`, each response is emitted as a JSON object with the following schema:

```typescript
interface StructuredResponse {
  query: string;                    // The user's original query
  file_refs: string[];              // Array of file paths involved in the response
  content: string;                  // The AI's response to the query
  reasoning?: string;               // The agent's thought process (structured mode only)
  tool_calls?: Array<{              // Tool calls made during the response
    name: string;
    args: Record<string, unknown>;
  }>;
  timestamp: string;                // ISO timestamp of the response
}
```

Example usage with `jq`:
```bash
pnpm md-crawler --output-format json --stream false | jq '.file_refs'
```

## 💬 Interactive CLI Commands

Once inside the interactive CLI, you can use these custom commands:
* `/clear` - Resets the conversation context memory.
* `/exit` - Gracefully terminates the session.

---

## 💡 How It Works

1. **Indexing**: When started, md-crawler scans the designated `--docs-dir` recursively, parses titles and first paragraphs of markdown files, and compiles a light `.md-crawler-sitemap.json` sitemap.
2. **LLM System Prompt**: A strict agent constraint forces the agent to read the sitemap *first* whenever the query relates to documentation or markdown files.
3. **Execution**: The agent identifies the relevant file(s) from the sitemap, fetches only the specific files using `read_markdown_file`, compiles the answer, and streams the styled results to the terminal.

---

## 📄 License
This project is licensed under the ISC License.
