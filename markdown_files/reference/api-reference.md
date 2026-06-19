# API Reference Manual

This document details the core classes, methods, parameters, and types available in the Antigravity SDK.

---

## 🏗️ Class: `Agent`

Main class used to initialize and run an autonomous execution thread.

### Constructor Options (`AgentOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | `"Agent"` | The identifier of the agent. Used in logs and orchestration. |
| `model` | `string` | `undefined` | The name of the LLM model to target (e.g., `gemini-2.5-flash`). |
| `systemPrompt` | `string` | `""` | Base system instructions defining persona/limits. |
| `tools` | `Tool[]` | `[]` | List of callable tools available to the agent. |

### Methods

#### `run(prompt: string): Promise<AgentResponse>`
Executes the agent loop with a user prompt.

* **Parameters**:
  * `prompt`: The user's input/request.
* **Returns**:
  * `Promise<AgentResponse>`: Object containing `text` (response content) and `toolCalls` (any tools invoked).

---

## 🛠️ Class: `Tool`

Class to wrap functions or APIs to make them discoverable and callable by the Agent.

### Constructor Options (`ToolOptions`)

| Option | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Unique name of the tool (must not contain spaces). |
| `description` | `string` | Clear description explaining *when* the agent should invoke it. |
| `schema` | `object` | JSON Schema definitions of parameters expected. |
| `execute` | `function` | Async/sync function that performs the action and returns results. |

---

## 🔗 Related Resources
* Refer to [Configuration Options](./configuration.md) to set global behaviors.
* Go to [Getting Started](../getting-started.md) to build your first agent.
* Return to [Home](../index.md).
