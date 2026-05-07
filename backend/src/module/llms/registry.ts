import { readFileSync } from "fs";
import { join } from "path";
import type { AiSdkProvider } from "./ai_sdk_client";

interface LlmModel {
  name: string;
  code: string;
}

interface CoreProviderEntry {
  providerName: string;
  displayName: string;
  docsLink: string;
  modelsDocsLink: string;
  models: LlmModel[];
}

interface OpenAICompatibleProviderEntry extends CoreProviderEntry {
  baseURL: string;
  notes?: string;
}

export interface LlmsJson {
  coreProviders: CoreProviderEntry[];
  openAICompatibleProviders: OpenAICompatibleProviderEntry[];
}

export type ProviderKind = "core" | "compatible";

export interface ProviderEntry {
  kind: ProviderKind;
  providerName: string;
  displayName: string;
  baseURL?: string;
  models: LlmModel[];
  /** AiSdkProvider value to pass to AiSdkLLMClient */
  aiSdkProvider: AiSdkProvider;
}

const CORE_PROVIDER_MAP: Record<string, AiSdkProvider> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  xai: "xai",
};

let cached: { json: LlmsJson; index: Map<string, ProviderEntry> } | null = null;

function load(): { json: LlmsJson; index: Map<string, ProviderEntry> } {
  if (cached) return cached;

  const path = join(process.cwd(), "resource", "llms.json");
  const json = JSON.parse(readFileSync(path, "utf-8")) as LlmsJson;

  const index = new Map<string, ProviderEntry>();

  for (const p of json.coreProviders) {
    const aiSdkProvider = CORE_PROVIDER_MAP[p.providerName];
    if (!aiSdkProvider) {
      throw new Error(
        `Core provider "${p.providerName}" in llms.json has no AiSdkProvider mapping`,
      );
    }
    index.set(p.providerName, {
      kind: "core",
      providerName: p.providerName,
      displayName: p.displayName,
      models: p.models,
      aiSdkProvider,
    });
  }

  for (const p of json.openAICompatibleProviders) {
    index.set(p.providerName, {
      kind: "compatible",
      providerName: p.providerName,
      displayName: p.displayName,
      baseURL: p.baseURL,
      models: p.models,
      aiSdkProvider: "openai-compatible",
    });
  }

  cached = { json, index };
  return cached;
}

export function getLlmsJson(): LlmsJson {
  return load().json;
}

export function lookupProvider(providerName: string): ProviderEntry | null {
  return load().index.get(providerName) ?? null;
}

export class UnknownProviderError extends Error {
  code = "unknown_provider";
  constructor(providerName: string) {
    super(`Unknown LLM provider: ${providerName}`);
  }
}

export function requireProvider(providerName: string): ProviderEntry {
  const entry = lookupProvider(providerName);
  if (!entry) throw new UnknownProviderError(providerName);
  return entry;
}
