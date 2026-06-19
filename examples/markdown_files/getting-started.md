# 🚀 Getting Started

This guide covers the core execution flow of `md-crawler`, how it runs, and how the interactive loop functions.

---

## 🧐 Problem Overview

In standard documentation agents, the typical solution is to read the entire workspace directory and pass all text files into the LLM context window. This approach suffers from:
1. **High Token Costs**: Reading all files on every query consumes large volumes of context tokens.
2. **Context Window Limitations**: Small local LLMs can run out of context capacity or lose accuracy when overloaded.
3. **Inference Latency**: Processing massive context inputs increases completion times.

---

## ⚡ The md-crawler Architecture

`md-crawler` uses a **Query-Driven Crawling** pattern to solve this:
1. **Dynamic Sitemap Mapping**: On initialization, the system indexes the target folder to create a lightweight JSON sitemap mapping filename headers and descriptions.
2. **Targeted Reading**: When a query is received, the agent is constrained to read the sitemap first. It identifies the target file path and executes a tool call to read *only* that file, ignoring the rest of the filesystem.

---

## 🏃 Quick Start

To run the agent:
1. Start your local OpenAI-compatible MLX server on port `8080`:
   ```bash
   mlx_lm.server --model mlx-community/Qwen3.5-9B-4bit --port 8080
   ```
2. Launch the interactive CLI:
   ```bash
   pnpm md-crawler
   ```
3. Issue a test query:
   > "Show the guide for custom chat LLM configuration."

The terminal output will display the agent calling `read_documentation_sitemap` first, followed by a selective read on the target customization file.
