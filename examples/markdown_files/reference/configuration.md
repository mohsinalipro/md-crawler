# Configuration Schema Reference

This document outlines environment variables and file configuration formats for configuring global settings in the Antigravity SDK.

---

## 🌍 Environment Variables

Configure connection endpoints, API keys, and log settings using environment variables.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `ANTIGRAVITY_API_KEY` | Core API key for authentication. | `ag_live_8953...` |
| `ANTIGRAVITY_LLM_PROVIDER` | Default provider for language models. | `openai`, `gemini`, `anthropic` |
| `ANTIGRAVITY_LOG_LEVEL` | Verbosity of console logs. | `debug`, `info`, `warn`, `error` |
| `ANTIGRAVITY_TIMEOUT_MS` | Maximum duration for tool execution before timing out. | `30000` |

---

## 📄 File-Based Configuration: `antigravity.config.json`

You can place an `antigravity.config.json` file in the root of your project directory to control retry budgets and sandboxing configurations.

### Configuration Properties

```json
{
  "version": "1.0.0",
  "orchestration": {
    "maxLoops": 15,
    "fallbackOnModelError": true
  },
  "sandbox": {
    "allowedWritePaths": ["./scratch", "./tmp"],
    "allowedCommandPrefixes": ["git status", "git diff", "npm test"]
  },
  "retries": {
    "maxAttempts": 3,
    "initialDelayMs": 1000,
    "backoffFactor": 2
  }
}
```

Refer to the [API Reference](./api-reference.md) for how the initialization of classes integrates these configurations.

---

## 🔗 Related Resources
* View detailed specifications in [API Reference](./api-reference.md).
* Go back to [Getting Started](../getting-started.md).
* Return to [Home](../index.md).
