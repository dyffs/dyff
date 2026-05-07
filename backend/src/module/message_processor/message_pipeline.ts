import { ContextResolver } from "./context_resolver";
import { ParsedSegment, LLMContentBlock, ChatSession } from "../ai_agent/types";

/**
 * MessagePipeline handles the transformation of messages:
 * 1. Parse: raw string → segments with @references
 * 2. Enrich: resolve @references into actual content
 * 3. Serialize: segments → raw string
 */
export class MessagePipeline {
  constructor(private resolver: ContextResolver) { }

  /** Parse a raw message string into segments with identified references */
  parse(raw: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    // Priority order: system_prompt, commit_hash, file (all @-prefixed), then link
    const pattern =
      /(@__FAST__PR__SYSTEM_PROMPT)|(@commit_[0-9a-f]{7})|(@\S+)|(https?:\/\/\S+|www\.\S+)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(raw)) !== null) {
      // Push preceding text
      if (match.index > lastIndex) {
        segments.push({
          kind: "text",
          value: raw.slice(lastIndex, match.index),
        });
      }

      const matched = match[0];
      if (match[1]) {
        // system_prompt
        segments.push({
          kind: "reference",
          value: matched,
          ref: { type: "system_prompt", name: matched.slice(1) },
        });
      } else if (match[2]) {
        // commit_hash
        segments.push({
          kind: "reference",
          value: matched,
          ref: { type: "commit", hash: matched.slice("@commit_".length) },
        });
      } else if (match[3]) {
        // file
        segments.push({
          kind: "reference",
          value: matched,
          ref: { type: "file", path: matched.slice(1) },
        });
      } else if (match[4]) {
        // link
        segments.push({
          kind: "reference",
          value: matched,
          ref: { type: "link", url: matched },
        });
      }

      lastIndex = pattern.lastIndex;
    }

    // Push trailing text
    if (lastIndex < raw.length) {
      segments.push({ kind: "text", value: raw.slice(lastIndex) });
    }

    return segments;
  }

  /** Enrich parsed segments by resolving all references into content */
  async enrich(
    segments: ParsedSegment[],
    chatSession: ChatSession
  ): Promise<LLMContentBlock[]> {
    // Collect all refs and batch-resolve them in one go
    const refSegments: { index: number; segment: ParsedSegment }[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].kind === "reference" && segments[i].ref) {
        refSegments.push({ index: i, segment: segments[i] });
      }
    }

    let accumulatedText = segments.map((s) => s.value).join("");

    const resolvedContents = await this.resolver.batchResolve(
      refSegments.map((r) => r.segment.ref!),
      chatSession
    );

    // Build a lookup: segment index → resolved content
    const resolvedMap = new Map<number, string>();
    for (let i = 0; i < refSegments.length; i++) {
      resolvedMap.set(refSegments[i].index, resolvedContents[i]);
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.ref) {
        const content = resolvedMap.get(i) ?? "";

        if (content) {
          accumulatedText += `\n<context ref="${segment.value}">\n${content}\n</context>\n`;
        }
      }
    }

    const textBlock: LLMContentBlock = {
      type: "text",
      text: accumulatedText,
    };

    return [textBlock];
  }

  /** Serialize parsed segments back to a raw message string */
  serialize(segments: ParsedSegment[]): string {
    return segments.map((s) => s.value).join("");
  }
}
