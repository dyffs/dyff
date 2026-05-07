import type { ToolDefinition } from '../ai_agent/types';
import type { ToolHandler } from './tool_registry';
import { searchCode, formatSearchResults } from '@/service/git_search';
import ChatSessionModel from '@/database/chat_session';

const searchCodeDefinition: ToolDefinition = {
  name: "search_code",
  description: "Search the repository codebase at the current commit using a regex pattern. Returns matching lines grouped by file with surrounding context. Lock files, binaries, and minified assets are excluded automatically. Use this to find usages, definitions, or patterns across the codebase.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "A regex pattern to search for (extended regex syntax). Examples: 'fetchUser', 'async function \\w+Handler', 'TODO|FIXME'.",
      },
      context_lines: {
        type: "number",
        description: "Number of lines to show before and after each match. Defaults to 2.",
      },
    },
    required: ["pattern"],
  },
};

export const searchCodeHandler: ToolHandler = {
  definition: searchCodeDefinition,
  async execute(input, chatSession, currentUser) {
    const pattern = input.pattern as string;
    if (!pattern) {
      return { output: 'Missing required parameter: pattern', isError: true };
    }

    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const contextLines = input.context_lines as number | undefined;

    const result = await searchCode(
      currentUser,
      sessionModel.repository_id,
      chatSession.commitHash,
      pattern,
      contextLines !== undefined ? { contextLines } : undefined,
    );

    return { output: formatSearchResults(result) };
  },
};
