# ⚙️ Configuration & CLI Flags

Complete overview of option flags and environment configurations.

---

## 🏃 CLI Option Flags

Use options flags when launching the main script:

| Flag | Full Option | Default | Description |
|---|---|---|---|
| `-d` | `--docs-dir` | `./examples/markdown_files` | Target folder containing documentation. |
| `-p` | `--port` | `8080` | Local OpenAI-compatible server port. |
| `-m` | `--model` | `mlx-community/Qwen3.5-9B-4bit` | Model parameter name inside payload completions. |
| `-t` | `--temperature` | `0.2` | Generation temperature (0 = deterministic, 1 = creative). |
| `-h` | `--help` | N/A | Prints option details. |

---

## 🔒 Environment Variables

Fallback environment variables checked by the system:
- `MLX_API_BASE`: Target local model server endpoint (e.g. `http://localhost:8080`).
- `MLX_MODEL_NAME`: Default model name parameter.
