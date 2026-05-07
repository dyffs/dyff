import { describe, it, expect } from "vitest";
import { MessagePipeline } from "./message_pipeline";

const pipeline = new MessagePipeline(null as any);

describe("MessagePipeline.parse", () => {
  it("parses plain text with no references", () => {
    expect(pipeline.parse("hello world")).toEqual([
      { kind: "text", value: "hello world" },
    ]);
  });

  it("parses empty string", () => {
    expect(pipeline.parse("")).toEqual([]);
  });

  it("parses system_prompt reference", () => {
    expect(pipeline.parse("@__FAST__PR__SYSTEM_PROMPT")).toEqual([
      {
        kind: "reference",
        value: "@__FAST__PR__SYSTEM_PROMPT",
        ref: { type: "system_prompt", name: "__FAST__PR__SYSTEM_PROMPT" },
      },
    ]);
  });

  it("parses commit hash reference", () => {
    expect(pipeline.parse("check @commit_7fc5f3a please")).toEqual([
      { kind: "text", value: "check " },
      {
        kind: "reference",
        value: "@commit_7fc5f3a",
        ref: { type: "commit", hash: "7fc5f3a" },
      },
      { kind: "text", value: " please" },
    ]);
  });

  it("parses file references", () => {
    expect(pipeline.parse("see @file_a.ts and @src/file_b.ts")).toEqual([
      { kind: "text", value: "see " },
      {
        kind: "reference",
        value: "@file_a.ts",
        ref: { type: "file", path: "file_a.ts" },
      },
      { kind: "text", value: " and " },
      {
        kind: "reference",
        value: "@src/file_b.ts",
        ref: { type: "file", path: "src/file_b.ts" },
      },
    ]);
  });

  it("parses links", () => {
    const segments = pipeline.parse("visit https://dyff.sh/comments/123");
    expect(segments).toEqual([
      { kind: "text", value: "visit " },
      {
        kind: "reference",
        value: "https://dyff.sh/comments/123",
        ref: { type: "link", url: "https://dyff.sh/comments/123" },
      },
    ]);
  });

  it("parses www links", () => {
    const segments = pipeline.parse("go to www.example.com/page");
    expect(segments).toEqual([
      { kind: "text", value: "go to " },
      {
        kind: "reference",
        value: "www.example.com/page",
        ref: { type: "link", url: "www.example.com/page" },
      },
    ]);
  });

  it("system_prompt takes priority over file pattern", () => {
    const segments = pipeline.parse("@__FAST__PR__SYSTEM_PROMPT");
    expect(segments[0].ref?.type).toBe("system_prompt");
  });

  it("commit takes priority over file pattern", () => {
    const segments = pipeline.parse("@commit_abc1234");
    expect(segments[0].ref?.type).toBe("commit");
  });

  it("parses multiple mixed references", () => {
    const raw =
      "@__FAST__PR__SYSTEM_PROMPT review @commit_1a2b3c4 in @src/index.ts see https://dyff.sh/pr/1";
    const segments = pipeline.parse(raw);
    const types = segments
      .filter((s) => s.kind === "reference")
      .map((s) => s.ref?.type);
    expect(types).toEqual(["system_prompt", "commit", "file", "link"]);
  });

  it("handles adjacent references", () => {
    const segments = pipeline.parse("@file_a.ts @file_b.ts");
    expect(segments).toEqual([
      {
        kind: "reference",
        value: "@file_a.ts",
        ref: { type: "file", path: "file_a.ts" },
      },
      { kind: "text", value: " " },
      {
        kind: "reference",
        value: "@file_b.ts",
        ref: { type: "file", path: "file_b.ts" },
      },
    ]);
  });
});
