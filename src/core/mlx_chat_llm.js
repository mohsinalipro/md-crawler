/**
 * Standalone LangChain Chat Model Adapter for MLX Local Server.
 * 
 * Provides 100% compatibility with LangChain Core message structures,
 * tool calling, streaming, and execution callbacks.
 * 
 * Styled with chalk and marked for beautiful console outputs.
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import chalk from "chalk";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked to render markdown natively in the terminal
marked.use(markedTerminal());

/**
 * Helper to convert message content (which can be a string or a nested block array) to a plain string.
 */
function messageContentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && block.type === "text") return block.text;
        return "";
      })
      .join("");
  }
  return "";
}

export default class MLXChatLLM extends BaseChatModel {
  /**
   * @param {object} fields Configuration fields
   * @param {string} [fields.baseURL] Base URL of the MLX server (defaults to MLX_API_BASE env var or http://localhost:8080)
   * @param {string} [fields.model] Model name to use (defaults to MLX_MODEL_NAME env var or mlx-community/Qwen3.5-9B-4bit)
   * @param {number} [fields.temperature] Temperature parameter (defaults to 0.7)
   * @param {boolean} [fields.streamToConsole] Enable direct stdout token printing (defaults to false)
   */
  constructor(fields = {}) {
    super(fields);
    this.baseURL = fields.baseURL || process.env.MLX_API_BASE || "http://localhost:8080";
    this.model = fields.model || process.env.MLX_MODEL_NAME || "mlx-community/Qwen3.5-9B-4bit";
    this.temperature = typeof fields.temperature === "number" ? fields.temperature : 0.7;
    this.tools = [];
    this.streamToConsole = fields.streamToConsole ?? false;
  }

  _llmType() {
    return "mlx-chat";
  }

  _identifyingParams() {
    return {
      model: this.model,
      temperature: this.temperature,
      baseURL: this.baseURL,
    };
  }

  /**
   * Binds tools to the chat model for function calling.
   * @param {any[]} tools Array of tools to bind
   * @param {object} [options] Additional binding options
   */
  bindTools(tools, options) {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.tools = tools.map((t) => convertToOpenAITool(t));
    return clone;
  }

  /**
   * Handles non-streaming generation.
   */
  async _generate(messages, options, runManager) {
    if (!this.streamToConsole) {
      const payload = {
        model: this.model,
        messages: this._convertMessages(messages),
        temperature: this.temperature,
      };

      if (this.tools && this.tools.length > 0) {
        payload.tools = this.tools;
      }

      const url = `${this.baseURL.replace(/\/$/, "")}/v1/chat/completions`;
      const signal = options?.signal;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`MLX server error: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      const content = message?.content || "";
      
      const tool_calls = message?.tool_calls?.map((tc) => {
        let args = tc.function.arguments;
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
        return {
          name: tc.function.name,
          args,
          id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
          type: "tool_call"
        };
      });

      const aiMessage = new AIMessage({ content, tool_calls });

      return {
        generations: [
          {
            text: content,
            message: aiMessage,
          },
        ],
      };
    }

    // Stream generation and optionally print to console, then return final accumulated object
    let fullContent = "";
    let toolCallsMap = {};

    const stream = this._streamResponseChunks(messages, options, runManager);

    for await (const chunk of stream) {
      const message = chunk.message;
      if (message) {
        if (message.content) {
          fullContent += message.content;
        }
        
        if (message.tool_call_chunks && message.tool_call_chunks.length > 0) {
          for (const tc of message.tool_call_chunks) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap[idx]) {
              toolCallsMap[idx] = {
                id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
                name: tc.name,
                args: ""
              };
            }
            if (tc.name) toolCallsMap[idx].name = tc.name;
            if (tc.id) toolCallsMap[idx].id = tc.id;
            if (tc.args) toolCallsMap[idx].args += tc.args;
          }
        }
      }
    }

    const tool_calls = Object.values(toolCallsMap).map((tc) => {
      let args = tc.args;
      if (typeof args === "string" && args.trim()) {
        try {
          args = JSON.parse(args);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      return {
        name: tc.name,
        args,
        id: tc.id,
        type: "tool_call"
      };
    });

    const finalMessage = new AIMessage({
      content: fullContent,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined
    });

    return {
      generations: [
        {
          text: fullContent,
          message: finalMessage,
        },
      ],
    };
  }

  /**
   * Streaming generation via LangChain's stream()
   */
  async *_streamResponseChunks(messages, options, runManager) {
    const payload = {
      model: this.model,
      messages: this._convertMessages(messages),
      temperature: this.temperature,
      stream: true,
    };

    if (this.tools && this.tools.length > 0) {
      payload.tools = this.tools;
    }

    const url = `${this.baseURL.replace(/\/$/, "")}/v1/chat/completions`;
    const signal = options?.signal;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`MLX server error: ${res.status} ${txt}`);
    }

    if (!res.body) {
      throw new Error("Response has no body to stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasPrintedHeader = false;
    let fullContent = "";
    let toolCallsMap = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          const chunk = this._parseSseLine(buffer.trim());
          if (chunk) {
            if (chunk.message) {
              if (chunk.message.content) {
                fullContent += chunk.message.content;
                if (this.streamToConsole) {
                  if (!hasPrintedHeader) {
                    process.stdout.write(chalk.bold.yellow("\n🤖 [Agent starts reasoning...]\n"));
                    hasPrintedHeader = true;
                  }
                  process.stdout.write(chalk.gray(chunk.message.content));
                }
              }
              if (chunk.message.tool_call_chunks) {
                for (const tc of chunk.message.tool_call_chunks) {
                  toolCallsMap[tc.index ?? 0] = tc;
                }
              }
            }
            if (runManager && chunk.message && chunk.message.content) {
              await runManager.handleLLMNewToken(chunk.message.content);
            }
            yield chunk;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const chunk = this._parseSseLine(trimmed);
        if (chunk) {
          if (chunk.message) {
            if (chunk.message.content) {
              fullContent += chunk.message.content;
              if (this.streamToConsole) {
                if (!hasPrintedHeader) {
                  process.stdout.write(chalk.bold.yellow("\n🤖 [Agent starts reasoning...]\n"));
                  hasPrintedHeader = true;
                }
                process.stdout.write(chalk.gray(chunk.message.content));
              }
            }
            if (chunk.message.tool_call_chunks) {
              for (const tc of chunk.message.tool_call_chunks) {
                toolCallsMap[tc.index ?? 0] = tc;
              }
            }
          }
          if (runManager && chunk.message && chunk.message.content) {
            await runManager.handleLLMNewToken(chunk.message.content);
          }
          yield chunk;
        }
      }
    }

    if (this.streamToConsole && hasPrintedHeader) {
      console.log(""); // Print trailing newline
      const isFinal = Object.keys(toolCallsMap).length === 0;
      if (isFinal) {
        console.log(chalk.bold.magenta("\n🎨 [Formatted Markdown Response]:"));
        console.log(marked.parse(fullContent));
      }
    }
  }

  _parseSseLine(line) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]") return null;
      try {
        const parsed = JSON.parse(dataStr);
        const content =
          parsed?.choices?.[0]?.delta?.content ||
          parsed?.choices?.[0]?.delta?.reasoning ||
          "";
        
        const tool_calls = parsed?.choices?.[0]?.delta?.tool_calls;
        
        if (tool_calls && tool_calls.length > 0) {
          const tool_call_chunks = tool_calls.map((tc) => ({
            name: tc.function?.name,
            args: tc.function?.arguments || "",
            id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
            index: tc.index ?? 0,
          }));
          
          return new ChatGenerationChunk({
            text: "",
            message: new AIMessageChunk({
              content: "",
              tool_call_chunks,
            }),
          });
        } else if (content) {
          return new ChatGenerationChunk({
            text: content,
            message: new AIMessageChunk({ content }),
          });
        }
      } catch (e) {
        // Ignore JSON parse errors for incomplete/corrupted lines
      }
    }
    return null;
  }

  _convertMessages(messages) {
    return messages.map((m) => {
      const role = this._messageRoleToString(m);
      const item = {
        role,
        content: messageContentToString(m.content),
      };

      if (m._getType() === "ai" && m.tool_calls && m.tool_calls.length > 0) {
        item.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        }));
      }

      if (m._getType() === "tool") {
        item.tool_call_id = m.tool_call_id;
        item.name = m.name;
      }

      return item;
    });
  }

  _messageRoleToString(message) {
    const role = message._getType?.();
    if (role === "human") return "user";
    if (role === "ai") return "assistant";
    if (role === "system") return "system";
    if (role === "tool") return "tool";
    return String(role || "user");
  }
}
