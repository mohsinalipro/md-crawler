import { tool } from "langchain";
import * as z from "zod";
import fs from "fs/promises";
import path from "path";

// Helper function to format tool inputs nicely in console logs
export function formatToolInput(input) {
  if (!input) return "{}";
  if (typeof input === "string") {
    try {
      return JSON.stringify(JSON.parse(input), null, 2);
    } catch {
      return input;
    }
  }
  if (typeof input === "object") {
    // Extract nested stringified JSON if present (common in LangChain tool wrapping)
    if (Object.keys(input).length === 1 && typeof input.input === "string") {
      try {
        const parsed = JSON.parse(input.input);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Fall through
      }
    }
    return JSON.stringify(input, null, 2);
  }
  return String(input);
}

/**
 * Scans documentation files recursively and compiles a sitemap file.
 */
async function compileSitemap(docsDir) {
  async function walk(dir) {
    let results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
      const res = path.resolve(dir, file.name);
      if (file.isDirectory()) {
        const subResults = await walk(res);
        results = results.concat(subResults);
      } else if (file.isFile() && file.name.endsWith(".md") && !file.name.startsWith(".")) {
        results.push(res);
      }
    }
    return results;
  }

  const files = await walk(docsDir);
  const sitemap = [];

  for (const file of files) {
    const relativePath = path.relative(docsDir, file);
    try {
      const content = await fs.readFile(file, "utf-8");
      const lines = content.split("\n");
      let title = "";
      let summary = "";
      
      // Basic extraction of header and first paragraph
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("#") && !title) {
          title = trimmed.replace(/^#+\s+/, "");
        } else if (!trimmed.startsWith("#") && !trimmed.startsWith("!") && !trimmed.startsWith(">") && !summary) {
          // Take first non-empty text line that is not a header, link, or quote
          summary = trimmed.substring(0, 150);
        }
        if (title && summary) break;
      }

      sitemap.push({
        filePath: relativePath,
        title: title || path.basename(file),
        summary: summary || "General documentation details."
      });
    } catch (e) {
      // Ignore read errors
    }
  }

  const sitemapPath = path.resolve(docsDir, ".md-crawler-sitemap.json");
  await fs.writeFile(sitemapPath, JSON.stringify(sitemap, null, 2), "utf-8");
  return sitemap;
}

/**
 * Loads sitemap or compiles it if missing.
 */
export async function getOrCompileSitemap(docsDir) {
  const sitemapPath = path.resolve(docsDir, ".md-crawler-sitemap.json");
  try {
    const data = await fs.readFile(sitemapPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return await compileSitemap(docsDir);
  }
}

/**
 * Factory to create tools dynamically based on target docs directory.
 */
export function createTools(docsDir) {
  const resolvedDocsDir = path.resolve(docsDir);

  // 1. Tool to list all markdown files recursively in the docs directory
  const listMarkdownFiles = tool(
    async () => {
      try {
        async function walk(dir) {
          let results = [];
          const list = await fs.readdir(dir, { withFileTypes: true });
          for (const file of list) {
            const res = path.resolve(dir, file.name);
            if (file.isDirectory()) {
              const subResults = await walk(res);
              results = results.concat(subResults);
            } else if (file.isFile() && file.name.endsWith(".md") && !file.name.startsWith(".")) {
              results.push(path.relative(resolvedDocsDir, res));
            }
          }
          return results;
        }
        const files = await walk(resolvedDocsDir);
        return `Available documentation files in markdown directory:\n${files.map(f => `- ${f}`).join("\n")}`;
      } catch (error) {
        return `Error listing markdown files: ${error.message}`;
      }
    },
    {
      name: "list_markdown_files",
      description: "Lists all available documentation markdown files recursively in the configured directory.",
      schema: z.object({}),
    }
  );

  // 2. Tool to read the contents of a specific markdown file
  const readMarkdownFile = tool(
    async (input) => {
      try {
        // Prevent directory traversal attacks
        const safePath = path.normalize(input.filePath).replace(/^(\.\.(\/|\\))+/, '');
        const fullPath = path.resolve(resolvedDocsDir, safePath);
        
        // Ensure the resolved path remains strictly within the resolvedDocsDir boundary
        if (!fullPath.startsWith(resolvedDocsDir)) {
          return `Error: Access denied. Path must be inside the documentation directory.`;
        }
        
        const content = await fs.readFile(fullPath, "utf-8");
        return `Content of ${input.filePath}:\n\n${content}`;
      } catch (error) {
        return `Error reading file ${input.filePath}: ${error.message}`;
      }
    },
    {
      name: "read_markdown_file",
      description: "Reads and returns the contents of a specific markdown file by its relative path (e.g. 'index.md', 'guides/customization.md').",
      schema: z.object({
        filePath: z.string().describe("The relative path of the markdown file to read, starting from the documentation root directory."),
      }),
    }
  );

  // 3. Tool to read sitemap and bypass file scanning
  const readDocumentationSitemap = tool(
    async () => {
      try {
        const sitemap = await getOrCompileSitemap(resolvedDocsDir);
        let output = `### Documentation Sitemap Index:\n`;
        for (const item of sitemap) {
          output += `* **File**: \`${item.filePath}\`\n  * **Title**: ${item.title}\n  * **Summary**: ${item.summary}\n`;
        }
        return output;
      } catch (error) {
        return `Error reading sitemap: ${error.message}`;
      }
    },
    {
      name: "read_documentation_sitemap",
      description: "Reads the pre-compiled sitemap map containing titles and summaries of all available documentation files. Read this FIRST to instantly identify which file contains the details you need, avoiding blind traversal.",
      schema: z.object({}),
    }
  );

  return [listMarkdownFiles, readMarkdownFile, readDocumentationSitemap];
}
