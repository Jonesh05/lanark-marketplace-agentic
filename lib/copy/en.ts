const en = {
  addToList: {
    ariaLabel: "Add to shopping list",
    adding: "Adding...",
    added: "Added to your list",
    addFailed: "Could not add to the list",
    networkError: "Network error",
    addButton: "Add"
  },
  hero: {
    preline: "Agentic · USDm · Celo",
    title: "An agent-driven wholesale marketplace",
    subtitle: "Browse verified catalogs, submit offers, and settle sales in USDm on Celo. Your cart, purchases and history stay off-chain; only the sale settlement is recorded on-chain.",
    ctaPrimary: "Sign in to browse",
    ctaSecondary: "List inventory"
  },
  fallback: {
    noDescription: "Short description unavailable. Contact seller for full specs.",
    noImage: "No image available",
    anonymousShop: "Platform agent"
  },
  productCard: {
    soldOut: "Sold out",
    inStock: "{count} in stock"
  },
  cart: {
    navLabel: "Cart",
    title: "Your cart",
    subtitle: "Items are grouped by seller. Each seller is settled as a separate order.",
    empty: "Your cart is empty.",
    emptyCta: "Browse the marketplace",
    byStore: "Sold by",
    unit: "per unit",
    qty: "Qty",
    remove: "Remove",
    subtotal: "Subtotal",
    storeTotal: "Seller total",
    grandTotal: "Total",
    shippingLabel: "Delivery address",
    shippingPlaceholder: "Street, city, details for delivery",
    checkout: "Place order",
    placing: "Placing your order…",
    needAddress: "Please add a delivery address.",
    orderError: "We could not place your order. Try again.",
    orderOk: "Order placed. Confirm payment from your dashboard.",
    singleVendorNote: "One order per seller — products are never mixed across stores."
  },
  store: {
    by: "Vendido por",
    viewStore: "Ver tienda",
    products: "productos",
    empty: "Esta tienda no tiene productos activos por ahora.",
    back: "Volver al marketplace",
    seeAll: "Ver todo"
  },
  favorites: {
    add: "Guardar en favoritos",
    remove: "Quitar de favoritos",
    error: "No pudimos actualizar tus favoritos.",
    navLabel: "Favoritos",
    title: "Tus favoritos",
    subtitle: "Productos que guardaste para comprar después.",
    empty: "Aún no tienes favoritos.",
    emptyCta: "Explorar el marketplace"
  },
  wallet: {
    liveBalance: "Live balance",
    gasBalance: "Gas (CELO)",
    network: "Network",
    refresh: "Refresh",
    loading: "Loading…",
    connectToRead: "connect to read",
    waitingShopkeeper:
      "Aún no has recibido USDm. Tu saldo en USDm aumenta cuando se liquida una venta; el CELO solo cubre el gas de la red.",
    waitingClient:
      "Tu saldo en USDm se usa para pagar tus compras. El CELO solo cubre el gas de la red."
  }
} as const;

export default en;
