# Handoff: LANARK Marketplace — Detalles de entrega

Fecha: YYYY-MM-DD  
Responsable del handoff: Equipo de entrega (DevOps / Delivery)

---

## Resumen ejecutivo

Documento de handoff operativo y de entrega para equipos de Desarrollo, Infra/Ops, QA y Legal/Auditoría. Contiene checklists, artefactos requeridos, entornos y variables, cuentas de testnet (formato), monitoreo recomendado, runbooks on-chain, checklist de despliegue, plan de rollback, dueños y puntos de contacto.

---

## 1) Artefactos entregables (lista exacta)

Para evitar ambigüedad, se entregan los siguientes artefactos como archivos o carpetas en el repositorio o en la carpeta de release (`/releases/<tag>`):

- Documentación general
  - docs/README.md — Resumen de arquitectura y decisiones clave
  - docs/architecture.md — Diagrama de componentes, dependencias y flujos
  - docs/deployment.md — Procedimiento de despliegue (scripts y permisos)
  - docs/security.md — Políticas de claves, gestión de secretos y roles

- Contratos API y contratos de datos
  - api/openapi.yaml — Especificación OpenAPI (REST) / contrato de API
  - api/grpc.proto — (si aplica) definiciones de gRPC
  - api/contract-versioning.md — Convenciones de versionado de API

- EIP-712 y ejemplos de firma
  - crypto/eip712/typedData-offer.json — Ejemplo EIP-712 para firma de ofertas
  - crypto/eip712/README.md — Explicación de los campos y uso

- State machine y diagramas
  - docs/state-machine.md — Máquina de estados (orden/PEF/settlement) + diagrama SVG (diagrams/state-machine.svg)
  - docs/state-transitions.csv — Matriz de transiciones, triggers y roles autorizados

- Planes de prueba y artefactos QA
  - qa/test_plan.md — Plan de pruebas (unit, integration, e2e, smoke, load)
  - qa/test_vectors/ — Casos de prueba reproducibles (JSON) para pruebas on-chain
  - qa/e2e/playwright/ or qa/e2e/cypress/ — Scenarios e2e automatizados
  - qa/load/load-test-config.yml — Configuración para pruebas de carga (k6, artillery)

- Artefactos on-chain y smart contracts
  - contracts/ — Código fuente de contratos (si aplica)
  - contracts/artifacts/ — ABI, bytecode, deployed-addresses-{network}.json
  - contracts/audit/ — Resultados de auditoría (PDF/summary)

- Infra y operaciones
  - infra/terraform/ — Código de infraestructura (módulos, variables, outputs)
  - infra/k8s/ — Manifests y charts (Helm)
  - infra/runbooks/ — Runbooks operativos y recuperación

- CI/CD y scripts de despliegue
  - .github/workflows/ci.yml — Pipeline CI
  - .github/workflows/cd.yml — Pipeline de despliegue (staging/mainnet)
  - scripts/deploy.sh — Script de despliegue (documentado)

- Logs y trazabilidad
  - observability/grafana-dashboard.json — Dashboards entregables
  - observability/alerts.yml — Reglas de alertas (Prometheus Alertmanager)

- Otros
  - legal/compliance_summary.md — Resumen de cumplimiento y requisitos regulatorios
  - legal/data_retention_policy.md — Política de retención y hashing de PII

> Nota: Cada archivo debe llevar encabezado con versión y autor (ej: `Version: v1.0 — Autor: equipo X`).

---

## 2) Entornos requeridos y variables de entorno (nombres y formatos)

Entornos mínimos a soportar:
- dev — entorno local/por desarrollador
- staging — integración / QA (equivalente a pre-producción)
- testnet — red de pruebas blockchain (ej. Alfajores / Goerli) para pruebas on-chain
- mainnet — producción (Celo Mainnet)

Variables de entorno (solo nombres y formatos; NO INCLUIR SECRETS):

- NEXT_PUBLIC_API_URL (string, URL) — Ej: https://api.staging.example.com
- NEXTAUTH_URL (string, URL)
- NODE_ENV (string: development|staging|production)
- DATABASE_URL (string, formato de conexión: postgres://<user>:<pass>@<host>:<port>/<db>) — tratar como secreto
- SUPABASE_URL (string, URL)
- SUPABASE_ANON_KEY (string) — secreto
- REDIS_URL (string, redis://<host>:<port>) — secreto
- KMS_VAULT_ADDR (string, URL) — endpoint de Vault/KMS
- KMS_VAULT_ROLE_ID (string) — (id) — secreto
- CELO_PROVIDER_URL (string, URL RPC) — Ej: https://alfajores-forno.celo-testnet.org
- CELO_CHAIN_ID (integer) — Ej: 44787 (Alfajores), 42220 (Celo Mainnet)
- RELAYER_SERVICE_URL (string, URL)
- FEATURE_FLAG_SERVICE (string, URL)
- SENTRY_DSN (string) — secreto
- LOG_LEVEL (string: DEBUG|INFO|WARN|ERROR)
- METRICS_PUSHGATEWAY (string, URL)
- GRAFANA_DASHBOARD_ID (string)
- EMAIL_PROVIDER_API_URL (string, URL)

Formato de nombres de variables para entornos múltiples:
- <VARIABLE>_DEV, <VARIABLE>_STAGING, <VARIABLE>_TESTNET, <VARIABLE>_MAINNET (opcional si se usan múltiples valores co-existentes)

Gestión: todos los valores secretos deben residir en un gestor de secretos (Vault/KMS) y **no** en el repositorio.

---

## 3) Cuentas y roles en Testnet (formatos / placeholders)

Patrón y roles recomendados — usar estos nombres y formatos para la documentación y scripts de prueba:

- shopkeeper: 0x{40_hex} — keystore: keystore/shopkeeper.json — alias: testnet_shopkeeper_01
- customer: 0x{40_hex} — keystore/customer.json — alias: testnet_customer_01
- supplier: 0x{40_hex} — alias: testnet_supplier_01
- relayer: 0x{40_hex} — servicio que retransmite transacciones (relayer@service.example)
- settlement_operator: 0x{40_hex} — multisig o cuenta operativa
- auditor: 0x{40_hex} — cuenta con permisos de sólo lectura para auditoría

Ejemplos de formato (placeholders):
- Dirección: 0x0123456789abcdef0123456789abcdef01234567
- Keystore path (local): ./keystore/testnet_shopkeeper_01.json
- Password: (NO incluir) — almacenar en Vault

Recomendaciones para testnet:
- Mantener un archivo `qa/testnet-accounts.csv` con las direcciones y su rol (sin claves en texto claro)
- Registrar saldo recomendado para pruebas: ex. 200 cUSD de prueba y 0.05 CELO (dependiendo de la testnet)
- Registrar permisos: `auditor` -> read-only en vistas y dashboards; `settlement_operator` -> permisos de multisig en scripts

---

## 4) Monitoreo recomendado (métricas, dashboards, alertas)

Métricas clave (instrumentar):
- On-chain / Settlement
  - tx_submitted_total (counter)
  - tx_confirmed_total (counter)
  - tx_failed_total (counter)
  - tx_latency_seconds (histogram)
  - settlement_success_rate (gauge, %)
  - pending_settlements_count (gauge)
- Wallet / Relayer
  - relayer_queue_length
  - relayer_retries_total
  - signer_balance_{token} (gauge)
- API / Backend
  - http_requests_total{code,method,route}
  - http_request_duration_seconds
  - error_rate_4xx_5xx
  - db_query_latency_seconds
  - db_connection_errors_total
- Workers / Jobs
  - jobs_processed_total
  - jobs_failed_total
  - job_queue_size
- Infra
  - host_cpu, host_memory, disk_io, disk_usage
  - k8s_pod_restarts

Dashboards mínimos a entregar:
- Grafana: "Lanark Overview" — tráficos principales, error rate, latency
- Grafana: "On-chain Settlement" — tx queue, pending settlements, confirmations
- SLO/SLI dashboard: uptime, error budget

Alertas recomendadas (Prometheus Alertmanager):
- P1: tx_failed_total / tx_submitted_total > 2% por 10m -> PagerDuty/Oncall
- P1: pending_settlements_count > 50 por 5m -> PagerDuty
- P1: signer_balance_{token} < umbral (ej. 0.02 CELO) -> PagerDuty/Slack
- P2: error_rate_5xx > 1% por 5m -> Slack + ticket
- P2: db_connection_errors_total > 0 por 1m -> Ops
- P2: worker restarts > 3 en 5m -> Ops

Retención y trazas:
- Guardar traces distribuidos (OpenTelemetry) y logs (Sentry/Datadog) durante al menos 30 días para investigación de incidentes.

---

## 5) Runbooks: fallos on-chain (triage y acciones)

Runbook 1 — Transacción pendiente > 10 min
- 1) Verificar el hash de TX en el explorador (testnet/mainnet) y confirmar cantidad de bloques
- 2) Revisar logs de relayer y mempool (relayer service) para ver nonce y re-broadcast
- 3) Verificar salud del RPC provider (CELO_PROVIDER_URL)
- 4) Si el nonce está atascado por una tx anterior -> re-broadcast con replacement tx (si procede) o cancelar vía tx de reemplazo (usa increase fee)
- 5) Si provider está caído -> cambiar temporalmente a provider alternativo y re-broadcast
- 6) Comunicar a oncall y registrar incidente

Runbook 2 — Transacción revertida / revert reason
- 1) Inspeccionar receipt + revert reason (si disponible)
- 2) Revisar datos de entrada (parametros EIP-712, precios, balances)
- 3) Si es un fallo de validación de contrato -> detener flows dependientes (feature flag) y escalar a dev/backend
- 4) Generar ticket y preservar logs y inputs

Runbook 3 — Reorg o reorganización de cadena detectada
- 1) Detectar mediante disminución de confirmaciones o evento de reorganización en node
- 2) Pausar operaciones críticas que dependan de confirmaciones finitas
- 3) Re-evaluar transacciones afectadas y, si necesario, re-broadcast
- 4) Escalar a infra/ops y registrar en incident report

Runbook 4 — Signer/Relayer sin saldo
- 1) Verificar saldo de la cuenta encargada de pagar gas
- 2) Enviar fondos desde wallet operativa (sólo si procedimiento aprobado) o activar script de top-up (automatizado)
- 3) Si no hay acceso operativo → multisig emergency flow para transferir fondos

Comunicación y escalado
- Escalar a oncall inmediatamente para P1
- Notificar en canal Slack #lanark-incident y crear ticket con tags: [severity], [txhash], [owner]

---

## 6) Checklist de despliegue y criterios de sign-off

Pre-despliegue (Checklist):
- [ ] Merge de PR aprobado por: 2 reviewers + QA + Seguridad (si aplica)
- [ ] CI: Todos los checks verdes (unit + lint + build)
- [ ] Tests: Integration & E2E ejecutados en staging y green
- [ ] Auditoría/scorecard de seguridad pasada (o mitigaciones documentadas)
- [ ] DB: backups completos y snapshot antes de migraciones (timestamped)
- [ ] Infra: Terraform plan revisado y aprobado
- [ ] Delivery notes y artefactos subidos a `releases/<tag>`
- [ ] Feature flags preparados para rollback rápido

Despliegue (procedimiento):
- [ ] Poner release en modo canary (si soportado) o deploy en staging primero
- [ ] Ejecutar migraciones (con stepwise plan y posibilidad de revert)
- [ ] Activar health checks y smoke tests automáticos
- [ ] Verificar métricas y logs durante 15-30 minutos

Post-despliegue y sign-off:
- [ ] Smoke tests exitosos en producción
- [ ] Métricas (latency, error rate) dentro de umbral pre-definido
- [ ] QA sign-off (lista de pruebas manuales completada)
- [ ] Seguridad y cumplimiento sign-off (si aplica)
- [ ] Product / PO sign-off

Criterios de rechazo (NO GO):
- Fallos en smoke tests
- Aumento de error rate > 0.5% en 15m
- Migraciones que no tengan rollback verificable

Owners (roles)
- Desarrollo frontend: @dev-frontend
- Desarrollo backend / integraciones: @dev-backend
- Infra/Ops: @ops-team
- QA: @qa-lead
- Seguridad / Auditoría: security@example.com
- Product / PO: @product-owner

---

## 7) Plan de rollback

Principios:
- Priorizar rollback del servicio (deploy revert) antes de revertir datos
- Evitar revert irreversible de migraciones en caliente sin snapshot

Pasos rápidos:
1) Activar feature-flag para bloquear nuevas órdenes (si existe)
2) Revertir deployment a `release/<previous-tag>` vía CD (Vercel/GH Actions)
3) Verificar salud del servicio revertido y smoke tests
4) Si rollback requiere revertir cambios de esquema DB:
   - Restaurar snapshot DB creado inmediatamente antes del despliegue
   - Re-play de eventos pendientes que sean idempotentes
5) Comunicar estado a stakeholders y abrir post-mortem

Rollback en caso de problema con smart contract:
- Si el contrato fue desplegado con error y no tiene función de pause: activar multisig emergency (pausar flujos off-chain) y coordinar con legal y auditoría para mitigación y plan de migración

---

## 8) Contactos y accesos requeridos

Canales de comunicación y on-call:
- Slack: #lanark-dev, #lanark-ops, #lanark-incident
- On-call / PagerDuty: equipo-ops-oncall (configuración requerida)

Accesos (solicitar mediante ticket a Infra):
- GitHub repo: `Jonesh05/lanark-marketplace` — Roles: read/write/admin según tarea
- CI/CD: GitHub Actions / Vercel — permiso de deploy para @ops-team y release managers
- Supabase console: role: read/write para ops; read-only para auditors
- PostgreSQL (DB): read-only para auditors; admin (ops) para despliegue/migrations
- Redis: ops access
- KMS/Vault: admin (ops), limited role for services
- Celo RPC provider / Relayer dashboard: ops access
- Grafana / Prometheus: dashboards (read) para todos; edit for ops
- Sentry / Datadog: error logs access
- Contract multisig: lista de signers y procesos de firma (en repo infra/multisig/README.md)

Proceso de solicitud:
- Abrir ticket en JIRA o sistema de IT con: propósito, alcance, duración del acceso y rol solicitado. Adjuntar aprobación del manager responsable.

---

## 9) Notas de seguridad (manejo off-band de claves)

Reglas obligatorias:
- Nunca almacenar claves privadas en el repositorio ni en sistemas de CI en texto plano.
- Claves operativas mainnet: almacenar en HSM o KMS con control de acceso (ex: AWS KMS + CloudHSM, HashiCorp Vault + HSM)
- Para firmas humanas usar hardware wallets (Ledger/Trezor) y procesos multisig para operaciones críticas.
- CI/CD: usar variables de entorno secretas inyectadas desde el vault del proveedor, con rotación automática programada.
- Distribución de claves: usar vault + aprovisionamiento temporal y auditable (leases short-lived)
- Rotación y revocación: documentar procedimiento de rotación y rotar claves con intervalos definidos (ej. 90 días) o tras cualquier sospecha de compromiso
- Auditoría: habilitar logging de acceso a KMS y crear alertas para accesos inusuales

Procedimiento ante compromiso de clave:
1) Identificar clave comprometida y scope
2) Inmediatamente retirar la clave de producción (desactivar en KMS)
3) Activar multisig o claves de emergencia para recuperar operaciones críticas
4) Notificar seguridad, ops, legal y stakeholders
5) Ejecutar rotación y re-deploy de artefactos que dependan de la clave
6) Post-mortem y lecciones aprendidas

---

## 10) Legal / Auditoría — artefactos y criterios

Entregar a legal/auditoría:
- legal/compliance_summary.md — alcance, jurisdicción y data flows
- contratos y ABIs de smart contracts
- registro de firmas y EIP-712 schema (crypto/eip712/*)
- registros de pruebas y resultados (QA test_plan.md y test_vectors)
- reportes de auditoría de smart contracts
- políticas de retención de datos y hashing de PII (legal/data_retention_policy.md)

Criterios de aprobación legal:
- Pruebas de privacidad: hashing de PII con keccak256 antes de persistir
- Documentación de flujo de fondos y reconciliación (settlement timeline)
- Registro de consentimientos y TOS/Privacy links

---

## 11) Apéndice: ejemplos

### EIP-712 (ejemplo de typedData)

```json
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Offer": [
      {"name": "productId", "type": "uint256"},
      {"name": "quantity", "type": "uint256"},
      {"name": "unitPriceCUSD", "type": "uint256"},
      {"name": "buyer", "type": "address"},
      {"name": "expiry", "type": "uint256"}
    ]
  },
  "domain": {
    "name": "Lanark Marketplace",
    "version": "1",
    "chainId": 44787,
    "verifyingContract": "0x{40_hex}"
  },
  "primaryType": "Offer",
  "message": {
    "productId": 1234,
    "quantity": 3,
    "unitPriceCUSD": 2500,
    "buyer": "0x{40_hex}",
    "expiry": 1700000000
  }
}
```

### State machine (resumen)

- DRAFT -> OFFER_CREATED -> OFFER_ACCEPTED -> PEF_CREATED -> PAYMENT_PENDING -> ESCROWED -> SETTLEMENT_PENDING -> SETTLED -> COMPLETED
- Estados alternos: DISPUTED -> RESOLVED -> REFUNDED

---

## 12) Recomendaciones finales y próximos pasos

- Confirmar listado final de artefactos y ubicaciones en `releases/<tag>` antes de la entrega formal.
- Agendar walkthrough de 60–90 minutos con los equipos (Dev, Ops, QA, Legal) para explicar runbooks y despliegue.
- Verificar accesos 48h antes del despliegue y generar backups/snapshots.

---

Si falta algún artefacto o deseas que incluya plantillas específicas (ej. script para restore DB, playbook de multisig), indícalo y lo agregaré.
