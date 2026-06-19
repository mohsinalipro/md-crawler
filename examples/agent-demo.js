import { createAgent, tool } from "langchain";
import * as z from "zod";
import MLXChatLLM from "../src/core/mlx_chat_llm.js";

// 1. Define the tool
const getWeather = tool(
  (input) => `It's always sunny in ${input.city}!`,
  {
    name: "get_weather",
    description: "Get the weather for a given city",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
  }
);

// 2. Initialize our custom MLX Chat Model
const llm = new MLXChatLLM({
  baseURL: "http://localhost:8080",
  model: "mlx-community/Qwen3.5-9B-4bit",
  temperature: 0.2,
});

// 3. Create the agent
const agent = createAgent({
  model: llm,
  tools: [getWeather],
});

// 4. Run the agent
console.log("Invoking the agent to get weather info...\n");
const result = await agent.invoke({
  messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
});

console.log("Agent Conversation History:");
for (const msg of result.messages) {
  const roleName = msg._getType() === "human" ? "User" : msg._getType() === "ai" ? "AI" : "Tool";
  console.log(`[${roleName}] content: ${JSON.stringify(msg.content)}`);
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    console.log(`       tool_calls: ${JSON.stringify(msg.tool_calls)}`);
  }
}
