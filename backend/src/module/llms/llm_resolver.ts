import LlmCredential from "@/database/llm_credential";
import { AiSdkLLMClient, type AiSdkLLMClientConfig } from "./ai_sdk_client";
import { decryptApiKey } from "./api_key_crypto";
import { requireProvider, type ProviderEntry } from "./registry";
import type { LLMStreamEvent } from "../ai_agent/types";

export class LlmCredentialNotFoundError extends Error {
  code = "llm_credential_not_found";
  constructor(teamId: string) {
    super(`No LLM credential, please add one for your team in the LLM management page.`);
  }
}

interface ResolvedSelection {
  providerName: string;
  modelCode: string;
  apiKey: string;
}

async function loadSelection(teamId: string): Promise<ResolvedSelection> {
  const cred = await LlmCredential.findOne({ where: { team_id: teamId } });
  if (!cred) throw new LlmCredentialNotFoundError(teamId);
  return {
    providerName: cred.provider_name,
    modelCode: cred.model_code,
    apiKey: decryptApiKey(cred.encrypted_api_key),
  };
}

export function buildAiSdkConfig(
  selection: ResolvedSelection,
  entry: ProviderEntry,
): AiSdkLLMClientConfig {
  if (entry.kind === "core") {
    return {
      provider: entry.aiSdkProvider,
      model: selection.modelCode,
      apiKey: selection.apiKey,
    };
  }

  if (!entry.baseURL) {
    throw new Error(
      `openai-compatible provider "${entry.providerName}" missing baseURL in registry`,
    );
  }

  return {
    provider: "openai-compatible",
    providerName: entry.providerName,
    baseURL: entry.baseURL,
    model: selection.modelCode,
    apiKey: selection.apiKey,
  };
}

/** Build an LLM client from the team's stored selection. */
export async function buildClientForTeam(teamId: string): Promise<AiSdkLLMClient> {
  const selection = await loadSelection(teamId);
  const entry = requireProvider(selection.providerName);
  return new AiSdkLLMClient(buildAiSdkConfig(selection, entry));
}

/** Build a client from explicit selection (used by validation probe before saving). */
export function buildClientFromSelection(
  providerName: string,
  modelCode: string,
  apiKey: string,
): AiSdkLLMClient {
  const entry = requireProvider(providerName);
  return new AiSdkLLMClient(
    buildAiSdkConfig({ providerName, modelCode, apiKey }, entry),
  );
}

/**
 * Validate a selection by running a tiny stream against the model.
 * Throws on failure with the underlying provider error.
 */
export async function probeSelection(
  providerName: string,
  modelCode: string,
  apiKey: string,
): Promise<void> {
  const client = buildClientFromSelection(providerName, modelCode, apiKey);
  const stream = client.stream({
    system: "Reply with the single word: ok.",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "ping" }],
      },
    ],
    tools: [],
  });

  for await (const event of stream as AsyncIterable<LLMStreamEvent>) {
    if (event.type === "error") {
      throw event.error;
    }
    if (event.type === "message_end") {
      return;
    }
  }
}
