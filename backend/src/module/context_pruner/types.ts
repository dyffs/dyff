import type { StoredMessage } from '../ai_agent/types';

/**
 * Context available to pruning strategies for deciding what to prune.
 */
export interface PruningContext {
  /** All messages in the session */
  messages: StoredMessage[];
  /** Files the agent has marked as reviewed */
  reviewedFiles: string[];
  /** Current context window size in tokens (from the last LLM turn's input) */
  contextTokens?: number;
}

/**
 * A strategy that can prune/modify messages to reduce context size.
 * Strategies must return new message objects — never mutate the originals.
 */
export interface PruningStrategy {
  name: string;
  prune(context: PruningContext): StoredMessage[];
}
