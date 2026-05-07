import { ChatSession, ContextReference } from "../ai_agent/types";
import User from "@/database/user";
import { readFiles } from "@/service/git_read_files";

/**
 * ContextResolver: given a reference and a scope, produces content.
 * Each reference type has a resolver function.
 */
export interface ContextResolver {
  resolve(ref: ContextReference, chatSession: ChatSession): Promise<string>;

  // Order of the results is guaranteed to be the same as the order of the references.
  batchResolve(refs: ContextReference[], chatSession: ChatSession): Promise<string[]>;
}

/**
 * Registry of resolvers for different reference types.
 *
 * Holds per-session context (user, repositoryId, commitSha) needed
 * to resolve references like file paths against the correct repo state.
 */
export class ContextResolverRegistry implements ContextResolver {
  constructor(
    private user: User,
    private repositoryId: string,
  ) {}

  async resolve(ref: ContextReference, chatSession: ChatSession): Promise<string> {
    const [result] = await this.batchResolve([ref], chatSession);
    return result;
  }

  async batchResolve(refs: ContextReference[], chatSession: ChatSession): Promise<string[]> {
    if (refs.length === 0) return [];

    // Collect file refs with their original indices so we can batch them
    const fileIndices: number[] = [];
    const filePaths: string[] = [];

    for (let i = 0; i < refs.length; i++) {
      if (refs[i].type === "file") {
        fileIndices.push(i);
        filePaths.push((refs[i] as { type: "file"; path: string }).path);
      }
    }

    // Batch-read all files in a single call
    let fileContents: Record<string, string | null> = {};
    if (filePaths.length > 0) {
      fileContents = await readFiles(
        this.user,
        this.repositoryId,
        filePaths,
        chatSession.commitHash,
      );
    }

    // Build results in the same order as the input refs
    const results: string[] = new Array(refs.length);

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      switch (ref.type) {
        case "file": {
          const content = fileContents[ref.path];
          results[i] = content ?? `[file not found: ${ref.path}]`;
          break;
        }
        case "commit":
        case "link":
        case "system_prompt":
          // Not yet implemented — return empty string
          results[i] = "";
          break;
      }
    }

    return results;
  }
}
