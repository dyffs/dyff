import type { ToolDefinition } from '../ai_agent/types';
import type { ToolHandler } from './tool_registry';
import ChatSessionModel from '@/database/chat_session';

const reviewNotesDefinition: ToolDefinition = {
  name: "review_notes",
  description: "Manage persistent review notes for the current PR review session. Supports reading the note, appending the note. You can also mark a file as reviewed to avoid reviewing it again",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["read", "append"],
        description: "The operation to perform: 'read' returns the note, 'append' adds the note's content. 'append' can receive mark_reviewed as an array of file paths to mark as reviewed.",
      },
      content: {
        type: "string",
        description: "The content to append. Required for 'append' operation.",
      },
      mark_reviewed: {
        type: "array",
        items: { type: "string" },
        description: "List of file paths to mark as reviewed. Can be used alongside 'append' operation. E.g. ['src/file1.ts', 'file2.ts']",
      },
    },
    required: ["operation"],
  },
};

export const reviewNotesHandler: ToolHandler = {
  definition: reviewNotesDefinition,
  async execute(input, chatSession) {
    const operation = input.operation as string;
    const content = input.content as string | undefined;
    const noteId = 'main';
    const markReviewed = input.mark_reviewed as string[] | undefined;

    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const existing = sessionModel.agent_review_notes ?? {
      notes: {},
      reviewed_files: [],
      updated_at: new Date(),
      commit_hash: chatSession.commitHash,
    };
    existing.reviewed_files ??= [];

    const outputParts: string[] = [];

    if (operation === 'read') {
      const notesEntries = Object.entries(existing.notes);
      if (notesEntries.length === 0 && existing.reviewed_files.length === 0) {
        return { output: 'No review notes found.' };
      }
      const parts: string[] = [];
      if (notesEntries.length > 0) {
        parts.push(notesEntries.map(([id, text]) => `[${id}]\n${text}`).join('\n\n'));
      }
      if (existing.reviewed_files.length > 0) {
        parts.push(`[reviewed_files]\n${existing.reviewed_files.join('\n')}`);
      }
      return { output: parts.join('\n\n') };
    }

    // Handle mark_reviewed (can accompany any operation)
    if (markReviewed && markReviewed.length > 0) {
      const fileSet = new Set(existing.reviewed_files);
      for (const file of markReviewed) {
        fileSet.add(file);
      }
      existing.reviewed_files = Array.from(fileSet);
      outputParts.push(`Marked ${markReviewed.length} file(s) as reviewed.`);
    }

    if (operation === 'append') {
      if (content === undefined || content === null) {
        return { output: 'Missing required parameter: content', isError: true };
      }

     existing.notes[noteId] = (existing.notes[noteId] ?? '') + content;

      existing.updated_at = new Date();
      existing.commit_hash = chatSession.commitHash;

      sessionModel.agent_review_notes = existing;
      sessionModel.changed('agent_review_notes', true);
      await sessionModel.save();

      outputParts.push(`Note "${noteId}" updated successfully.`);
      return { output: outputParts.join(' ') };
    }

    return { output: `Unknown operation: ${operation}. Use 'read', 'append'.`, isError: true };
  },
};
