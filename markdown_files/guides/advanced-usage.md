# Advanced Orchestration Guide

This guide walks you through multi-agent orchestration, state management, and custom recovery mechanisms in the Antigravity SDK.

---

## 🤝 Multi-Agent Collaboration

For complex tasks, a single agent can become overloaded or lose focus. The Antigravity SDK allows you to split tasks among specialized agents that can invoke each other.

```javascript
import { Orchestrator, Agent } from '@antigravity/sdk';

// 1. Initialize specialized agents
const researcher = new Agent({ name: 'researcher', role: 'Research Codebase' });
const writer = new Agent({ name: 'writer', role: 'Write Markdown Content' });

// 2. Wrap them in an Orchestrator
const orchestrator = new Orchestrator({
  agents: [researcher, writer]
});

// 3. Coordinate work
const result = await orchestrator.execute('Research custom functions and write a guide.');
```

For classes details, please check the [API Reference](../reference/api-reference.md).

---

## 💾 State Management

The orchestrator maintains a shared memory thread. Each agent can read from and write to this shared context using context keys:

```javascript
// Within a custom tool or run block
agent.context.set('research_notes', 'Found 3 custom functions...');
```

---

## 🛠️ Error Recovery

Antigravity agents can automatically retry failed executions. You can customize the backoff strategies in your workspace config. Refer to [Configuration](../reference/configuration.md) for more details.

---

## 🔗 Related Resources
* Back to [Guides Index](./index.md)
* Go to [Customization Guide](./customization.md)
* Return to [Home](../index.md)
