# 🚀 md-crawler Documentation

Welcome to the documentation for **md-crawler**—a token-efficient local markdown documentation traversing agent shell. This folder houses the reference manuals and architecture guides for the codebase.

---

## 🗺️ Documentation Directory

We have organized the documentation into three key sections:

1. **[Getting Started](getting-started.md)**: An architectural introduction to running `md-crawler` and seeing the agent selectively crawl markdown structures.
2. **Guides**:
   - **[Custom Chat LLM Adapter](guides/customization.md)**: Details on the custom `MLXChatLLM` class and its implementation of BaseChatModel.
   - **[Sitemap Indexing & Token Efficiency](guides/advanced-usage.md)**: Under-the-hood details of the sitemap indexing mechanism that prevents blind traversals.
3. **Reference**:
   - **[API Reference](reference/api-reference.md)**: Standard reference of the primary classes, factory functions, and tool definitions.
   - **[Configuration & Flags](reference/configuration.md)**: Complete option flags and environment variable listings.

---

## 💡 Key Design Decisions
- **Selective Crawling**: Utilizes a dynamic sitemap mapping index to pinpoint correct files, avoiding full folder context dumps.
- **Console Monologue Streaming**: Directly writes reasoning/ monologues to the terminal stdout to bypass sync LangGraph invocation limitations.
- **Robust SSE parsing**: Buffers local server SSE responses to prevent truncated payloads from clipping tool calls or completions.
