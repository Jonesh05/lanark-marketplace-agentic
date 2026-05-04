import { createOpenAI } from "@ai-sdk/openai"

/**
 * Azure OpenAI provider for the Lanark agent.
 *
 * Uses the @ai-sdk/openai provider with a custom baseURL pointing at
 * Azure's chat completions endpoint. This is the recommended pattern
 * for AI SDK 6 with Azure OpenAI.
 *
 * Required env vars (configured in .env.local / Vercel project settings):
 *   - AZURE_OPENAI_API_KEY         : the Azure OpenAI resource key
 *   - AZURE_OPENAI_ENDPOINT        : e.g. https://my-resource.openai.azure.com
 *   - AZURE_OPENAI_DEPLOYMENT_NAME : the deployment id (e.g. gpt-4o-mini)
 */

const apiKey = process.env.AZURE_OPENAI_API_KEY
const endpoint = process.env.AZURE_OPENAI_ENDPOINT
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? "gpt-4o-mini"

if (!apiKey || !endpoint || !deploymentName) {
  console.error(
    "[v0] Azure OpenAI is not fully configured. Missing one of: " +
      "AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME",
  )
}

/**
 * Construct the Azure OpenAI base URL for chat completions.
 * Format: https://<resource>.openai.azure.com/openai/deployments/<deployment>
 *
 * The api-version is appended by the provider as a query param.
 */
function buildAzureBaseUrl(rawEndpoint: string, deployment: string): string {
  // Normalise endpoint: strip trailing slash
  const base = rawEndpoint.replace(/\/+$/, "")
  return `${base}/openai/deployments/${deployment}`
}

/**
 * Create an AI SDK-compatible provider that hits Azure OpenAI.
 *
 * We use createOpenAI with:
 *   - baseURL pointing to the Azure deployment
 *   - apiKey set to the Azure resource key
 *   - compatibility mode "compatible" (Azure uses OpenAI-compatible API)
 */
const azureProvider = createOpenAI({
  baseURL: buildAzureBaseUrl(endpoint ?? "", deploymentName),
  apiKey: apiKey ?? "",
  compatibility: "compatible",
  // Azure requires api-version as a query param. The provider appends it
  // automatically when we set the fetch override to include it.
  fetch: async (url, options) => {
    const urlWithVersion = new URL(url as string)
    urlWithVersion.searchParams.set("api-version", "2024-10-21")
    return fetch(urlWithVersion.toString(), options)
  },
})

/**
 * Pre-bound chat model pointing at the configured Azure deployment.
 * Use this everywhere instead of hard-coding the deployment name.
 *
 * The model ID passed to azureProvider() is ignored when using a custom
 * baseURL that already includes the deployment, but we pass it for clarity.
 */
export const azureChatModel = azureProvider("gpt-4o-mini")

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = Boolean(
  apiKey && endpoint && deploymentName,
)
