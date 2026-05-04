import { createAzure } from "@ai-sdk/azure"

/**
 * Azure OpenAI provider for the Lanark agent.
 *
 * Uses @ai-sdk/azure which is purpose-built for Azure OpenAI and correctly
 * routes to /chat/completions (not /responses like @ai-sdk/openai).
 *
 * Required env vars (configured in .env.local / Vercel project settings):
 *   - AZURE_OPENAI_API_KEY         : the Azure OpenAI resource key
 *   - AZURE_OPENAI_ENDPOINT        : e.g. https://jons-lanark-ai.openai.azure.com
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
 * Extract the resource name from the endpoint URL.
 * e.g. https://jons-lanark-ai.openai.azure.com → jons-lanark-ai
 */
function extractResourceName(endpointUrl: string): string {
  try {
    const url = new URL(endpointUrl)
    const parts = url.hostname.split(".")
    return parts[0] // e.g. "jons-lanark-ai"
  } catch {
    return endpointUrl
  }
}

/**
 * Create the Azure OpenAI provider.
 *
 * IMPORTANT: We use azure.chat() (not azure()) to ensure the SDK uses
 * the /chat/completions endpoint. The default azure() uses /responses
 * which Azure does not support with api-version 2024-10-21.
 */
const azure = createAzure({
  resourceName: extractResourceName(endpoint ?? ""),
  apiKey: apiKey ?? "",
  apiVersion: "2024-10-21",
})

/**
 * Pre-bound chat model pointing at the configured Azure deployment.
 * Use this everywhere instead of hard-coding the deployment name.
 *
 * We call azure.chat(deployment) to force chat completions endpoint.
 */
export const azureChatModel = azure.chat(deploymentName)

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = Boolean(
  apiKey && endpoint && deploymentName,
)
