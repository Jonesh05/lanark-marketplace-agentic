/**
 * Azure OpenAI chat model for the Lanark agent.
 *
 * Env:
 *   AZURE_OPENAI_API_KEY
 *   AZURE_OPENAI_ENDPOINT  (https://{resource}.openai.azure.com)
 *   AZURE_OPENAI_DEPLOYMENT_NAME
 *
 * HTTP headers must be Latin-1 (ByteString). Never copy request / SDK headers
 * into outbound Azure calls - Unicode in tool payloads caused production crashes.
 */

import { createAzure } from "@ai-sdk/azure"

const apiKey = process.env.AZURE_OPENAI_API_KEY
const endpoint = process.env.AZURE_OPENAI_ENDPOINT
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? "gpt-4o-mini"

const isConfigured = Boolean(apiKey && endpoint && deploymentName)

if (!isConfigured) {
  console.warn(
    "[lanark] Azure OpenAI is not fully configured. Missing one of: " +
      "AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME",
  )
}

function resourceNameFromEndpoint(ep: string): string {
  const m = ep.replace(/\/+$/, "").match(/https:\/\/([^.]+)\.openai\.azure\.com/i)
  return m?.[1] ?? ""
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  if (typeof Request !== "undefined" && input instanceof Request) return input.url
  return String(input)
}

/** Azure outbound fetch: only Content-Type + api-key. No copied headers. */
function azureFetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const urlObj = new URL(resolveFetchUrl(input))
  urlObj.searchParams.set("api-version", "2024-10-21")

  const headers = new Headers()
  headers.set("Content-Type", "application/json")
  headers.set("api-key", apiKey ?? "")

  return fetch(urlObj.toString(), {
    method: options?.method ?? "POST",
    body: options?.body,
    signal: options?.signal,
    headers,
  })
}

const azure = createAzure({
  apiKey: apiKey ?? "",
  resourceName: resourceNameFromEndpoint(endpoint ?? ""),
  apiVersion: "2024-10-21",
  useDeploymentBasedUrls: true,
  fetch: azureFetch,
})

export const azureChatModel = azure.chat(deploymentName)

export const AZURE_DEPLOYMENT_NAME = deploymentName
export const AZURE_OPENAI_CONFIGURED = isConfigured
