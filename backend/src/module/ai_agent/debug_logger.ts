// =============================================================================
// Agent Debug Logger — tail -f friendly debug logging for the agent loop
// =============================================================================

import { createLogger, format, transports, Logger } from "winston";

const LOG_PATH = process.env.AGENT_DEBUG_LOG ?? "./logs/agent_debug.log";

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `… (${text.length} chars)`;
}

function createWinstonLogger(): Logger {
  return createLogger({
    level: "debug",
    format: format.combine(
      format.timestamp({ format: "HH:mm:ss.SSS" }),
      format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`),
    ),
    transports: [
      new transports.File({ filename: LOG_PATH, maxsize: 5_000_000, maxFiles: 3 }),
    ],
  });
}

class AgentDebugLogger {
  private logger: Logger | null;

  constructor() {
    this.logger = createWinstonLogger();
  }

  get enabled(): boolean {
    return this.logger !== null;
  }

  turnStart(turn: number, sessionId: string): void {
    this.logger?.info(`── Turn ${turn} ── session=${sessionId}`);
  }

  llmRequest(messageCount: number, toolCount: number): void {
    this.logger?.debug(`LLM request: ${messageCount} messages, ${toolCount} tool defs`);
  }

  llmRetry(attempt: number, maxRetries: number, error: unknown): void {
    this.logger?.warn(
      `LLM retry ${attempt}/${maxRetries}: ${String(error).slice(0, 200)}`,
    );
  }

  llmEvent(eventType: string, summary: string): void {
    this.logger?.debug(`LLM event [${eventType}]: ${summary}`);
  }

  llmComplete(usage: { inputTokens: number; outputTokens: number } | null): void {
    if (usage) {
      this.logger?.info(
        `LLM complete: in=${usage.inputTokens} out=${usage.outputTokens} total=${usage.inputTokens + usage.outputTokens}`,
      );
    } else {
      this.logger?.info("LLM complete: no usage data");
    }
  }

  toolExecStart(name: string, inputSummary: string): void {
    this.logger?.info(`Tool START [${name}]: ${truncate(inputSummary)}`);
  }

  toolExecEnd(name: string, outputPreview: string): void {
    this.logger?.info(`Tool END   [${name}]: ${truncate(outputPreview)}`);
  }

  error(code: string, message: string): void {
    this.logger?.error(`[${code}] ${message}`);
  }

  cancelled(): void {
    this.logger?.warn("Agent cancelled");
  }

  sessionStatus(status: string): void {
    this.logger?.info(`Session status → ${status}`);
  }

  userMessage(preview: string): void {
    this.logger?.info(`User message: ${truncate(preview)}`);
  }

  tokenBudget(current: number, max: number): void {
    this.logger?.debug(`Token budget: ${current}/${max}`);
  }

  contextPruned(filePaths: string[], content: string): void {
    const approximateContextTokens = Math.round(content.length / 4);
    this.logger?.info(`Context pruned: ~${approximateContextTokens} tokens`);
  }

  maxTurnsExceeded(): void {
    this.logger?.warn("Max turns exceeded");
  }
}

export const agentDebug = new AgentDebugLogger();
