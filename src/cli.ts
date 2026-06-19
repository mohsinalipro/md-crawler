#!/usr/bin/env node

/**
 * MD-Crawler CLI Shell
 * 
 * Interactive agentic CLI shell to traverse and chat with documentation
 * files with maximum token efficiency.
 */

import { createAgent } from "langchain";
import MLXChatLLM from "./core/mlx_chat_llm.js";
import { createTools, formatToolInput, getOrCompileSitemap } from "./core/tools.js";
import path from "path";
import chalk from "chalk";
import readline from "readline/promises";

// 1. Command Line Argument Parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    docsDir: "./examples/markdown_files",
    port: "8080",
    model: "mlx-community/Qwen3.5-9B-4bit",
    temperature: 0.2,
    outputFormat: "text",  // text | json | jsonl | structured
    stream: true  // true | false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--docs-dir" || arg === "-d") {
      options.docsDir = args[++i];
    } else if (arg === "--port" || arg === "-p") {
      options.port = args[++i];
    } else if (arg === "--model" || arg === "-m") {
      options.model = args[++i];
    } else if (arg === "--temperature" || arg === "-t") {
      options.temperature = parseFloat(args[++i]);
    } else if (arg === "--output-format" || arg === "-o") {
      options.outputFormat = args[++i];
    } else if (arg === "--stream" || arg === "-s") {
      options.stream = args[++i] === "false" ? false : true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log(chalk.bold.cyan("\nMD-Crawler: Token-Efficient Local Doc Agent"));
  console.log("Usage: node src/cli.js [options]");
  console.log("\nOptions:");
  console.log("  -d, --docs-dir <path>   Path to the markdown docs folder (default: ./examples/markdown_files)");
  console.log("  -p, --port <number>     Port of the local MLX/OpenAI server (default: 8080)");
  console.log("  -m, --model <name>      Model name to target on the server (default: mlx-community/Qwen3.5-9B-4bit)");
  console.log("  -t, --temperature <num> Model generation temperature (default: 0.2)");
  console.log("  -o, --output-format <text|json|jsonl|structured>  Output format (default: text)");
  console.log("  -s, --stream <true|false>  Enable/disable streaming (default: true)");
  console.log("  -h, --help              Display help information");
}

// Structured response interface for programmatic consumption
export interface StructuredResponse {
  query: string;
  file_refs: string[];
  content: string;
  reasoning?: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  timestamp: string;
}

// Parse agent response into structured format
function parseStructuredResponse(agentResponse: any): StructuredResponse | null {
  try {
    // Check if response is already an object
    if (typeof agentResponse === 'object' && !Array.isArray(agentResponse)) {
      const response = agentResponse as any;
      
      // Extract content from message
      const content = response.content || response?.generations?.[0]?.message?.content || "";
      
      // Extract tool calls
      const toolCalls = response.tool_calls || response?.generations?.[0]?.message?.tool_calls || [];
      
      // Extract reasoning (if available)
      const reasoning = response.reasoning || response?.generations?.[0]?.message?.reasoning || undefined;
      
      // Extract file references from content or tool calls
      const fileRefs: string[] = [];
      
      // Look for file references in content (markdown code blocks)
      const contentMatch = content.match(/```(?:md|markdown)?\n?([\s\S]*?)```/);
      if (contentMatch && contentMatch[1]) {
        // Parse markdown code block for file references
        const lines = contentMatch[1].split('\n');
        lines.forEach(line => {
          const match = line.match(/File: `([^`]+)`/);
          if (match) {
            fileRefs.push(match[1]);
          }
        });
      }
      
      // Look for file references in tool calls
      toolCalls.forEach(tc => {
        if (tc.name === 'read_markdown_file' || tc.name === 'read_documentation_sitemap') {
          if (typeof tc.args === 'object' && tc.args.filePath) {
            fileRefs.push(tc.args.filePath);
          }
        }
      });
      
      return {
        query: response.query || "Unknown query",
        file_refs: [...new Set(fileRefs)], // Remove duplicates
        content,
        reasoning,
        tool_calls: toolCalls.map(tc => ({
          name: tc.name,
          args: typeof tc.args === 'object' ? tc.args : JSON.parse(tc.args)
        })),
        timestamp: new Date().toISOString()
      };
    }
    
    // Try to parse as JSON
    const parsed = JSON.parse(agentResponse);
    return {
      query: parsed.query || "Unknown query",
      file_refs: parsed.file_refs || [],
      content: parsed.content || "",
      reasoning: parsed.reasoning,
      tool_calls: parsed.tool_calls?.map(tc => ({
        name: tc.name,
        args: typeof tc.args === 'object' ? tc.args : JSON.parse(tc.args)
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    // Parsing failed, return null
    return null;
  }
}

// Build system prompt based on output format
function buildSystemPrompt(outputFormat: string): string {
  const formatInstructions = {
    text: "Respond naturally in markdown format.",
    json: "Respond ONLY in valid JSON format with this exact schema:\n" +
      `{\n` +
      `  "query": "string - the user's original query",\n` +
      `  "file_refs": ["string - array of file paths involved in the response"],\n` +
      `  "content": "string - the AI's response to the query"\n` +
      `}\n` +
      "Do not include any text outside the JSON object.",
    jsonl: "Respond ONLY as JSON Lines (one JSON object per line). Each line must be valid JSON:\n" +
      `{"query": "string", "file_refs": ["string"], "content": "string"}\n` +
      "Each line is a separate response object. Do not include any text outside the JSON objects.",
    structured: "Respond in structured JSON with extended metadata:\n" +
      `{\n` +
      `  "query": "string - the user's original query",\n` +
      `  "file_refs": ["string - array of file paths involved"],\n` +
      `  "content": "string - the AI's response",\n` +
      `  "reasoning": "string - the agent's thought process (optional)",\n` +
      `  "tool_calls": [{"name": "string", "args": {}}] - array of tool calls made,\n` +
      `  "timestamp": "string - ISO timestamp of response"\n` +
      `}\n` +
      "Do not include any text outside the JSON object."
  };

  const workflowInstructions = `
WORKFLOW (follow this for every query):
1. ALWAYS call 'read_documentation_sitemap' first to identify which file(s) are relevant.
2. Call 'read_markdown_file' to load the specific file(s) you need.
3. Answer the user's question using ONLY the content you retrieved.

OUTPUT FORMAT: ${outputFormat.toUpperCase()}
${formatInstructions[outputFormat as keyof typeof formatInstructions]}
`;

  return `You are a documentation assistant. Your ONLY knowledge source is the local markdown documentation directory. Do not use prior knowledge — answer strictly from file contents you retrieve.

You have three tools:
- read_documentation_sitemap: Returns titles and summaries of all documentation files.
- read_markdown_file: Reads the full contents of a specific file by relative path.
- list_markdown_files: Lists all available markdown file paths.

${workflowInstructions}`;
}

// Main Execution
async function main() {
  try {
    const res = await fetch(`${baseURL}/v1/models`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// Structured response interface for programmatic consumption
export interface StructuredResponse {
  query: string;
  file_refs: string[];
  content: string;
  reasoning?: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  timestamp: string;
}

// Build system prompt based on output format
function buildSystemPrompt(outputFormat: string): string {
  const formatInstructions = {
    text: "Respond naturally in markdown format.",
    json: "Respond ONLY in valid JSON format with this exact schema:\n" +
      `{\n` +
      `  "query": "string - the user's original query",\n` +
      `  "file_refs": ["string - array of file paths involved in the response"],\n` +
      `  "content": "string - the AI's response to the query"\n` +
      `}\n` +
      "Do not include any text outside the JSON object.",
    jsonl: "Respond ONLY as JSON Lines (one JSON object per line). Each line must be valid JSON:\n" +
      `{"query": "string", "file_refs": ["string"], "content": "string"}\n` +
      "Each line is a separate response object. Do not include any text outside the JSON objects.",
    structured: "Respond in structured JSON with extended metadata:\n" +
      `{\n` +
      `  "query": "string - the user's original query",\n` +
      `  "file_refs": ["string - array of file paths involved"],\n` +
      `  "content": "string - the AI's response",\n` +
      `  "reasoning": "string - the agent's thought process (optional)",\n` +
      `  "tool_calls": [{"name": "string", "args": {}}] - array of tool calls made,\n` +
      `  "timestamp": "string - ISO timestamp of response"\n` +
      `}\n` +
      "Do not include any text outside the JSON object."
  };

  const workflowInstructions = `
WORKFLOW (follow this for every query):
1. ALWAYS call 'read_documentation_sitemap' first to identify which file(s) are relevant.
2. Call 'read_markdown_file' to load the specific file(s) you need.
3. Answer the user's question using ONLY the content you retrieved.

OUTPUT FORMAT: ${outputFormat.toUpperCase()}
${formatInstructions[outputFormat as keyof typeof formatInstructions]}
`;

  return `You are a documentation assistant. Your ONLY knowledge source is the local markdown documentation directory. Do not use prior knowledge — answer strictly from file contents you retrieve.

You have three tools:
- read_documentation_sitemap: Returns titles and summaries of all documentation files.
- read_markdown_file: Reads the full contents of a specific file by relative path.
- list_markdown_files: Lists all available markdown file paths.

${workflowInstructions}`;
}
  const options = parseArgs();
  const docsPath = path.resolve(options.docsDir);
  const baseURL = `http://localhost:${options.port}`;

  console.log(chalk.bold.blue("\nChecking local LLM server health..."));
  const isHealthy = await checkServerHealth(baseURL);

  if (!isHealthy) {
    console.log(chalk.bold.yellow(`\n⚠️  Warning: Local LLM server is not responding at ${baseURL}`));
    console.log(chalk.gray("Please ensure your local LLM server is running (e.g. mlx_lm.server, llama.cpp, or Ollama)."));
    console.log(chalk.gray(`If needed, launch it with: `) + chalk.cyan(`mlx_lm.server --model ${options.model}`));
    console.log(chalk.gray("We will attempt execution, but connection errors may occur.\n"));
  } else {
    console.log(chalk.bold.green("✅ Local LLM server detected and responsive.\n"));
  }

  // Pre-compile or load sitemap to enable token-efficiency
  console.log(chalk.gray(`Indexing documentation inside: ${docsPath}...`));
  try {
    await getOrCompileSitemap(docsPath);
  } catch (e) {
    console.error(chalk.bold.red(`Failed to index documentation directory: ${(e as any).message}`));
    process.exit(1);
  }

  // 3. Initialize Model and Agent
  const llm = new MLXChatLLM({
    baseURL,
    model: options.model,
    temperature: options.temperature,
    streamToConsole: options.stream,
  });

  const tools = createTools(docsPath);

  // Build system prompt based on output format
  const systemPrompt = buildSystemPrompt(options.outputFormat);

  const agent = createAgent({
    model: llm,
    tools,
    prompt: systemPrompt,
  });

  // 4. Start Readline Interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.bold.blue("=================================================="));
  console.log(chalk.bold.cyan("             🚀 MD-Crawler CLI Shell 🚀            "));
  console.log(chalk.bold.blue("=================================================="));
  console.log(chalk.yellow(` Target Folder: `) + chalk.gray(docsPath));
  console.log(chalk.yellow(` Target Model : `) + chalk.gray(`${options.model} (${baseURL})`));
  console.log(chalk.yellow(` Output Format: `) + chalk.gray(options.outputFormat.toUpperCase()));
  console.log(chalk.yellow(` Streaming: `) + chalk.gray(options.stream ? "Enabled" : "Disabled"));
  console.log(chalk.bold.blue("\n Commands:"));
  console.log(chalk.cyan("   /clear") + chalk.gray(" - Clear conversation memory"));
  console.log(chalk.cyan("   /exit ") + chalk.gray(" - Quit the session"));
  console.log(chalk.bold.blue("==================================================\n"));

  let messages: any[] = [];

  try {
    while (true) {
      const query = await rl.question(chalk.bold.green("Query > "));
      const trimmedQuery = query.trim();

      if (!trimmedQuery) continue;

      if (trimmedQuery.toLowerCase() === "/exit") {
        console.log(chalk.bold.yellow("\nGoodbye! 👋\n"));
        break;
      }

      if (trimmedQuery.toLowerCase() === "/clear") {
        messages = [];
        console.log(chalk.bold.yellow("\n🧹 Conversation memory cleared.\n"));
        continue;
      }

      // Add query to memory
      messages.push({ role: "user", content: trimmedQuery });

      try {
        const eventStream = agent.streamEvents({ messages }, { version: "v2" }) as any;

        if (options.outputFormat === "text") {
          let streamingContent = "";
          let hasPrintedHeader = false;

          for await (const event of eventStream) {
            const eventType = event.event;

            if (eventType === "on_tool_start") {
              console.log(chalk.bold.cyan(`\n\n🛠️  [Calling Tool: ${event.name}]`));
              console.log(chalk.gray(`   Arguments:\n${formatToolInput(event.data.input)}`));
            } else if (eventType === "on_tool_end") {
              console.log(chalk.bold.green(`\n🔌 [Tool: ${event.name} Finished]`));
              const outputStr = typeof event.data.output === "string" ? event.data.output : JSON.stringify(event.data.output);
              console.log(chalk.gray(`   Output Summary:\n${outputStr.substring(0, 300)}...`));
            } else if (eventType === "on_chat_model_stream") {
              const chunk = event.data?.chunk;
              if (chunk) {
                const content = typeof chunk.content === "string" ? chunk.content : "";
                if (content) {
                  if (!hasPrintedHeader) {
                    process.stdout.write(chalk.bold.yellow("\n🤖 [Agent starts reasoning...]\n"));
                    hasPrintedHeader = true;
                  }
                  process.stdout.write(chalk.gray(content));
                  streamingContent += content;
                }
              }
            } else if (eventType === "on_chat_model_end") {
              const message = event.data.output?.generations?.[0]?.message || event.data.output;
              if (message) {
                lastAiMessage = message;
              }
            }
          }

          if (streamingContent && !lastAiMessage?.tool_calls?.length) {
            const { marked } = await import("marked");
            const { markedTerminal } = await import("marked-terminal");
            marked.use(markedTerminal());
            console.log(chalk.bold.magenta("\n\n🎨 [Formatted Markdown Response]:"));
            console.log(marked.parse(streamingContent));
          }

          if (lastAiMessage) {
            messages.push(lastAiMessage);
          }
        } else {
          // Structured modes (json, jsonl, structured)
          let finalResponse: any = null;

          for await (const event of eventStream) {
            const eventType = event.event;

            if (eventType === "on_chat_model_end") {
              const message = event.data.output?.generations?.[0]?.message || event.data.output;
              if (message) {
                finalResponse = parseStructuredResponse({
                  content: message.content || "",
                  tool_calls: message.tool_calls || [],
                });
              }
            }
          }

          if (finalResponse) {
            if (options.outputFormat === "jsonl") {
              console.log(JSON.stringify(finalResponse));
            } else {
              console.log(JSON.stringify(finalResponse, null, 2));
            }
          } else {
            console.error(chalk.bold.red("\n❌ Failed to parse structured response"));
          }
        }
      } catch (error) {
        console.error(chalk.bold.red("\n❌ Error during execution:"), (error as any).message || error);
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(chalk.bold.red("\nFatal Error:"), err);
  process.exit(1);
});
