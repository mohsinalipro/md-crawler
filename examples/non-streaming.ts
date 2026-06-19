import MLXChatLLM from "../src/core/mlx_chat_llm.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new MLXChatLLM({
  baseURL: "http://localhost:8080",
  model: "mlx-community/Qwen3.5-9B-4bit",
  temperature: 0.2,
});

async function run() {
  console.log("Testing non-streaming invoke()...\n");
  try {
    const messages = [
      new SystemMessage("You are a helpful assistant."),
      new HumanMessage("Tell me a short joke about JavaScript."),
    ];

    console.log("--- Response (non-streaming) ---\n");
    const result = await llm.invoke(messages);
    console.log(result);
    console.log("\n--- Done ---");
  } catch (err) {
    console.error("Error:", (err as any).message || err);
    console.error((err as any).stack);
  }
}

run();
