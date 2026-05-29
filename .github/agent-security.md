# Security Agent

Role: Security / RLS / Privacy (executor)
Scope: Audit RLS, vendor-lock, PII handling, and recommend non-destructive fixes.
Tasks:
- Review app/api/auth/wallet/route.ts vendor-lock enforcement and advise DB/RLS migrations.
- Check where raw personal data is stored; propose hashing where needed.
- Recommend Sentry/Sendry integration skeleton (no secrets in code).
