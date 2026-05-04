import { createAzure } from "@ai-sdk/azure"

/**
 * Azure OpenAI provider for the Sablon agent.
 *
 * Required env vars (configured in Vercel project settings):
 *   - AZURE_OPENAI_API_KEY            : the Azure OpenAI resource key
 *   - AZURE_OPENAI_ENDPOINT           : e.g. https://my-resource.openai.azure.com
 *   - AZURE_OPENAI_DEPLOYMENT_NAME    : the deployment id (e.g. gpt-4o-mini)
 */

const apiKey = process.env.AZURE_OPENAI_API_KEY
const endpoint = process.env.AZURE_OPENAI_ENDPOINT
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME

if (!apiKey || !endpoint || !deploymentName) {
  // Fail loudly at module load so the chat route doesn't return an empty
  // 500 (which causes "Unexpected end of JSON input" on the client).
  console.error(
    "[v0] Azure OpenAI is not fully configured. Missing one of: " +
      "AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME",
  )
}

/**
 * Extract the resource name from a full Azure endpoint, e.g.
 *   https://my-resource.openai.azure.com  ->  my-resource
 *   https://my-resource.openai.azure.com/ ->  my-resource
 *
 * The Azure provider also accepts a baseURL, but resourceName is the
 * canonical config and produces the correct path:
 *   https://<resource>.openai.azure.com/openai/deployments/<deployment>/...
 */
function deriveResourceName(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const host = url.hostname // e.g. my-resource.openai.azure.com
    const [first] = host.split(".")
    return first || undefined
  } catch {
    // Already a bare resource name (e.g. "my-resource") — pass through.
    return raw.replace(/^https?:\/\//, "").split(".")[0] || undefined
  }
}

export const azure = createAzure({
  resourceName: deriveResourceName(endpoint),
  apiKey: apiKey ?? "",
  // Pin to a recent stable API version that supports tool calling.
  apiVersion: "2024-10-21",
})

/**
 * Pre-bound chat model pointing at the configured deployment.
 * Use this everywhere instead of hard-coding the deployment name.
 */
export const azureChatModel = azure(deploymentName ?? "gpt-4o-mini")

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = Boolean(
  apiKey && endpoint && deploymentName,
)
