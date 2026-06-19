# Getting Started with Antigravity SDK

This guide will help you install the SDK and build your first autonomous agent in less than 5 minutes.

---

## 📋 Prerequisites

Before installing, ensure your environment meets the following requirements:
* **Node.js**: `v18.0.0` or higher
* **Package Manager**: `npm`, `yarn`, or `pnpm`
* **API Keys**: Access keys for your preferred LLM provider (e.g., OpenAI, Anthropic, or Gemini)

---

## ⚙️ Installation

To install the core package and its peer dependencies, run:

```bash
npm install @antigravity/sdk
```

---

## 🚀 Quick Start: Your First Agent

Create a file named `agent.js` and paste the following code:

```javascript
import { Agent, Tool } from '@antigravity/sdk';

// 1. Define a custom tool
const calculator = new Tool({
  name: 'calculator',
  description: 'Add two numbers together',
  execute: ({ a, b }) => a + b
});

// 2. Initialize the agent
const agent = new Agent({
  model: 'gemini-2.5-flash',
  tools: [calculator],
  systemPrompt: 'You are a helpful mathematical assistant.'
});

// 3. Run the agent
const response = await agent.run('What is 256 + 512?');
console.log(response.text);
```

For a comprehensive explanation of class options and return values, see the [API Reference](./reference/api-reference.md).

---

## 🔗 Next Steps

Now that your first agent is up and running, explore:
* Learn how to chain multiple agents together in the [Advanced Agent Orchestration Guide](./guides/advanced-usage.md).
* Add system behaviors and constraints via the [Customization Guide](./guides/customization.md).
* View all available environment variables in the [Configuration Schema](./reference/configuration.md).
* Go back to [Home](./index.md).
