# 📚 md-crawler Architecture Guides

Detailed deep-dives outlining the custom LLM integration and the token-efficient traversal mechanisms inside `md-crawler`.

---

## Technical Guides

### 1. [Custom Chat LLM Adapter](customization.md)
An architectural deep-dive of the custom `MLXChatLLM` class. This guide covers extending `BaseChatModel`, custom stream generation, and direct console monologue streaming.

### 2. [Sitemap Indexing & Token Efficiency](advanced-usage.md)
An overview of the index compiler, including directory recursion, directory traversal security checks, and sitemap system constraints.
