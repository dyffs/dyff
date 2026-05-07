import express, { Request, Response } from "express";
import { requestContext } from "@/service/requestContext";
import LlmCredential from "@/database/llm_credential";
import { getLlmsJson, lookupProvider } from "@/module/llms/registry";
import { encryptApiKey } from "@/module/llms/api_key_crypto";
import { probeSelection } from "@/module/llms/llm_resolver";
import { logger } from "@/service/logger";

const router = express.Router();

router.get("/providers", (_req: Request, res: Response) => {
  return res.status(200).json(getLlmsJson());
});

router.get("/credentials", async (_req: Request, res: Response) => {
  const user = requestContext.currentUser();

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to view LLM credentials' });
  }

  const cred = await LlmCredential.findOne({ where: { team_id: user.team_id } });

  if (!cred) {
    return res.status(200).json(null);
  }

  return res.status(200).json({
    provider_name: cred.provider_name,
    model_code: cred.model_code,
    has_api_key: true,
    updated_at: cred.updated_at,
  });
});

router.post("/credentials", async (req: Request, res: Response) => {
  const user = requestContext.currentUser();

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to create LLM credentials' });
  }

  const { provider_name, model_code, api_key } = req.body ?? {};

  if (typeof provider_name !== "string" || typeof model_code !== "string" || typeof api_key !== "string") {
    return res.status(400).json({ error: "provider_name, model_code, api_key are required" });
  }

  const entry = lookupProvider(provider_name);
  if (!entry) {
    return res.status(400).json({ error: `Unknown provider: ${provider_name}` });
  }

  try {
    await probeSelection(provider_name, model_code, api_key);
  } catch (err) {
    logger.warn("LLM credential probe failed", { provider_name, model_code, err });
    return res.status(400).json({
      error: "Credential validation failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const encrypted = encryptApiKey(api_key);
  const [cred] = await LlmCredential.upsert({
    team_id: user.team_id,
    provider_name,
    model_code,
    encrypted_api_key: encrypted,
  });

  return res.status(200).json({
    provider_name: cred.provider_name,
    model_code: cred.model_code,
    has_api_key: true,
    updated_at: cred.updated_at,
  });
});

router.delete("/credentials", async (_req: Request, res: Response) => {
  const user = requestContext.currentUser();

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to delete LLM credentials' });
  }

  const deleted = await LlmCredential.destroy({ where: { team_id: user.team_id } });
  return res.status(200).json({ deleted });
});

export default router;
