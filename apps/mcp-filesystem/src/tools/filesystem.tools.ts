import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fileOps from "../fs/file-operations.js";
import { jsonResult, textResult, errorResult } from "./tool-result.js";

export function registerFilesystemTools(server: McpServer): void {
  server.registerTool(
    "list_directory",
    {
      title: "List a directory",
      description:
        "Lists files and subdirectories at a path within the open project (non-recursive). Use '.' for the " +
        "project root. Common noise directories (node_modules, .git, dist, build, etc.) are already filtered out.",
      inputSchema: {
        path: z.string().describe("Path relative to the project root, e.g. '.' or 'src/components'"),
      },
    },
    async ({ path: relPath }) => {
      try {
        return jsonResult(await fileOps.listDirectory(relPath));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "read_file",
    {
      title: "Read a file",
      description:
        "Reads a file's full content, with line numbers prefixed for reference. The line-number prefix is " +
        "display-only - when calling edit_file, oldStr must be the exact content WITHOUT the line number prefix.",
      inputSchema: {
        path: z.string().describe("File path relative to the project root"),
      },
    },
    async ({ path: relPath }) => {
      try {
        return textResult(await fileOps.readFile(relPath));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "write_file",
    {
      title: "Create or overwrite a file",
      description:
        "Creates a new file, or completely overwrites an existing one, with the given content. Parent " +
        "directories are created automatically. For changing part of an existing file, prefer edit_file - " +
        "it's precise and auditable, whereas this replaces the entire file content.",
      inputSchema: {
        path: z.string().describe("File path relative to the project root"),
        content: z.string().describe("The full file content to write"),
      },
    },
    async ({ path: relPath, content }) => {
      try {
        await fileOps.writeFile(relPath, content);
        return jsonResult({ written: true, path: relPath });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "edit_file",
    {
      title: "Edit part of a file",
      description:
        "Replaces one exact occurrence of oldStr with newStr in an existing file - the precise way to make a " +
        "targeted change without touching the rest of the file. oldStr must match the file's current content " +
        "EXACTLY (whitespace included, no line-number prefixes) and must be unique in the file; include enough " +
        "surrounding context to make it unique if needed. Read the file with read_file first if unsure of its " +
        "exact current content.",
      inputSchema: {
        path: z.string().describe("File path relative to the project root"),
        oldStr: z.string().describe("The exact existing text to replace (must match verbatim, must be unique in the file)"),
        newStr: z.string().describe("The text to replace it with"),
      },
    },
    async ({ path: relPath, oldStr, newStr }) => {
      try {
        await fileOps.editFile(relPath, oldStr, newStr);
        return jsonResult({ edited: true, path: relPath });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "search_files",
    {
      title: "Search file contents",
      description:
        "Recursively searches text files under a path for a literal substring (not regex), returning matching " +
        "file, line number, and a snippet for each hit. Use this to find where something is defined/used before editing.",
      inputSchema: {
        query: z.string().min(1).describe("The literal text to search for"),
        path: z.string().optional().describe("Path relative to project root to search under (default: whole project)"),
      },
    },
    async ({ query, path: subPath }) => {
      try {
        return jsonResult(await fileOps.searchFiles(query, subPath));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "create_directory",
    {
      title: "Create a directory",
      description: "Creates a directory (and any missing parent directories) within the open project.",
      inputSchema: {
        path: z.string().describe("Directory path relative to the project root"),
      },
    },
    async ({ path: relPath }) => {
      try {
        await fileOps.createDirectory(relPath);
        return jsonResult({ created: true, path: relPath });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "delete_file",
    {
      title: "Delete a file or directory",
      description: "Permanently deletes a file or directory within the open project. This cannot be undone - use carefully.",
      inputSchema: {
        path: z.string().describe("Path relative to the project root to delete"),
      },
    },
    async ({ path: relPath }) => {
      try {
        await fileOps.deleteFile(relPath);
        return jsonResult({ deleted: true, path: relPath });
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}