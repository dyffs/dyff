import type { StoredMessage, LLMContentBlock } from '../ai_agent/types';
import type { PruningStrategy, PruningContext } from './types';
import { agentDebug } from '../ai_agent/debug_logger';

const CONTEXT_SIZE_TRIGGER_THRESHOLD = 30_000;

/**
 * Prunes tool results for files that have been marked as reviewed.
 *
 * Handles two tool types:
 * - `read_file`: input.path is a single file path
 * - `diff_content`: input.file_paths is an array of file paths (or omitted = all files)
 *
 * When ALL files referenced by a tool call are reviewed, the tool_result content
 * is replaced with a short summary. When only SOME files are reviewed (diff_content
 * with a mix), the result is kept intact since partial pruning would require
 * re-parsing the diff.
 */
export class ReviewedFilesPruningStrategy implements PruningStrategy {
  name = 'reviewed_files';

  prune(context: PruningContext): StoredMessage[] {
    const { messages, reviewedFiles } = context;

    if (reviewedFiles.length === 0) return messages;
    if ((context.contextTokens ?? 0) < CONTEXT_SIZE_TRIGGER_THRESHOLD) {
      return messages;
    }

    const reviewedSet = new Set(reviewedFiles);

    // Build a map of tool_use_id -> { toolName, filePaths } from assistant messages
    const toolCallFiles = new Map<string, { toolName: string; filePaths: string[] }>();

    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const block of msg.enriched) {
        if (block.type !== 'tool_use') continue;
        const filePaths = extractFilePaths(block);
        if (filePaths) {
          toolCallFiles.set(block.id, { toolName: block.name, filePaths });
        }
      }
    }

    // Now walk through messages and replace tool_result content where all files are reviewed
    const prunableToolCallIds = new Set<string>();
    for (const [id, info] of toolCallFiles) {
      if (info.filePaths.length > 0 && info.filePaths.every((f) => reviewedSet.has(f))) {
        prunableToolCallIds.add(id);
      }
    }

    if (prunableToolCallIds.size === 0) return messages;

    return messages.map((msg) => {
      if (msg.role !== 'tool_result') return msg;

      const toolResultBlock = msg.enriched.find((b) => b.type === 'tool_result');
      if (!toolResultBlock || toolResultBlock.type !== 'tool_result') return msg;

      const toolUseId = toolResultBlock.tool_use_id;
      if (!prunableToolCallIds.has(toolUseId)) return msg;

      const info = toolCallFiles.get(toolUseId)!;
      agentDebug.contextPruned(info.filePaths, toolResultBlock.content);
      const summary = `[Content pruned — ${info.filePaths.length} file(s) already reviewed: ${info.filePaths.join(', ')}]`;

      const newEnriched: LLMContentBlock[] = msg.enriched.map((b) => {
        if (b.type === 'tool_result' && b.tool_use_id === toolUseId) {
          return { ...b, content: summary };
        }
        return b;
      });

      return {
        ...msg,
        enriched: newEnriched,
      };
    });
  }
}

/**
 * Extract file paths from a tool_use block, if it's a file-reading tool.
 * Returns null for unrecognized tools.
 */
function extractFilePaths(
  block: Extract<LLMContentBlock, { type: 'tool_use' }>,
): string[] | null {
  const input = block.input;

  switch (block.name) {
    case 'read_file': {
      const path = input.path;
      return typeof path === 'string' ? [path] : null;
    }
    case 'diff_content': {
      const filePaths = input.file_paths;
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        return filePaths as string[];
      }
      // No file_paths means "all files" — we can't prune this since we don't
      // know exactly which files are in the result without parsing the diff
      return null;
    }
    default:
      return null;
  }
}
