# Copilot Instructions for LANARK

## Executive Context

You are working on LANARK, an agentic on-chain marketplace for LATAM, built for weekly markets, fair trading, and civic-grade commerce infrastructure.

## Core Product Thesis

* The agent does the work.
* The marketplace settles in cUSD on Celo Mainnet.
* Prices are displayed in local fiat, primarily COP.
* Wallet identity is role-based and immutable after first login.
* Privacy is non-negotiable. No raw PII should be stored.

## Primary Actor Types

### Shopkeeper

Manages inventory, reviews offers, posts and removes items, tracks expenses and sales, executes purchases from suppliers, and manages daily and monthly sales balances, as well as maximum revenue or customer volume.

### Customer

Browses products, makes offers, and tracks order status and wishlists. A unique dashboard allows clients to have a single credential where they can track their points balance and share a unique referral link.

## Product Principles

* Interpret intent, do not wait for explicit instructions when the user context is sufficient.
* Optimize for conversion, clarity, and trust.
* Make the agent feel operational, not decorative.
* Keep the system economically efficient. Reduce unnecessary on-chain writes and repeated calls.
* Design for mobile-first usage and LATAM operational reality.
* Avoid generic SaaS visuals. Build with a sharp, distinctive point of view.

## Architecture Stack

Use the following stack as the default implementation baseline:

* Next.js App Router
* Vercel AI SDK (`ai` package)
* Chat UI with `useChat`
* Reown for auth
* Sentry for error monitoring
* Supabase for schema, RLS, auth triggers, persistence
* Celo Mainnet / EVM-compatible chain for settlement
* Foundry for smart contract development and tests
* ERC-4337 smart account flow where relevant
* Vercel for deployment

## Data and Privacy Rules

* Do not fabricate data.
* Do not invent catalog items, orders, balances, or status updates.
* Use real database reads, real tools, and real chain state when available.
* Never store raw personal data if a hash will suffice.
* Hash addresses, names, delivery info, and sensitive user context with keccak256 when persistence is needed.
* Store plaintext only where the user must retain control and the system does not need the raw value.
* Keep the wallet as the role anchor.
* First login establishes role.
* Role is immutable unless a deliberate migration flow is explicitly implemented.

## UI and UX Direction

The interface must feel like a serious product, not a prototype.

### Use these UX rules

* Clear hierarchy of offer.
* Strong, visible CTAs.
* Explicit empty states.
* Explicit loading states.
* Explicit error states.
* Explicit confirmation states.
* The agent chat is a first-class panel, not a modal.
* Avoid wallet jargon in copy unless it is essential.
* Make on-chain status legible to non-technical users.
* Every screen should explain what happens next.

### Design expectations

* Bold and intentional layout decisions.
* Distinct visual identity.
* Reusable components with disciplined spacing.
* Hero sections must communicate the business model and the settlement layer.
* Catalog surfaces must separate featured offers, live listings, and recent settlements.
* Use a strong visual rhythm. Avoid repetitive card grids that feel static.

## Agent Behavior

The agent must behave as a structured operator.

### Interpret intent as follows

* "I want 3 kg of tomatoes" means product search, quantity normalization, offer creation, and checkout preparation.
* If the user describes a meal or shopping need, infer the required items and quantities.
* Present a concise action plan before execution when confirmation is still required.
* If the context is sufficient, the agent should execute and report back.
* Do not ask for confirmation for information already known and already trusted.

### When the agent acts

* Read real Supabase data.
* Call tools only when needed.
* Prefer deterministic outputs.
* Never fabricate reasoning traces.
* When a tool fails, surface the failure clearly and do not mask it.

## Tooling Policy

The agent should use role-scoped tools.

### Suggested off-chain tools

* getProductInfo
* getInventory
* updateProduct
* deleteProduct
* createProduct
* submitOffer
* acceptOffer
* rejectOffer
* createOrder
* getOrderStatus
* getAccountHistory
* getSpendingSummary
* recordReminder
* matchDeliveryAddress
* createPurchaseFlash
* orderSupplierStock
* ensureWalletReady
* sponsorGas

### Suggested on-chain tools

* confirmTransaction
* flagDispute
* resolveDispute
* settlement actions
* escrow actions
* smart-account provisioning actions

### Rules for tools

* Shopkeeper tools must be restricted to the shopkeeper’s own scope.
* Client tools must only expose client-safe reads and actions.
* Off-chain reads should come from Supabase, not mock data.
* On-chain actions should be explicit and auditable.

## State and Data Model Rules

Use a canonical model with clear ownership.

### Important concepts

* role
* profile
* inventory
* offer
* order
* purchase_execution_flash
* address_hash
* settlement_status
* dispute_status
* wallet_ready
* agent_trace

### Model rules

* Persist only what is needed.
* Prefer normalized structures.
* Avoid duplicated sources of truth.
* Use hashes for sensitive delivery and identity artifacts.
* Every order intent should create a purchase execution flash record.

## Purchase Execution Flash Policy

Purchase Execution Flash, or PEF, is a first-class workflow object.

### It must capture

* product_id
* quantity
* unit_price_cusd
* address_hash
* intent_text
* status

### Behavior rules

* Create the flash record as soon as purchase intent is detected.
* Reuse address hashes when repeat delivery context is already trusted.
* Ask for confirmation only when required by missing or ambiguous data.
* Keep the workflow structured and timestamped.

## Delivery Address Flow

If a delivery address already exists and is trusted:

* Reuse the stored hash.
* Ask for confirmation only if the context changed.

If no address exists:

* Prompt for capture.
* Hash the data immediately.
* Never expose the raw address in logs or stored records unless strictly required by the UX layer and fully under user control.

## Smart Contract and Chain Rules

The chain layer must support:

* escrow
* offer settlement
* dispute handling
* sponsored gas where appropriate
* smart account provisioning

### Contract and deployment rules

* Use Foundry for contract development and tests.
* Keep test coverage explicit.
* Do not assume successful settlement without checking chain state.
* Use Celo Mainnet for production settlement.
* Use testnet for development and validation flows.

### Gas and wallet guidance

* Prefer sponsored gas when the business flow requires low-friction adoption.
* Use ERC-4337 patterns to reduce onboarding friction.
* Make wallet readiness part of the flow, not an afterthought.

## Frontend Composition Rules

Split by domain, not only by file type.

### Preferred component domains

* marketplace
* agent
* wallet
* checkout
* settlement
* shared UI

### Recommended component names

* marketplace-card
* offer-card
* product-card
* catalog-grid
* intent-selector
* agent-pulse
* agent-trace
* settlement-timeline
* receipt-card
* empty-state
* cta-cluster
* wallet-status

### Rules

* Keep page files thin.
* Move business logic into hooks, server actions, or lib modules.
* Reuse components aggressively.
* Avoid duplicate card implementations.
* Keep visual language consistent across surfaces.

## Data Source Policy

Always prefer real sources in this order:

1. On-chain state.
2. Supabase.
3. External APIs.
4. Derived UI state.

Never use dummy data when the task is product-facing and real data is available. Never present mock flows as production behavior.

## Build Order Guidance

When implementing new work, prioritize in this order:

1. Identity and role lock.
2. Data model and RLS.
3. Agent core and tools.
4. Purchase execution flash.
5. Smart contracts.
6. On-chain settlement and sponsored gas.
7. UI surfaces.
8. Supplier integrations.
9. CI/CD and deployment.

## Quality Bar

Every deliverable should be:

* production-grade
* functional
* visually coherent
* implementation-ready
* aligned to the agentic marketplace thesis

### Avoid

* generic AI aesthetics
* placeholder content without a clear exit path
* decorative complexity without operational value
* unnecessary abstraction
* brittle one-off logic

## Output Preference

When generating code or architecture:

* Be explicit.
* Be implementation-first.
* Use direct, structured language.
* Prefer clarity over cleverness.
* Reflect the product thesis in the code itself.

## Single-Sentence Product Reminder

LANARK is a role-aware, agentic marketplace where the agent interprets intent, executes the workflow, and settles value on Celo with privacy-preserving data handling.
