# ⚡ Sitemap Indexing & Token Efficiency

This guide details how `md-crawler` indexes and traverses files with high token efficiency.

---

## 🛠️ The Sitemap Compiler

Located in `src/core/tools.ts`, `compileSitemap()` runs a recursive filesystem walk:
1. It reads every `.md` file in the configured directory.
2. It parses headers (e.g. lines starting with `#`) to extract page titles.
3. It takes the first non-empty paragraph (capped at 150 characters) to use as a summary.
4. It saves a lightweight sitemap map in `.md-crawler-sitemap.json`.

---

## 🛡️ Directory Traversal Security

To prevent the LLM agent from traversing outside the boundaries of the designated target folder, a path boundary validation check is run:
```typescript
const safePath = path.normalize(input.filePath).replace(/^(\.\.(\/|\\))+/, '');
const fullPath = path.resolve(resolvedDocsDir, safePath);

if (!fullPath.startsWith(resolvedDocsDir)) {
  return `Error: Access denied. Path must be inside the documentation directory.`;
}
```

---

## 🧠 Sitemap Constraint Prompt

The agent is forced to use the sitemap index dynamically by applying a strict constraint rule in `src/cli.ts`'s `systemPrompt`:
```
CRITICAL RULE: If the user query is related to "markdown", "docs", "documentation", or "files", you MUST ALWAYS call the 'read_documentation_sitemap' tool first to read the documentation sitemap...
```
This constraint ensures the agent scans the directory structure in one light sitemap call before executing specific file reads.
