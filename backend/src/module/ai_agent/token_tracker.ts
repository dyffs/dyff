import { TokenUsageSnapshot } from "./types";

/**
 * Tracks token usage across multiple LLM turns within a single agent run.
 * Used for budget enforcement and usage reporting.
 */
export class TokenUsageTracker {
  private _input = 0;
  private _output = 0;
  private _contextTokens = 0;

  constructor(initialUsage?: TokenUsageSnapshot) {
    if (initialUsage) {
      this._input = initialUsage.inputTokens;
      this._output = initialUsage.outputTokens;
      this._contextTokens = initialUsage.contextTokens ?? 0;
    }
  }

  /** Record usage from a single LLM turn */
  add(usage: { inputTokens: number; outputTokens: number }) {
    this._input += usage.inputTokens;
    this._output += usage.outputTokens;
    // The latest turn's inputTokens approximates the current context window size
    this._contextTokens = usage.inputTokens;
  }

  /** Current context window size (input tokens from the most recent turn) */
  get contextTokens(): number {
    return this._contextTokens;
  }

  get snapshot(): TokenUsageSnapshot {
    return {
      inputTokens: this._input,
      outputTokens: this._output,
      totalTokens: this._input + this._output,
      contextTokens: this._contextTokens,
    };
  }

  /** Check if we've exceeded the budget */
  exceeds(maxTokens: number): boolean {
    return this._input + this._output >= maxTokens;
  }
}
