"use client"

import { useState, useRef, useEffect, useId } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Loader2, Sparkles, Wrench } from "lucide-react"

const SUGGESTIONS_BY_ROLE: Record<"client" | "shopkeeper", string[]> = {
  client: [
    "What categories of products are available?",
    "Find smartphones under $500",
    "Place an offer of 10 cUSD on the iPhone 9",
    "What's my cUSD balance?",
    "Show my open offers",
  ],
  shopkeeper: [
    "List my live inventory",
    "Update the price of my MacBook to 8,500,000 COP",
    "Set the stock of my first product to 10",
    "Show me pending offers on my listings",
    "Create a new product: 'Laptop Stand' for $49.99 USD",
  ],
}

export function ChatUI({
  role,
  embedded = false,
  onActivity,
}: {
  role: "client" | "shopkeeper"
  embedded?: boolean
  onActivity?: () => void
}) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const threadId = useId()

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    transport: new DefaultChatTransport({ api: "/api/agent" }),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, status])

  // Whenever a tool result lands, the surface's state board / trace need
  // to refresh - the DB is the source of truth.
  const lastSig = useRef<string>("")
  useEffect(() => {
    if (!onActivity) return
    const last = messages[messages.length - 1]
    if (!last) return
    const toolDone = (last.parts ?? []).some(
      (p: any) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        (p.state === "output-available" || p.state === "output-error"),
    )
    const sig = `${last.id}:${(last.parts ?? []).length}:${status}`
    if (toolDone && sig !== lastSig.current) {
      lastSig.current = sig
      onActivity()
    }
    // also fire when a message stream fully ends
    if (status === "ready" && sig !== lastSig.current) {
      lastSig.current = sig
      onActivity()
    }
  }, [messages, status, onActivity])

  const isStreaming = status === "streaming" || status === "submitted"
  const suggestions = SUGGESTIONS_BY_ROLE[role]

  function submit() {
    const text = input.trim()
    if (!text || isStreaming) return
    sendMessage({ text })
    setInput("")
  }

  return (
    <div
      className={`flex flex-col ${embedded ? "h-full" : "h-[calc(100svh-3.5rem)]"}`}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-5 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-serif text-3xl tracking-tight">
                  How can the agent help?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ask about listings, place offers, or check on-chain balances.
                  The agent uses your signed-in role:{" "}
                  <span className="font-mono uppercase tracking-widest text-accent">
                    {role}
                  </span>
                </p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}

          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <strong>Error:</strong> {error.message ?? String(error)}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card/60 p-2 focus-within:border-accent/40">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask the agent…"
              rows={1}
              className="min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              size="icon"
              onClick={submit}
              disabled={!input.trim() || isStreaming}
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            tools · supabase · viem · celo
          </p>
        </div>
      </div>
    </div>
  )
}

function Message({ message }: { message: any }) {
  const isUser = message.role === "user"
  const text =
    message.parts
      ?.filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("") ?? ""

  const toolParts = (message.parts ?? []).filter(
    (p: any) => typeof p.type === "string" && p.type.startsWith("tool-"),
  )

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
    >
      {toolParts.map((p: any, i: number) => (
        <ToolPart key={i} part={p} />
      ))}
      {text && (
        <div
          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-foreground text-background"
              : "bg-card text-foreground"
          }`}
        >
          {text}
        </div>
      )}
    </div>
  )
}

function ToolPart({ part }: { part: any }) {
  const name = String(part.type ?? "").replace(/^tool-/, "")
  const state = part.state as
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"

  return (
    <div className="max-w-[85%] rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Wrench className="h-3 w-3" />
        <span className="font-mono text-[11px] text-foreground">{name}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-accent">
          {state === "output-available"
            ? "ok"
            : state === "output-error"
              ? "err"
              : "…"}
        </span>
      </div>
      {state === "output-error" && part.errorText && (
        <div className="mt-1 text-destructive">{String(part.errorText)}</div>
      )}
      {state === "output-available" && part.output && (
        <pre className="mt-1 max-h-48 overflow-auto font-mono text-[10px] leading-relaxed text-muted-foreground">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
    </div>
  )
}
