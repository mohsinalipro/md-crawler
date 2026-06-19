import MLXChatLLM from "../src/core/mlx_chat_llm.js";
import assert from "assert";

const llm = new MLXChatLLM();

console.log("Running SSE Line Parser Unit Tests...");

// Test Case 1: Normal Content Delta
const normalLine = 'data: {"choices": [{"delta": {"content": "Hello"}}]}';
const chunk1 = llm._parseSseLine(normalLine);
assert.strictEqual(chunk1!.text, "Hello");
assert.strictEqual(chunk1!.message.content, "Hello");
console.log("✅ Case 1: Normal Content Delta Passed");

// Test Case 2: Reasoning Delta (Qwen style)
const reasoningLine = 'data: {"choices": [{"delta": {"reasoning": "Thinking process"}}]}';
const chunk2 = llm._parseSseLine(reasoningLine);
assert.strictEqual(chunk2!.text, "Thinking process");
assert.strictEqual(chunk2!.message.content, "Thinking process");
console.log("✅ Case 2: Reasoning Delta Passed");

// Test Case 3: Tool Calls Delta
const toolLine = 'data: {"choices": [{"delta": {"tool_calls": [{"function": {"name": "test_tool", "arguments": "{}"}, "id": "123", "index": 0}]}}]}';
const chunk3 = llm._parseSseLine(toolLine);
assert.strictEqual(chunk3!.text, "");
assert.strictEqual(chunk3!.message.content, "");
const aiMessageChunk = chunk3!.message as any;
assert.strictEqual(aiMessageChunk.tool_call_chunks[0].name, "test_tool");
assert.strictEqual(aiMessageChunk.tool_call_chunks[0].id, "123");
console.log("✅ Case 3: Tool Calls Delta Passed");

// Test Case 4: Ignore DONE lines
const doneLine = "data: [DONE]";
const chunk4 = llm._parseSseLine(doneLine);
assert.strictEqual(chunk4, null);
console.log("✅ Case 4: DONE termination parsing Passed");

console.log("\n🎉 All SSE parser tests completed successfully!");
