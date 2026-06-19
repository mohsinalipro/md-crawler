# 🔌 API Reference

Detailed specifications for classes, factories, and utility methods in `md-crawler`.

---

## 🏗️ Chat Model: `MLXChatLLM`
Subclasses LangChain's `BaseChatModel`.

### API Specifications
- `constructor(fields: MLXChatLLMFields)`: Configures target server, model endpoint, temperature, and console streaming.
- `_generate(messages, options, runManager)`: Natively compiles chat generations.
- `_streamResponseChunks(messages, options, runManager)`: Streams delta tokens and outputs reasoning monologues to stdout.
- `bindTools(tools, options)`: Maps tools to OpenAI schemas.

---

## 🛠️ Tools Factory: `createTools`
Constructs the tool array for agent execution.

### Tool Catalog
1. **`list_markdown_files`**: Lists relative paths of markdown files recursively.
2. **`read_markdown_file`**: Reads file content. Validates boundary safety.
3. **`read_documentation_sitemap`**: Parses the sitemap dynamically.

---

## 🗃️ Indexer: `getOrCompileSitemap`
Recursively indexes markdown directories and generates `.md-crawler-sitemap.json`.

---

## 🎨 Log Utilities: `formatToolInput`
Pretty-prints tool parameters on standard output.
