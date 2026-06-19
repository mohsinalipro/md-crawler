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

// 1. Simple Command Line Argument Parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    docsDir: "./markdown_files",
    port: "8080",
    model: "mlx-community/Qwen3.5-9B-4bit",
    temperature: 0.2
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
  console.log("  -d, --docs-dir <path>   Path to the markdown docs folder (default: ./markdown_files)");
  console.log("  -p, --port <number>     Port of the local MLX/OpenAI server (default: 8080)");
  console.log("  -m, --model <name>      Model name to target on the server (default: mlx-community/Qwen3.5-9B-4bit)");
  console.log("  -t, --temperature <num> Model generation temperature (default: 0.2)");
  console.log("  -h, --help              Display help information");
}

// 2. Local LLM Server Health Diagnostics
async function checkServerHealth(baseURL: string) {
  try {
    const res = await fetch(`${baseURL}/v1/models`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// Main Execution
async function main() {
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
    streamToConsole: true,
  });

  const tools = createTools(docsPath);

  const agent = createAgent({
    model: llm,
    tools,
    systemPrompt: `You are a helpful documentation assistant.

CRITICAL RULE: If the user query is related to "markdown", "docs", "documentation", or "files", you MUST ALWAYS call the 'read_documentation_sitemap' tool first to read the documentation sitemap. This will give you the titles and summaries of all files. Do this before listing files or reading other guides, so that you can instantly pinpoint the correct target and save context tokens.`,
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
  console.log(chalk.bold.blue("\n Commands:"));
  console.log(chalk.cyan("   /clear") + chalk.gray(" - Clear conversation memory"));
  console.log(chalk.cyan("   /exit ") + chalk.gray(" - Quit the session"));
  console.log(chalk.bold.blue("==================================================\n"));

  let messages = [];

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
        const eventStream = (await agent.streamEvents(
          { messages },
          { version: "v2" }
        )) as any;

        let lastAiMessage: any = null;

        for await (const event of eventStream) {
          const eventType = event.event;
          
          if (eventType === "on_tool_start") {
            console.log(chalk.bold.cyan(`\n\n🛠️  [Calling Tool: ${event.name}]`));
            console.log(chalk.gray(`   Arguments:\n${formatToolInput(event.data.input)}`));
          } else if (eventType === "on_tool_end") {
            console.log(chalk.bold.green(`\n🔌 [Tool: ${event.name} Finished]`));
            const outputStr = typeof event.data.output === "string" 
              ? event.data.output 
              : JSON.stringify(event.data.output);
            console.log(chalk.gray(`   Output Summary:\n${outputStr.substring(0, 300)}...`));
          } else if (eventType === "on_chat_model_end") {
            const message = event.data.output?.generations?.[0]?.message || event.data.output;
            if (message) {
              lastAiMessage = message;
            }
          }
        }

        if (lastAiMessage) {
          messages.push(lastAiMessage);
        }
        console.log(""); // Line break
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
