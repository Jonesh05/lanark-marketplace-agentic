/**
 * AI Model configuration for the Lanark agent.
 *
 * The user has Azure OpenAI credentials configured:
 *   - AZURE_OPENAI_API_KEY
 *   - AZURE_OPENAI_ENDPOINT (e.g. https://jons-lanark-ai.openai.azure.com)
 *   - AZURE_OPENAI_DEPLOYMENT_NAME (e.g. gpt-4o-mini)
 *
 * Azure OpenAI uses a different endpoint structure than standard OpenAI:
 *   POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}
 *
 * We use @ai-sdk/openai with custom fetch to:
 * 1. Point baseURL to the deployment endpoint
 * 2. Append api-version query param
 * 3. Use api-key header (not Authorization Bearer)
 */

import { createOpenAI } from "@ai-sdk/openai"

const apiKey = process.env.AZURE_OPENAI_API_KEY
const endpoint = process.env.AZURE_OPENAI_ENDPOINT
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? "gpt-4o-mini"

const isConfigured = Boolean(apiKey && endpoint && deploymentName)

if (!isConfigured) {
  console.warn(
    "[v0] Azure OpenAI is not fully configured. Missing one of: " +
      "AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME",
  )
}

/**
 * Build the Azure OpenAI base URL for the deployment.
 * Azure expects: {endpoint}/openai/deployments/{deployment}/chat/completions
 */
function buildAzureBaseUrl(): string {
  const base = (endpoint ?? "").replace(/\/+$/, "")
  return `${base}/openai/deployments/${deploymentName}`
}

/**
 * Create an OpenAI-compatible provider that hits Azure OpenAI.
 *
 * Custom fetch handles:
 * - api-version query param
 * - api-key header (required by Azure, not Authorization Bearer)
 */
/**
 * HTTP headers must be ByteStrings (Latin-1). The AI SDK may pass through
 * header values containing Unicode (e.g. em-dashes from tool payloads), which
 * throws "Cannot convert argument to a ByteString…8212". Build a clean header
 * set instead of cloning options.headers wholesale.
 */
function azureFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const urlObj = new URL(url as string)
  urlObj.searchParams.set("api-version", "2024-10-21")

  const headers = new Headers()
  headers.set("api-key", apiKey ?? "")
  if (options?.body) {
    headers.set("content-type", "application/json")
  }

  return fetch(urlObj.toString(), {
    ...options,
    headers,
  })
}

const azureProvider = createOpenAI({
  baseURL: buildAzureBaseUrl(),
  apiKey: "", // Injected via api-key header in azureFetch
  fetch: azureFetch,
})

/**
 * Pre-bound chat model pointing at the configured Azure deployment.
 */
export const azureChatModel = azureProvider.chat(deploymentName)

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = isConfigured
