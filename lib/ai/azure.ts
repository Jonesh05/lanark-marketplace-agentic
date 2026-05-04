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
 * The @ai-sdk/azure provider is currently hitting the wrong endpoint (/v1/chat/completions).
 * As a workaround, we use the @ai-sdk/openai provider with a custom baseURL that directly
 * points to the deployment's chat completions endpoint, and inject api-version via headers.
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
 * Azure expects: {endpoint}/openai/deployments/{deployment}
 * The provider will append /chat/completions automatically.
 */
function buildAzureBaseUrl(): string {
  const base = (endpoint ?? "").replace(/\/+$/, "")
  return `${base}/openai/deployments/${deploymentName}`
}

/**
 * Create an OpenAI-compatible provider that hits Azure OpenAI.
 *
 * We override fetch to:
 * 1. Append ?api-version=2024-10-21 to all requests
 * 2. Add api-key header (Azure uses api-key, not Authorization Bearer)
 */
const azureProvider = createOpenAI({
  baseURL: buildAzureBaseUrl(),
  apiKey: apiKey ?? "",
  compatibility: "compatible",
  fetch: async (url, options) => {
    const urlObj = new URL(url as string)
    urlObj.searchParams.set("api-version", "2024-10-21")

    // Azure expects api-key header, not Authorization Bearer
    const headers = new Headers(options?.headers)
    headers.set("api-key", apiKey ?? "")
    headers.delete("Authorization") // Remove Bearer token if set

    return fetch(urlObj.toString(), {
      ...options,
      headers,
    })
  },
})

/**
 * Pre-bound chat model pointing at the configured Azure deployment.
 * The model name is ignored since the deployment is in the baseURL.
 */
export const azureChatModel = azureProvider.chat("gpt-4o-mini")

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = isConfigured
