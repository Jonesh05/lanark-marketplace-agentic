# Checklist QA - LANARK Marketplace

## Versión
- Documento: v1.0
- Fecha: 2024-01-30
- Propósito: Validación exhaustiva de funcionalidad, integraciones blockchain, seguridad y performance

---

## 1. PRUEBAS FUNCIONALES

### 1.1 Flujo de Compra Básico

#### Precondiciones:
- Usuario comprador cuenta con wallet conectada (MetaMask, WalletConnect)
- Usuario vendedor tiene perfil activo
- Producto disponible en marketplace
- cUSD disponible en wallet del comprador

#### Casos de Prueba:

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| FC-001 | Búsqueda de producto | 1. Navegar a marketplace<br>2. Ingresar término en búsqueda<br>3. Filtrar por categoría/precio | Resultados muestran ±5s, coinciden con criterios, paginación funciona |
| FC-002 | Visualizar detalle producto | 1. Buscar producto<br>2. Click en resultado<br>3. Cargar imágenes, descripción, reviews | Carga ≤2s, todas las imágenes renderean, precio y stock correctos |
| FC-003 | Agregar carrito | 1. Click "Agregar al carrito"<br>2. Seleccionar cantidad<br>3. Confirmar | Badge carrito actualiza al instante, cantidad persiste al recargar |
| FC-004 | Proceder al checkout | 1. Click "Ir al carrito"<br>2. Revisar items y totales<br>3. Click "Proceder pago" | Totales cálculan correctamente (subtotal + fees + impuestos) |
| FC-005 | Confirmación pago | 1. Conectar wallet (si no está)<br>2. Aprobar transacción<br>3. Esperar confirmación blockchain | Transacción se registra en cadena, estado = "confirmed" en 30s |

### 1.2 Perfil de Usuario y Gestión

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| FC-101 | Editar perfil comprador | 1. Ir a Mi Perfil<br>2. Editar email, nombre, dirección<br>3. Guardar cambios | Cambios persisten, se valida email válido, dirección cumple formato |
| FC-102 | Ver historial de compras | 1. Ir a Mis Compras<br>2. Filtrar por fecha/estado<br>3. Click en pedido para detalles | Listado completo, detalles muestran fecha, monto, estado actual |
| FC-103 | Crear perfil vendedor | 1. Click "Convertirse en Vendedor"<br>2. Completar KYC básico<br>3. Confirmar billetera de payout | Perfil creado, se permite listar productos, recibir fondos |
| FC-104 | Listar producto (vendedor) | 1. Click "Nuevo Producto"<br>2. Llenar datos (nombre, desc, precio, stock, imágenes)<br>3. Publicar | Producto visible en marketplace al instante |

### 1.3 Gestión de Pedidos (Buyer & Seller)

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| FC-201 | Ver estado pedido real-time | 1. Comprador ve pedido en estado "pending"<br>2. Seller acepta<br>3. Status cambia a "accepted" | UI refleja cambio <2s, buyer recibe notificación |
| FC-202 | Cancelar pedido (buyer - antes de pago confirmado) | 1. Click "Cancelar"<br>2. Confirmar<br>3. Fondos revertidos | Transacción reversión confirmada on-chain, status = "cancelled" |
| FC-203 | Marcar como enviado (seller) | 1. Seller click "Marcar enviado"<br>2. Ingresar tracking (opcional)<br>3. Guardar | Status = "shipped", buyer notificado, puede trackear |
| FC-204 | Confirmar entrega (buyer) | 1. Buyer recibe producto<br>2. Click "Confirmar recibido"<br>3. Opcionalmente calificar vendedor | Fondos liberados a seller on-chain, ciclo finaliza |

### 1.4 Sistema de Calificaciones y Reviews

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| FC-301 | Dejar reseña post-compra | 1. Ir a historial compras<br>2. Click "Dejar reseña"<br>3. Seleccionar estrellas, escribir texto<br>4. Enviar | Reseña aparece en perfil vendedor, promedio actualiza |
| FC-302 | Responder reseña (seller) | 1. Ver reseña en perfil<br>2. Click "Responder"<br>3. Escribir respuesta<br>4. Enviar | Respuesta visible bajo reseña, con timestamp |
| FC-303 | Rating agregado | Validar que cálculo de rating promedio = (suma estrellas) / cantidad | Promedio mostrado con ±0.1 precisión en todas las vistas |

---

## 2. PRUEBAS DE INTEGRACIÓN

### 2.1 Integración Wallet & Blockchain

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| INT-001 | Conectar MetaMask | 1. Click "Conectar Wallet"<br>2. Seleccionar MetaMask<br>3. Autorizar conexión | Wallet conectada, dirección visible en UI, eventos de conexión logueados |
| INT-002 | Cambiar red (Alfajores a Baklava) | 1. Cambiar red en MetaMask<br>2. Página detecta cambio<br>3. UI adapta (tokens, saldos) | UI muestra red correcta, balances refrescan en <5s |
| INT-003 | Desconectar wallet | 1. Click opciones wallet<br>2. Click "Desconectar"<br>3. Verificar estado | Sesión termina, UI vuelve a estado anónimo, localStorage limpio |
| INT-004 | Firma EIP-712 (transacción de pago) | 1. Buyer procede a pagar<br>2. Wallet muestra ventana firma<br>3. Buyer firma<br>4. Transacción enviada | Firma validada on-chain, hash de transacción registrado, nonce incrementado |

### 2.2 Liquidación On-Chain (Settlement)

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| INT-101 | Escrow creado y fondos bloqueados | 1. Pago confirmado<br>2. Sistema crea contrato escrow<br>3. Fondos bajo control smart contract | Escrow address visible en blockchain explorer, saldo = monto transacción |
| INT-102 | Liberación escrow a seller | 1. Buyer confirma "Entrega recibida"<br>2. Sistema ejecuta contrato liberación<br>3. Fondos transferidos a seller wallet | cUSD en wallet seller incrementa, on-chain settlement confirmado en <60s |
| INT-103 | Reembolso (refund escrow) | 1. Buyer cancela o dispute antes de entrega<br>2. Sistema ejecuta refund<br>3. Fondos reversos a buyer | cUSD en wallet buyer recuperado, transacción refund on-chain visible |
| INT-104 | Comisiones marketplace deducidas | 1. Transacción completada<br>2. Revisar saldo final seller<br>3. Comisión marketplace (e.g., 2.5%) deducida | Monto seller = monto_original - (comisión%) - (gas fees), correcto al 100% |

### 2.3 Webhook & Notificaciones

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| INT-201 | Webhook transacción confirmada | 1. Transacción enviada<br>2. Backend recibe webhook de RPC<br>3. DB actualiza estado | Log webhook en timestamp correcto, estado = "CONFIRMED", monto verificado |
| INT-202 | Notificación email buyer | 1. Compra completada<br>2. Esperar <2 min<br>3. Check email | Email recibido, contiene orden ID, monto, seller, enlace tracking |
| INT-203 | Notificación email seller | 1. Buyer confirma entrega<br>2. Esperar <2 min<br>3. Check email seller | Email recibido, notifica fondos disponibles, link a wallet para retirar |
| INT-204 | Notificación in-app | 1. Acción relevante (compra, pago, entrega)<br>2. Revisar icono campanilla<br>3. Expandir notificación | Notificación in-app aparece <500ms, marca como leída correctamente |

### 2.4 Reconciliación Blockchain-DB

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| INT-301 | Estado transacción consistente | 1. Consultar TX en blockchain<br>2. Consultar estado en DB<br>3. Comparar | Estados coinciden (pending, confirmed, failed), hashes idénticos, nonce consistente |
| INT-302 | Balance wallet consistente | 1. Consultar saldo en wallet<br>2. Consultar en DB<br>3. Comparar con blockchain explorer | Saldos coinciden ±1 wei, sin discrepancias en múltiples checkeos |
| INT-303 | Auditoría de fondos escrow | Cada 24h: sumar todos escrows pendientes + liberados | Total = suma transferencias on-chain, 0 discrepancias |

---

## 3. PRUEBAS DE SEGURIDAD

### 3.1 Validación de Entrada & Inyección

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| SEC-001 | SQL Injection en búsqueda | 1. Campo búsqueda: `' OR '1'='1`<br>2. Enviar<br>3. Ver respuesta | Query sanitizado, 0 resultados o error controlado, log de intento registrado |
| SEC-002 | XSS en descripción producto | 1. Crear producto con: `<img src=x onerror=alert()>`<br>2. Guardar<br>3. Ver en marketplace | HTML escapado, script no ejecuta, texto mostrado literalmente |
| SEC-003 | Validación números (price, qty) | 1. Ingresar cantidad: `-10` o `999999999`<br>2. Guardar | Validación rechaza negativo, limita máximo a stock, muestra error |
| SEC-004 | Validación dirección Ethereum | 1. Dirección billetera: `0xinvalid` o checksum incorrecto<br>2. Enviar | Sistema rechaza, muestra "Dirección inválida", no procesa transacción |

### 3.2 Autenticación & Autorización

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| SEC-101 | Session hijacking prevention | 1. Obtener session token (dev tools)<br>2. Cambiar 1 carácter<br>3. Intentar usar token alterado | Session inválida, logout automático, log de intento anormal |
| SEC-102 | CSRF protection | 1. Crear formulario CSRF externo<br>2. Intentar confirmar compra desde sitio malicioso<br>3. Verificar si se procesa | Solicitud bloqueada, token CSRF inválido, no hay cambio de estado |
| SEC-103 | Permisos vendedor | 1. Buyer intenta editar producto ajeno<br>2. Accede directo URL `/products/{id}/edit`<br>3. Verifica respuesta | Error 403 Forbidden, no acceso a detalles producto, log de intento no autorizado |
| SEC-104 | Permisos admin | 1. Buyer intenta acceder `/admin` o reporte vendedores<br>2. Consulta API `/admin/*`<br>3. Verifica respuesta | Error 401/403, sin datos sensibles, audit log registra intento |

### 3.3 Manejo de Secretos & Credenciales

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| SEC-201 | Private keys no en logs | 1. Revisar logs de transacción<br>2. Buscar private key, mnemonic, seed<br>3. Buscar en browser console | 0 secretos en logs, console limpia de claves, solo logs sanitizados |
| SEC-202 | API keys rotadas | 1. Revisar `.env.local` vs `.env.example`<br>2. Verificar que .env no en git<br>3. Check rotación de keys cada 30 días | `.env` no tracked, keys rotadas automáticamente, auditoría de acceso |
| SEC-203 | Rate limiting APIs sensibles | 1. Hacer 100 requests a `/api/login` en 1 min<br>2. Requests siguientes<br>3. Verificar bloqueo | Primeros 10-20 aceptados, posteriores bloqueados, error 429 Too Many Requests |

### 3.4 Validación de Datos Blockchain

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| SEC-301 | Validar firma EIP-712 | 1. Modificar payload POST después de firmar<br>2. Enviar<br>3. Backend valida firma | Firma no coincide con payload, transacción rechazada, error "Invalid signature" |
| SEC-302 | Validar hash transacción | 1. Obtener TX hash del evento<br>2. Alterarlo 1 carácter<br>3. Intentar consultar | TX no encontrado en blockchain, error "TX not found", no procesamiento |
| SEC-303 | Validar monto en escrow | 1. Crear escrow por $50<br>2. En blockchain explorer ver transacción<br>3. Comparar monto exacto | Monto en cadena = $50 exacto, 0 discrepancias, fee separado de monto principal |

---

## 4. PRUEBAS DE PRIVACIDAD

### 4.1 Protección de Datos Personales

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PRIV-001 | Email no expuesto en frontend | 1. Inspeccionar DOM con dev tools<br>2. Buscar email en HTML<br>3. Revisar network requests | Email no en HTML plain text, API responses enmascarados en frontend |
| PRIV-002 | Datos de tarjeta (si aplica) | 1. Procesar pago con datos tarjeta<br>2. Verificar logs del browser<br>3. Revisar LocalStorage | Datos tarjeta NO en localStorage, sesión en memoria únicamente, nunca logueados |
| PRIV-003 | Dirección física no pública | 1. Buyer registra dirección de envío<br>2. Vendedor accede perfil buyer<br>3. Verificar si puede ver dirección completa | Dirección completamente oculta a vendedor hasta aceptar pedido, luego mostrada de forma segura |
| PRIV-004 | Historial de compras privado | 1. Buyer accede "Mis Compras"<br>2. Vendedor intenta acceder historial del buyer<br>3. Consulta API `/users/{userId}/orders` | Error 403, sin exposición datos, log auditoría registra intento |

### 4.2 Consentimiento & Transparencia

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PRIV-101 | Consentimiento privacidad al registrarse | 1. Nuevo usuario signup<br>2. Revisar UI de términos<br>3. Click aceptar<br>4. Confirmar en DB | Checkbox GDPR/privacidad requerido, consentimiento registrado con timestamp, versión documento guardada |
| PRIV-102 | Opción de opt-out marketing | 1. Settings de usuario<br>2. Toggle "Recibir emails marketing"<br>3. Enviar email marketing<br>4. Verificar | Si opt-out = true, usuario NO recibe email, lista de exclusión respetada |
| PRIV-103 | Derecho al olvido (GDPR) | 1. Usuario solicita eliminación cuenta<br>2. Sistema planifica borrado en 30 días<br>3. Verifica eliminación | Datos personales borrados (emails, direcciones, KYC), transacciones anonimizadas, ledger preservado para auditoría |

### 4.3 Anonimato en Blockchain

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PRIV-201 | Identidad real no linked en cadena | 1. Buyer realiza compra<br>2. Verificar transacción en Alfajores explorer<br>3. Buscar email/nombre en transaction data | Solo address Ethereum visible, 0 datos personales en on-chain data |
| PRIV-202 | Address hashing (PEF) | Validar que datos personales + address hasheados con salt | Hash no reversible sin salt, datos protegidos en DB |

---

## 5. PRUEBAS ON-CHAIN RESILIENCE

### 5.1 Network Failures & Reorgs

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| RES-001 | Reorg de 1 bloque en Alfajores | 1. Transacción confirmada en bloque N<br>2. Red reorgea, bloque N descartado<br>3. TX reentra en bloque N+1 | Sistema detecta reorg, TX reiniciada, evento webhook reenviado, estado se resincroniza |
| RES-002 | Timeout RPC (30s sin respuesta) | 1. Simular delay en RPC<br>2. Backend espera respuesta<br>3. Timeout dispara | Retry automático hasta 3 veces, si falla: error controlado, user notificado, transacción en cola |
| RES-003 | Caída nodo temporal | 1. Desconectar nodo RPC primario<br>2. Sistema usa fallback RPC<br>3. Nodo se recupera | Fallover automático <5s, sem interrupción percibida, métricas registran switchover |
| RES-004 | Mempool congestionado | 1. Gas price inflacionado (simular congestión)<br>2. Transacción enviada<br>3. Esperar a que se incluya | Transacción se renta después de 5-10 min, estado pasa a "confirmed", sin pérdida fondos |

### 5.2 Transaction Failures & Recovery

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| RES-101 | Transacción falla (out of gas) | 1. Estimación gas insuficiente (test)<br>2. Transacción se envía<br>3. Falla con "out of gas" | Error capturado, DB marca como "failed", fondos revertidos, buyer notificado |
| RES-102 | Double spend prevention | 1. Buyer intenta 2 transacciones idénticas simultáneamente<br>2. Ambas se envían<br>3. Una es aceptada, otra rechazada | Nonce protege, solo 1 transacción confirmada, 2da falla con "nonce too low", fondos no duplicados |
| RES-103 | Transacción pendiente indefinida | 1. TX enviada pero nunca minada (4+ horas)<br>2. Sistema revisa estado<br>3. Timeout dispara | Sistema cancela TX automáticamente, refund iniciado, buyer notificado, estado = "cancelled" |
| RES-104 | Partial settlement | 1. Escrow por 3 items<br>2. Solo 2 items llegan<br>3. Buyer dispute, pide refund parcial | Sistema calcula refund proporcional (2/3 original), transfiere refund, cierra con reconciliation |

### 5.3 Gas & Fee Management

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| RES-201 | Gas price fluctuaciones | 1. Transacción con gas A<br>2. Gas sube 50% después de envío<br>3. TX sigue en mempool<br>4. Finalmente minada | TX se incluye aunque gas subió, aplicado gas price del bloque, no re-pricing |
| RES-202 | Sponsor gas (Celo) | 1. Buyer sin suficiente gas (solo 0.1 CELO)<br>2. Sponsor cubre gas para firma EIP-712<br>3. Transacción procesa | Sponsor absorbe gas fee, buyer no paga, TX confirmada, evento "gasSponsor" logged |
| RES-203 | Fee calculation correctness | Validar: Total = ProdPrice × Qty + Marketplace_Fee_% + Gas_Estimate | Exactitud ±1%, desglose visible al usuario, sin sorpresas en checkout |

### 5.4 Settlement Confirmation

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| RES-301 | Settlement confirmado en 1 bloque | 1. Buyer libera escrow<br>2. Transacción minada en bloque B<br>3. Sistema recibe webhook | Fondos transferidos a seller on-chain, DB marca "confirmed", seller puede retirar en 60s |
| RES-302 | Settlement con 12+ confirmaciones | 1. Transacción confirmada en 1 bloque<br>2. Esperar 11 bloques adicionales (±120s)<br>3. Sistema marca como "final" | Estado final registrado, refund ya no posible, seller puede retirar en otra cadena si aplica |
| RES-303 | Cross-chain settlement (si aplica) | Si marketplace opera en Alfajores + Baklava | Bridge transaction confirmado en ambas cadenas, balances reconciliados, 0 discrepancias |

---

## 6. PRUEBAS DE PERFORMANCE

### 6.1 Tiempos de Respuesta

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PERF-001 | Listado de productos | 1. Cargar página marketplace<br>2. Esperar render completo<br>3. Medir tiempo a "interactive" | First Contentful Paint <1s, Time to Interactive <2s, Lighthouse score >85 |
| PERF-002 | API búsqueda | 1. Query `/api/search?q=product`<br>2. Medir response time<br>3. Payload size | Respuesta <300ms para 100 resultados, JSON <500KB sin compresión |
| PERF-003 | Cálculo de transacción | 1. Buyer inicia checkout<br>2. Sistema calcula fees, taxes, escrow<br>3. Medir tiempo de respuesta | Cálculo completado <100ms, incluye validación blockchain state |
| PERF-004 | Confirmación blockchain | 1. Transacción enviada<br>2. Esperar a "confirmed" (1 bloque)<br>3. Medir tiempo fin a fin | Confirmación en promedio 15-20s (tiempo bloque Celo), máximo 60s |

### 6.2 Escalabilidad

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PERF-101 | 100 usuarios simultáneos | 1. Simular carga con tool (k6, jmeter)<br>2. Todos hacen búsqueda en paralelo<br>3. Medir latencia y errores | P95 latencia <500ms, error rate <0.1%, 0 crashed servers |
| PERF-102 | 1000 transacciones pendientes | 1. Sistema acumula 1000 TXs en cola<br>2. Procesar en batch<br>3. Tiempo procesamiento | Toda cola procesada <5 min, DB indexación optimizada, 0 memory leaks |
| PERF-103 | Database query optimization | Ejecutar queries críticas (historial compras, búsqueda) | Todas queries <100ms, índices en lugar, explain plan sin full table scan |

### 6.3 Resource Usage

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PERF-201 | Memory backend | 1. Servidor corriendo 24h<br>2. Monitorear memoria<br>3. Revisar para memory leaks | Memory usage estable ±50MB, 0 memory leaks, GC ejecutando cada 5-10min |
| PERF-202 | CPU utilización | Carga 100 usuarios simultáneos | CPU <70% en máximo, sin throttling |
| PERF-203 | Storage blockchain | Contratos smart inteligentes | Gas usage <2M por transacción, storage optimization completa |

### 6.4 Mobile Performance

| ID | Descripción | Pasos | Criterios de Aceptación |
|----|-------------|-------|------------------------|
| PERF-301 | Carga página mobile (3G) | 1. Chrome DevTools, throttle 3G<br>2. Cargar marketplace<br>3. Medir First Contentful Paint | FCP <3s, Time to Interactive <5s, usable antes de 4s |
| PERF-302 | Firma transacción mobile | 1. WalletConnect desde mobile<br>2. Confirmar compra<br>3. Medir tiempo de firma | UI responsivo, no freeze >500ms, validación instantánea |

---

## MAPEO A MÉTRICAS Y SLAs

| Categoría | Métrica | SLA | Cómo Validar |
|-----------|---------|-----|--------------|
| **Disponibilidad** | Uptime | 99.5% mensual | Monitoreo Datadog/Sentry, alertas <5 min downtime |
| **Performance** | Latencia API P95 | <300ms | APM tools, query logs |
| **Blockchain** | Confirmación TX | <60s | Webhook timestamps vs on-chain block time |
| **Settlement** | Liberación escrow | <2 min confirmada | DB timestamp vs TX confirmation |
| **Seguridad** | Vulnerabilidades críticas | 0 | Auditoría mensual smart contracts, pen testing |
| **Tasa error** | Error rate API | <0.1% | Logs, 500 error monitoring |
| **Privacidad** | Data breach | 0 | Auditoría acceso DB, compliance checks |

---

## CRITERIOS DE ACEPTACIÓN GLOBALES

- ✅ Todas las pruebas funcionales e integración DEBEN pasar antes de merge
- ✅ Cobertura de seguridad CRÍTICA: SQL injection, XSS, CSRF, autenticación
- ✅ Transacciones blockchain DEBEN confirmarse con webhooks verificados
- ✅ Settlement DEBE ser consistente blockchain ↔ DB (reconciliación diaria)
- ✅ Performance SLAs DEBEN cumplirse en testnet (Alfajores + Baklava si aplica)
- ✅ Cero secretos en logs/console
- ✅ Rate limiting configurado en endpoints sensibles
- ✅ Auditoría de acceso para admin, vendedor, buyer roles

