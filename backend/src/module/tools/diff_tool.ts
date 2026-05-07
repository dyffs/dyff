import type { ToolDefinition } from '../ai_agent/types';
import type { ToolHandler } from './tool_registry';
import { getDiffOverview, getDiffContent, type DiffFileStatus } from '@/service/git_diff';
import { readFiles } from '@/service/git_read_files';
import ChatSessionModel from '@/database/chat_session';
import PullRequest from '@/database/pull_request';

// Tool 1: Diff Overview
const diffOverviewDefinition: ToolDefinition = {
  name: "diff_overview",
  description: "Get a file-level summary of all changes in this PR. Returns each changed file with the number of lines added and deleted. Use this to understand the scope of the PR before diving into specific files.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const STATUS_LABELS: Record<DiffFileStatus, string> = {
  added: 'ADDED',
  deleted: 'DELETED',
  modified: 'MODIFIED',
  renamed: 'RENAMED',
};

const DIFF_HEADER_PATTERN = /^(diff --git |index |new file mode |deleted file mode |old mode |new mode |similarity index |rename from |rename to |--- (a\/|\/dev\/null)|\+\+\+ (b\/|\/dev\/null))/;

/**
 * Strip git diff metadata headers from a single file's diff section.
 * Keeps @@ hunk headers and actual diff content (+/-/context lines).
 */
function stripDiffHeaders(fileDiff: string): string {
  return fileDiff
    .split('\n')
    .filter((line) => !DIFF_HEADER_PATTERN.test(line))
    .join('\n');
}

function countLinesAndWords(content: string): { lines: number; words: number } {
  const lines = content.split('\n').length;
  const words = content.split(/\s+/).filter(Boolean).length;
  return { lines, words };
}

export const diffOverviewHandler: ToolHandler = {
  definition: diffOverviewDefinition,
  async execute(_, chatSession, currentUser) {
    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const pullRequest = await PullRequest.findByPk(sessionModel.pull_request_id);
    if (!pullRequest) {
      return { output: 'Pull request not found', isError: true };
    }

    const repositoryId = sessionModel.repository_id;
    const headCommit = pullRequest.head_commit_sha;

    const stats = await getDiffOverview(
      currentUser,
      repositoryId,
      pullRequest.base_branch,
      headCommit,
    );

    if (stats.length === 0) {
      return { output: 'No changes found in this PR. PR status is: ' + pullRequest.github_status };
    }

    // Read current file contents at head commit for non-deleted files
    const filesToRead = stats
      .filter((s) => s.status !== 'deleted')
      .map((s) => s.path);

    const fileContents = filesToRead.length > 0
      ? await readFiles(currentUser, repositoryId, filesToRead, headCommit)
      : {};

    // Build LLM-friendly output
    const lines: string[] = [];

    let totalAdditions = 0;
    let totalDeletions = 0;
    let addedCount = 0;
    let deletedCount = 0;
    let modifiedCount = 0;
    let renamedCount = 0;

    for (const s of stats) {
      totalAdditions += s.additions;
      totalDeletions += s.deletions;

      const statusLabel = STATUS_LABELS[s.status];
      let fileLine = `- [${statusLabel}] ${s.path}`;

      if (s.status === 'renamed' && s.renamedFrom) {
        fileLine += ` (from ${s.renamedFrom})`;
      }

      // Add diff stats
      fileLine += `  |  +${s.additions} -${s.deletions}`;

      // Add file size info for non-deleted files
      if (s.status !== 'deleted') {
        const content = fileContents[s.path];
        if (content != null) {
          const { lines: totalLines, words: totalWords } = countLinesAndWords(content);
          fileLine += `  |  file: ${totalLines} lines, ${totalWords} words`;
        }
      }

      lines.push(fileLine);

      switch (s.status) {
        case 'added': addedCount++; break;
        case 'deleted': deletedCount++; break;
        case 'modified': modifiedCount++; break;
        case 'renamed': renamedCount++; break;
      }
    }

    lines.push('');
    lines.push('**Summary**');
    lines.push(`${stats.length} files changed: +${totalAdditions} additions, -${totalDeletions} deletions`);

    const breakdown: string[] = [];
    if (addedCount > 0) breakdown.push(`${addedCount} added`);
    if (modifiedCount > 0) breakdown.push(`${modifiedCount} modified`);
    if (deletedCount > 0) breakdown.push(`${deletedCount} deleted`);
    if (renamedCount > 0) breakdown.push(`${renamedCount} renamed`);
    if (breakdown.length > 0) {
      lines.push(`Breakdown: ${breakdown.join(', ')}`);
    }

    return { output: lines.join('\n') };
  },
};

// Tool 2: Diff Content
const diffContentDefinition: ToolDefinition = {
  name: "diff_content",
  description: "Get the actual unified diff content for this PR. Optionally specify file paths to see only those files' diffs. Lock files and minified assets are excluded by default.",
  inputSchema: {
    type: "object",
    properties: {
      file_paths: {
        type: "array",
        items: { type: "string" },
        description: "Optional. Paths of specific files to get the diff for (e.g., ['src/index.ts', 'src/utils.ts']). If omitted, returns diff for all files.",
      },
    },
    required: [],
  },
};

export const diffContentHandler: ToolHandler = {
  definition: diffContentDefinition,
  async execute(input, chatSession, currentUser) {
    const sessionModel = await ChatSessionModel.findByPk(chatSession.id);
    if (!sessionModel) {
      return { output: 'Chat session not found', isError: true };
    }

    const pullRequest = await PullRequest.findByPk(sessionModel.pull_request_id);
    if (!pullRequest) {
      return { output: 'Pull request not found', isError: true };
    }

    const repositoryId = sessionModel.repository_id;
    const headCommit = pullRequest.head_commit_sha;
    const filePaths = input.file_paths as string[] | undefined;

    const [diff, stats] = await Promise.all([
      getDiffContent(
        currentUser,
        repositoryId,
        pullRequest.base_branch,
        headCommit,
        filePaths && filePaths.length > 0 ? { filePaths } : undefined,
      ),
      getDiffOverview(
        currentUser,
        repositoryId,
        pullRequest.base_branch,
        headCommit,
      ),
    ]);

    if (!diff) {
      const msg = filePaths && filePaths.length > 0
        ? `No changes found for file(s): ${filePaths.join(', ')}`
        : 'No changes found in this PR.';
      return { output: msg };
    }

    // Build a lookup from path -> stat
    const statsByPath = new Map(stats.map((s) => [s.path, s]));

    // Read current file contents for non-deleted files to provide size context
    const filePathSet = filePaths && filePaths.length > 0 ? new Set(filePaths) : null;
    const relevantStats = filePathSet
      ? stats.filter((s) => filePathSet.has(s.path))
      : stats;

    const filesToRead = relevantStats
      .filter((s) => s.status !== 'deleted')
      .map((s) => s.path);

    const fileContents = filesToRead.length > 0
      ? await readFiles(currentUser, repositoryId, filesToRead, headCommit)
      : {};

    // Split diff into per-file sections, strip git headers, and prepend stats
    const fileDiffs = diff.split(/(?=^diff --git )/m).filter((s) => s.trim());
    const outputParts: string[] = [];

    for (const fileDiff of fileDiffs) {
      // Extract path from "diff --git a/path b/path"
      const headerMatch = fileDiff.match(/^diff --git a\/.+ b\/(.+)$/m);
      const diffPath = headerMatch?.[1];
      const stat = diffPath ? statsByPath.get(diffPath) : undefined;

      // Strip git metadata headers, keep only @@ hunks and diff lines
      const strippedDiff = stripDiffHeaders(fileDiff);

      if (stat) {
        const statusLabel = STATUS_LABELS[stat.status];
        let contextLine = `[${statusLabel}] ${stat.path}  |  +${stat.additions} -${stat.deletions}`;

        if (stat.status === 'renamed' && stat.renamedFrom) {
          contextLine += ` (from ${stat.renamedFrom})`;
        }

        if (stat.status !== 'deleted') {
          const content = fileContents[stat.path];
          if (content != null) {
            const { lines: totalLines, words: totalWords } = countLinesAndWords(content);
            contextLine += `  |  file: ${totalLines} lines, ${totalWords} words`;
          }
        }

        outputParts.push(contextLine + '\n' + strippedDiff);
      } else {
        outputParts.push(strippedDiff);
      }
    }

    return { output: outputParts.join('\n') };
  },
};
