import type { ToolDefinition } from '../ai_agent/types';
import type { ToolHandler } from './tool_registry';
import { readFiles, listFiles, searchFiles } from '@/service/git_read_files';
import ChatSessionModel from '@/database/chat_session';

// Tool 1: List Files
const listFilesDefinition: ToolDefinition = {
  name: "list_files",
  description: "List git tracked files and directories within the repository. Use this to discover the file structure.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The directory path to list. Defaults to the root directory '.' if not specified.",
      },
      recursive: {
        type: "boolean",
        description: "If true, lists all files in subdirectories recursively. Use with caution on large repos.",
      },
      depth: {
        type: "number",
        description: "Maximum directory depth to list (e.g., 1 = top-level only, 2 = include one level of subdirectories). Defaults to 2.",
      },
    },
    required: [],
  },
};

export const listFilesHandler: ToolHandler = {
  definition: listFilesDefinition,
  async execute(input, chatSession, currentUser) {
    const dirPath = (input.path as string) || '.';
    const recursive = (input.recursive as boolean) || false;
    const depth = input.depth as number | undefined;

    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const entries = await listFiles(
      currentUser,
      sessionModel.repository_id,
      chatSession.commitHash,
      dirPath,
      recursive,
      depth ?? 2,
    );

    return { output: entries.join('\n') };
  },
};

// Tool 2: Read File
const readFileDefinition: ToolDefinition = {
  name: "read_file",
  description: "Read the full content of a specific git tracked file. Returns the file content as text.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The exact path of the file to read (e.g., 'src/index.ts').",
      },
    },
    required: ["path"],
  },
};

export const readFileHandler: ToolHandler = {
  definition: readFileDefinition,
  async execute(input, chatSession, currentUser) {
    const filePath = input.path as string;
    if (!filePath) {
      return { output: 'Missing required parameter: path', isError: true };
    }

    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const result = await readFiles(
      currentUser,
      sessionModel.repository_id,
      [filePath],
      chatSession.commitHash,
    );

    const content = result[filePath];
    if (content === null || content === undefined) {
      return { output: `File not found or is binary: ${filePath}`, isError: true };
    }

    return { output: content };
  },
};

// Tool 3: Search Files
const searchFilesDefinition: ToolDefinition = {
  name: "search_files",
  description: "Search git tracked file paths in the repository using a case-insensitive regex pattern. Matches against the full file path (not content). Use this to locate files by name or path fragment when you don't know the exact location.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "A regex pattern (case-insensitive) to match against file paths. Examples: 'user_controller', '\\.test\\.ts$', 'auth/.*\\.ts'.",
      },
    },
    required: ["pattern"],
  },
};

export const searchFilesHandler: ToolHandler = {
  definition: searchFilesDefinition,
  async execute(input, chatSession, currentUser) {
    const pattern = input.pattern as string;
    if (!pattern) {
      return { output: 'Missing required parameter: pattern', isError: true };
    }

    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const { paths, truncated } = await searchFiles(
      currentUser,
      sessionModel.repository_id,
      chatSession.commitHash,
      pattern,
    );

    if (paths.length === 0) {
      return { output: 'No files matched the pattern.' };
    }

    let output = paths.join('\n');
    if (truncated) {
      output += `\n\n[Results truncated — showing first ${paths.length} matches. Narrow your pattern for more specific results.]`;
    }
    return { output };
  },
};
