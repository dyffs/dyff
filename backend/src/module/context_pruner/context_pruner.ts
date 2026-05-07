import type { StoredMessage } from '../ai_agent/types';
import type { PruningStrategy, PruningContext } from './types';

/**
 * Orchestrates context pruning by running a pipeline of strategies.
 * Each strategy receives the output of the previous one.
 */
export class ContextPruner {
  private strategies: PruningStrategy[];

  constructor(strategies: PruningStrategy[]) {
    this.strategies = strategies;
  }

  prune(context: PruningContext): StoredMessage[] {
    let messages = context.messages;

    for (const strategy of this.strategies) {
      messages = strategy.prune({ ...context, messages });
    }

    return messages;
  }
}
