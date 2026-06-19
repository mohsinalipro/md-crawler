# Agent Customization & Extensibility

Learn how to customize system behaviors, register custom tools, and define agent execution constraints.

---

## 🎨 System Prompts and Instructions

You can tailor an agent's persona and instructions using the `systemPrompt` field.

```javascript
const assistant = new Agent({
  systemPrompt: `You are an expert engineer. Always reply in clean markdown. Keep answers concise.`
});
```

---

## 🛠️ Adding Custom Tools

Tools allow agents to interact with third-party APIs, filesystems, or local services. You define a tool by specifying its parameters, types, and execution function:

```javascript
import { Tool } from '@antigravity/sdk';

const fetchUser = new Tool({
  name: 'fetchUser',
  description: 'Fetch user details by database ID',
  schema: {
    userId: 'string'
  },
  execute: async ({ userId }) => {
    return await db.users.find(userId);
  }
});
```

To see complete parameters and options for creating tools, check the [API Reference](../reference/api-reference.md).

---

## 🛡️ Sandbox & Permissions

By default, agents run in a sandbox. You can limit their access using permissions in your configuration:

* **File Access**: Read-only or read-write access to specific folders.
* **Command Access**: Run a specific set of prefix commands (e.g., `git`, `npm run`).

For information on how to structure these restrictions in a file, review the [Configuration Schema](../reference/configuration.md).

---

## 🔗 Related Resources
* Back to [Guides Index](./index.md)
* Go to [Advanced Orchestration Guide](./advanced-usage.md)
* Return to [Home](../index.md)
