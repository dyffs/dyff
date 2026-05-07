export interface LlmProviderModel {
  name: string
  code: string
}

export interface LlmCoreProvider {
  providerName: string
  displayName: string
  docsLink: string
  modelsDocsLink: string
  models: LlmProviderModel[]
}

export interface LlmOpenAICompatibleProvider {
  providerName: string
  displayName: string
  baseURL: string
  docsLink: string
  modelsDocsLink: string
  models: LlmProviderModel[]
  notes?: string
}

export interface LlmProviders {
  coreProviders: LlmCoreProvider[]
  openAICompatibleProviders: LlmOpenAICompatibleProvider[]
}

export interface LlmCredential {
  provider_name: string
  model_code: string
  has_api_key: boolean
  updated_at: string
}