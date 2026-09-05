# NoteZ Security & Vulnerability Assessment

Assessment date: 2026-09-05  
Application: NoteZ  
Assessment type: Manual code review, architecture review, safe local verification, production-bundle inspection, dependency analysis, read-only linked Supabase review, and browser checks.

## Executive summary

The review found no exposed Gemini API-key value, Supabase service-role value, database credential, provider URL, model identifier, source map, or executable HTML sink in the production frontend bundle. The live database currently has Row Level Security enabled on all 24 public data tables inspected, and no unrestricted public policies were found. The live `uploads` bucket is private and its object policies use the account ID as the first path segment.

The repository contains fixes for the confirmed URL-fetch, AI-credit, ownership-integrity, Storage-boundary, and prompt-boundary issues. The hardening migration has now been applied to the linked Supabase project, and the eight updated AI/source Edge Functions have been deployed. The remaining work is post-deployment authorization testing plus the hardening items listed below.

Overall status: **🟠 MAJOR SECURITY IMPROVEMENTS REQUIRED**

This status is driven primarily by the deployment boundary and remaining hardening work, not by evidence of a currently exposed frontend secret or a demonstrated cross-account read.

## Scope and limitations

Included:

- React/TypeScript/Vite client source and production output.
- Supabase client usage, Edge Functions, migrations, RLS-related helpers, RPC boundaries, and Storage rules.
- Notes, folders, sources, calendar data, focus data, exams, flashcards, activities, chat, credits, uploads, account deletion, and browser persistence.
- AI request construction, output handling, prompt-injection boundaries, and server-side credit enforcement.
- Safe SSRF vectors, static injection checks, dependency audit, and local browser network/console/storage checks.

Excluded by instruction:

- Authentication and all A07 work: login, signup, reset, brute force, MFA, verification, password policy, and session mechanics.
- Destructive multi-account production testing, denial-of-service testing, attacks against Supabase/Gemini infrastructure, and third-party infrastructure scanning.

The browser checks used the signed-out local application. No account credentials were used in the audit, and no production data was deleted or modified.

## Verification evidence

| Check | Result |
| --- | --- |
| `npm run build` | Passed; Vite completed with the existing large-chunk warning. |
| `npx tsc --noEmit` | Passed. |
| `git diff --check` | Passed. |
| Edge Function syntax bundles | Passed for the eight reviewed functions using esbuild. |
| `npm audit --omit=dev --audit-level=moderate` | Two moderate React Router advisories remain; automated remediation requires a breaking major upgrade. |
| Full lint | Existing baseline remains 70 issues; no unrelated lint cleanup was attempted. |
| Production bundle secret scan | Zero matches for key-shaped values, provider URLs, model markers, service-role/database markers, private environment markers, or source maps. |
| Source injection sink scan | Zero matches for `dangerouslySetInnerHTML`, `__html`, `eval`, `new Function`, or `document.write`. |
| Local browser console | Zero errors; two known React Router future-flag warnings and the normal React DevTools info message. |
| Local browser network | Zero direct provider requests, zero direct database requests, and zero private markers in HTML. |
| Local browser persistence | Signed-out page contained only the expected global language preference; no session storage or IndexedDB database. |
| Linked Supabase public tables | 24/24 reported RLS enabled. |
| Linked Supabase unrestricted public policies | 0 found by the read-only policy query. |
| Linked `uploads` bucket | Private; live query confirmed a 120 MB limit and a MIME allowlist. |
| Supabase migration history | Local and remote both include `20260905000000`; the migration was executed and its history repaired. |
| Supabase security advisors | Anonymous trigger-function and mutable-search-path warnings are cleared. Remaining authenticated helper warnings are intentional for RLS/client credit access; the leaked-password warning is A07 and was intentionally not changed. |

## Findings

### F-01 — Server-side source URL fetch could reach private addresses or consume unbounded resources

**Vulnerability:** URL import was a server-side network fetch with incomplete redirect, address, body-size, and timeout controls.  
**OWASP Category:** A10 — Server-Side Request Forgery  
**Severity:** High  
**Location:** `supabase/functions/process-source/index.ts`, `supabase/functions/_shared/url-safety.ts`  
**Attack Scenario:** An authenticated caller submits a URL resolving to loopback/private/link-local space, uses an encoded IPv4 form, redirects through a private address, or returns a slow/oversized response.  
**Impact:** Potential access to internal services, excessive Edge Function memory/time use, or avoidable provider and infrastructure cost.  
**Root Cause:** The previous URL path did not enforce a complete public-address policy and did not keep a response timeout active while reading the response body.  
**Evidence:** Safe local tests rejected loopback, decimal/hex/octal IPv4, private IPv4, IPv6 literals, credentials, nonstandard ports, and FTP. Redirects are manually followed and each target is revalidated; content length and streaming body size are capped at 2 MB and the fetch timeout remains active through body reads.  
**Fix Applied:** Added public URL validation, blocked reserved/private address forms and local hostnames, disabled automatic redirects, capped redirects and response size, restricted content types, and added timeout handling. The source processor validates stored upload paths and file size as well.  
**Retest Result:** Tested blocked vectors were rejected and normal HTTP/HTTPS remained allowed. Edge Function bundles passed.  
**Status:** **Deployed and fixed for tested vectors.** DNS rebinding cannot be fully eliminated by hostname checks alone; high-assurance deployment should add an egress proxy or resolver-level private-address enforcement.

### F-02 — AI credit enforcement was not present on every expensive path

**Vulnerability:** The coach-advice and source-processing paths could reach the AI provider without the same server-side credit gate used by the other AI features.  
**OWASP Category:** A04 — Insecure Design / A08 — Software and Data Integrity Failures  
**Severity:** Medium  
**Location:** `supabase/functions/coach-advice/index.ts`, `supabase/functions/process-source/index.ts`, `supabase/functions/_shared/credits.ts`  
**Attack Scenario:** A caller repeatedly invokes an expensive endpoint directly, bypassing any client-side usage expectation.  
**Impact:** Credit abuse, unexpected provider cost, and unfair resource consumption.  
**Root Cause:** Usage enforcement was inconsistent across Edge Functions and was not centralized at every provider call boundary.  
**Evidence:** Source review found the missing gates; all reviewed user-triggered AI paths now call the server-side deduction helper before the provider request and refund on failure.  
**Fix Applied:** Added fail-closed server-side deduction/refund handling to the affected functions, bounded context/input sizes, and kept client credit state non-authoritative.  
**Retest Result:** Static review confirmed the affected paths charge before the provider call and refund failed requests; Edge Function bundles passed.  
**Status:** **Deployed and fixed.** A production rate-limit policy remains recommended for abuse beyond the credit ledger.

### F-03 — Relationship ownership and mutable owner fields could weaken tenant isolation

**Vulnerability:** Resource relationships such as subject/workspace attachments were not uniformly verified at the database boundary, and shared-row owner fields needed an immutable invariant.  
**OWASP Category:** A01 — Broken Access Control / A04 — Insecure Design  
**Severity:** Medium  
**Location:** `supabase/migrations/20260905000000_security_hardening.sql`, especially subject/workspace policies and owner triggers  
**Attack Scenario:** A caller attempts to attach a note, source, activity, flashcard, or quiz to another account’s subject/workspace, or changes a shared row’s owner during an otherwise authorized update.  
**Impact:** Indirect cross-account visibility or destructive relationship effects if a shared resource later becomes visible to another workspace member.  
**Root Cause:** Ownership of the row and ownership of related resources were not always enforced together, and a workspace editor could otherwise be trusted with a mutable owner assertion.  
**Evidence:** Live catalog review found RLS enabled on all 24 inspected public tables and zero unrestricted public policies, but the code/migration review identified the relationship and owner-integrity gaps targeted by the new migration. No cross-account read was destructively demonstrated.  
**Fix Applied:** Added owner/relationship checks for subjects, workspaces, sources, notes, tasks, flashcards, quizzes, activities, conversations, and optional folder/shared schemas; added database triggers preventing `user_id`/`created_by` retargeting. Viewer updates were corrected to require editor/admin/owner permissions.  
**Retest Result:** Policy expressions and trigger definitions were reviewed; the migration dry run recognizes the migration without applying it.  
**Status:** **Deployed and fixed in the database boundary.** A post-deployment two-account authorization test is still required.

### F-04 — Legacy SECURITY DEFINER functions had unnecessary client execution grants

**Vulnerability:** Live Supabase advisors reported anonymous and/or authenticated execution of legacy `SECURITY DEFINER` helper/trigger functions, plus a mutable search path on `set_updated_at`.  
**OWASP Category:** A05 — Security Misconfiguration / A01 — Broken Access Control  
**Severity:** Low  
**Location:** Live public function ACLs; `supabase/migrations/20260905000000_security_hardening.sql`  
**Attack Scenario:** A caller probes or invokes a trigger/helper RPC exposed through the public schema. The impact depends on each function’s trigger-only assumptions and body.  
**Impact:** Unnecessary privileged API surface and increased risk if a future function body trusts caller-controlled arguments.  
**Root Cause:** Trigger/event functions retained client-role grants, and one trigger helper did not pin its search path.  
**Evidence:** Before deployment, the live advisor returned five anonymous definer-function warnings, several authenticated definer warnings, and the mutable-search-path warning. After deployment, only the authenticated helper warnings remain; the anonymous trigger warnings and mutable-search-path warning are cleared.  
**Fix Applied:** The pending migration revokes client execution from trigger-only functions, pins `set_updated_at` to `public`, and keeps only the authenticated grants needed for RLS helper expressions. Those helper functions bind non-service calls to the caller’s identity.  
**Retest Result:** The live advisor confirms that the addressed anonymous grants and mutable search path are gone. Authenticated grants remain only for helpers used by RLS and the own-account credit summary.  
**Status:** **Deployed and fixed for the identified legacy grant/search-path issue.**

### F-05 — React Router dependency advisories remain

**Vulnerability:** `npm audit` reports two moderate advisories in the React Router 6 dependency range: a backslash open-redirect issue and an SSR hydration error-deserialization issue.  
**OWASP Category:** A06 — Vulnerable and Outdated Components  
**Severity:** Medium  
**Location:** `package.json`, `package-lock.json`  
**Attack Scenario:** Exploitation would require the affected router behavior and attacker-controlled route values or SSR hydration inputs.  
**Impact:** Possible redirect manipulation or SSR-specific data integrity impact.  
**Root Cause:** The application remains on the React Router 6 line; the automated fix installs v7 and is a breaking upgrade.  
**Evidence:** `npm audit --omit=dev --audit-level=moderate` reports two advisories and offers only `npm audit fix --force`. Route review found static route declarations and literal navigation targets; the Vite app does not use React Router SSR hydration and no attacker-controlled route value was found.  
**Fix Applied:** Applied safe patch-level lockfile remediation for other audited packages. The breaking router upgrade was not forced.  
**Retest Result:** Build, TypeScript check, and dependency resolution pass; the two React Router advisories remain.  
**Status:** **Requires Attention.** Plan and regression-test the React Router 7 migration before production release, or obtain a supported 6.x security patch if one becomes available.

### F-06 — Remote migration/schema drift prevents the intended hardening from being live

**Vulnerability:** The linked migration history previously reported older migrations as applied while the live catalog lacked some optional/expected objects; this created schema drift and delayed the new hardening migration.  
**OWASP Category:** A05 — Security Misconfiguration / A08 — Software and Data Integrity Failures  
**Severity:** Medium  
**Location:** Supabase migration history and schema; `supabase/migrations/20260905000000_security_hardening.sql`  
**Attack Scenario:** Deployment proceeds assuming local policies/functions/storage limits exist when the remote project is still on the previous schema.  
**Impact:** Source-level authorization and upload protections do not protect production; schema-dependent features can fail or drift between environments.  
**Root Cause:** Migration history was repaired manually and the new migration was not yet pushed after the earlier connection issue.  
**Evidence:** The earlier migration list showed `20260905000000` local-only and the dry run identified it as pending. The current migration list shows the same timestamp locally and remotely. Live catalog checks still show some optional usage/leaderboard objects absent.  
**Fix Applied:** Added an additive, conditional hardening migration, made optional Storage/folder schemas safe to skip when absent, executed the migration in Supabase, and repaired its migration-history entry after successful execution.  
**Retest Result:** Migration history is synchronized and the live Storage configuration confirms the migration’s upload-boundary change.  
**Status:** **Partially resolved; requires attention.** Keep optional schemas and migration history aligned as those features are enabled.

### F-07 — Edge Functions allow wildcard CORS

**Vulnerability:** Reviewed Edge Functions return `Access-Control-Allow-Origin: *`.  
**OWASP Category:** A05 — Security Misconfiguration  
**Severity:** Low  
**Location:** AI and source-processing Edge Function CORS headers  
**Attack Scenario:** Any website can issue browser cross-origin requests to the endpoints; an attacker still needs a valid bearer token for protected operations.  
**Impact:** Larger cross-origin attack surface and less restrictive browser policy if a future endpoint accidentally omits authorization.  
**Root Cause:** CORS was implemented as a shared permissive default rather than an allowlist of the deployed NoteZ origins.  
**Evidence:** Static review found wildcard origin headers; all reviewed protected functions still perform bearer-token user validation. No unauthenticated data read was demonstrated.  
**Fix Applied:** No code change in this pass because the deployed frontend origin was not supplied and an incorrect allowlist could break legitimate clients.  
**Retest Result:** Authorization checks remain present; browser signed-out requests did not reach a provider or database.  
**Status:** **Requires Attention.** Replace `*` with the exact production/preview origin policy and test OPTIONS plus authenticated requests.

### F-08 — Live upload bucket had no server-side size/MIME limits

**Vulnerability:** The live private `uploads` bucket reported a null size limit and no MIME allowlist, allowing the browser/client to be the only immediate upload filter.  
**OWASP Category:** A05 — Security Misconfiguration / A03 — Injection  
**Severity:** Medium  
**Location:** Live `storage.buckets` configuration; `src/services/upload-policy.ts`; `supabase/migrations/20260905000000_security_hardening.sql`  
**Attack Scenario:** A caller bypasses the file picker and uploads an oversized or unsupported file directly to Storage.  
**Impact:** Resource exhaustion, unwanted content processing, or increased provider/storage cost. Active HTML/SVG types could also create a dangerous downstream rendering boundary if later displayed unsafely.  
**Root Cause:** The live bucket did not enforce the same boundary as the client and processor.  
**Evidence:** Read-only live query returned `public=false`, `file_size_limit=null`, and no MIME allowlist. Storage object policies were owner-prefix scoped, which is a positive control but not a size/content control.  
**Fix Applied:** Added client validation, cleanup on failed source-row creation, a 120 MB processor limit, and a pending migration that makes the bucket private, caps size, and allowlists non-active document/media types.  
**Retest Result:** Local upload policy rejects empty, oversized, and unsupported-extension files; Edge Function bundles and production build pass.  
**Status:** **Deployed and fixed for the configured boundary.** Extension spoofing/content magic-number validation remains a recommended enhancement for high-risk file handling.

### F-09 — Production security headers could not be verified from the repository

**Vulnerability:** The repository does not define the deployment response headers needed for defense in depth, including CSP, frame protection, Referrer-Policy, Permissions-Policy, and MIME sniffing protection.  
**OWASP Category:** A05 — Security Misconfiguration  
**Severity:** Low  
**Location:** Deployment/hosting layer; no response-header configuration was present in the repository.  
**Attack Scenario:** A host deploys the SPA without restrictive browser headers, increasing the impact of a future injection or clickjacking issue.  
**Impact:** Reduced browser-side containment; this is not evidence that the current local app is exploitable.  
**Root Cause:** Headers are normally configured by the hosting platform, which is not represented in the repository.  
**Evidence:** Local HTML and bundle scans were clean, but no production host URL was provided for response-header verification.  
**Fix Applied:** No generic CSP was added because an incorrect policy could break Supabase, media, fonts, or the editor.  
**Retest Result:** Local source/bundle injection scans pass; production headers remain unverified.  
**Status:** **Requires Verification.** Inspect the deployed response headers and add a tested host configuration.

### F-10 — Imported/user content required a stronger AI prompt boundary

**Vulnerability:** Several AI prompts placed source text, editor input, scope, or document metadata directly beside instruction text; chat also placed attached source material inside the system instruction.  
**OWASP Category:** A08 — Software and Data Integrity Failures / A03 — Injection  
**Severity:** Medium  
**Location:** AI Edge Functions, especially `ai-chat`, `editor-ai`, `generate-exam`, `generate-from-source`, `activities-breakdown`, `generate-flashcards`, and `process-source`  
**Attack Scenario:** A malicious note, imported document, web page, or editor input contains instructions such as “ignore prior instructions” and attempts to alter the requested output or induce disclosure.  
**Impact:** Manipulated summaries, exams, activities, or editor output; possible unsafe generated content. No provider credential access was demonstrated.  
**Root Cause:** Untrusted content was not consistently separated from static instructions.  
**Evidence:** Source review identified direct interpolations. The frontend has no raw HTML sink, and no secret/model/provider marker was found in the client bundle.  
**Fix Applied:** Added static security-boundary instructions and explicit tags around user messages, source documents, editor input, scope, notes, and metadata; moved attacker-controlled exam topic/source values out of the system instruction. AI output continues to be treated as data and is schema-limited before persistence.  
**Retest Result:** All modified Edge Functions bundle successfully; source sink scan found no executable HTML rendering path.  
**Status:** **Deployed and fixed for the addressed prompt boundary.** Prompt injection is an inherent AI risk, so provider-side moderation and output review remain necessary.

### F-11 — Browser extension artifact has broader permissions than necessary

**Vulnerability:** The optional `extension/` artifact requests `<all_urls>` and scripting permissions, contains setup placeholders, and reads the active NoteZ tab’s client-side auth state.  
**OWASP Category:** A05 — Security Misconfiguration / A08 — Software and Data Integrity Failures  
**Severity:** Low  
**Location:** `extension/manifest.json`, `extension/popup.js`  
**Attack Scenario:** If distributed before hardening, the extension has a broad browser permission scope and can inspect the active NoteZ page’s local state.  
**Impact:** Excessive extension privilege and possible token exposure within the extension trust boundary. It is not included in the Vite production bundle.  
**Root Cause:** The extension is an incomplete artifact with development placeholders and broad permissions.  
**Evidence:** Manifest/static review confirmed broad URL permission and placeholder configuration; no extension files are shipped in `dist`.  
**Fix Applied:** No change in this pass because the extension is not part of the web application release path.  
**Retest Result:** Production bundle scan does not include the extension artifact.  
**Status:** **Requires Attention.** Do not distribute until permissions are minimized, configuration is completed safely, and the extension token boundary is separately reviewed.

### F-12 — Account deletion is not fully atomic across Storage and Postgres

**Vulnerability:** Relational cleanup runs transactionally with auth deletion, but the delete-account function removes Storage objects before invoking auth deletion. Storage deletion cannot be rolled back if the later database/auth operation fails.  
**OWASP Category:** A04 — Insecure Design / A08 — Software and Data Integrity Failures  
**Severity:** Medium  
**Location:** `supabase/functions/delete-account/index.ts`, `supabase/migrations/20260831000000_complete_account_deletion_cleanup.sql`  
**Attack Scenario:** A transient failure occurs after Storage removal but before the auth/database deletion completes.  
**Impact:** A partially deleted account with missing uploads, or a retry path that needs reconciliation. This does not expose another user’s data when the account prefix and authenticated user ID checks are correct.  
**Root Cause:** Storage and Postgres do not share one transaction, and the current sequence deletes objects first.  
**Evidence:** Code review confirmed recursive account-prefix Storage cleanup followed by admin auth deletion; the database trigger is transactional, but Storage is outside that transaction.  
**Fix Applied:** Account deletion now derives the target from the bearer-authenticated user, enumerates only that user’s Storage prefix/referenced paths, cleans relational records through the database cleanup path, clears client caches, signs out, and redirects.  
**Retest Result:** Static ownership review passed; no destructive production deletion was run in this security audit.  
**Status:** **Requires Attention.** Add an idempotent deletion job/state machine or reconciliation process if strict all-or-nothing deletion across Storage is required.

### F-13 — Own-subject helper can reveal a limited Boolean side channel

**Vulnerability:** The RLS helper needed to validate subject ownership is executable by authenticated roles so policies can call it. A caller who already knows arbitrary UUIDs could probe whether a subject belongs to a supplied owner ID.  
**OWASP Category:** A01 — Broken Access Control  
**Severity:** Low  
**Location:** `public.user_owns_subject` in `supabase/migrations/20260905000000_security_hardening.sql`  
**Attack Scenario:** A signed-in caller directly invokes the helper with guessed identifiers.  
**Impact:** A narrow existence/ownership Boolean signal; it does not return subject content or authorize a mutation by itself.  
**Root Cause:** PostgreSQL evaluates RLS expressions using the querying role, so a helper used by RLS cannot simply be revoked from authenticated users without breaking policy evaluation.  
**Evidence:** Function is `SECURITY DEFINER`, has a fixed search path, and is granted for RLS evaluation; direct arbitrary identity probing is the remaining architectural trade-off.  
**Fix Applied:** The helper is restricted to authenticated/service roles, and callers’ supplied owner identity is checked by the surrounding row policy.  
**Retest Result:** Policy review found no data-returning path through the helper and no demonstrated cross-account read.  
**Status:** **Requires Attention.** Prefer private-schema helpers or a no-argument caller-bound helper design if the Boolean side channel is unacceptable.

## Areas assessed with no confirmed vulnerability

### A02 / secrets and cryptographic exposure

The browser uses only the expected public Supabase client configuration. Server-only provider credentials and provider/model configuration remain in Edge Function code and server environment access. No secret values were printed, committed, placed in `window`, HTML, local storage, session storage, or the production bundle. No custom cryptography was introduced.

### A03 / browser injection and Lexical rendering

The Lexical import path removes scripts, styles, frames, objects, event-handler attributes, unsafe protocols, and dangerous document metadata. The chat Markdown renderer does not enable raw HTML, and calendar links are normalized to HTTP(S) with safe external-link attributes. No `dangerouslySetInnerHTML`, raw-HTML renderer, or DOM execution sink was found. Malicious script/event-handler test strings therefore did not produce a confirmed executable path. AI prompt injection is tracked separately as F-10 because it is an integrity risk rather than a browser XSS finding.

### Account isolation, cache, and persistence

Client user-specific storage uses account-scoped keys; legacy unscoped user-data keys are removed. Auth identity changes clear the previous account’s local/session cache before the next account is rendered, and the app clears the in-memory query cache on identity changes. Credits and folder caches are user-scoped. Supabase realtime filters and service queries reviewed for account data include the authenticated user ID or an ownership policy boundary. The signed-out browser contained no account data, no session storage, and no IndexedDB database. A destructive two-account production test was intentionally not run; it remains a deployment acceptance test after the migration is applied.

### A09 / logging and monitoring

Client logging uses an allowlist of safe user-facing messages and removes unnecessary production debug output. Edge Functions log generic operation failure labels without request bodies, prompts, credentials, provider errors, or private note content. The local browser console showed no application errors. Server-side rate-limit, authorization, and deletion failures should still be monitored through the platform without recording sensitive payloads.

### A10 / other server-side fetches

The only user-influenced server-side network paths found were source URL import, YouTube metadata lookup, and the server-side AI provider integration. The YouTube path uses exact approved hosts and the general URL path uses the F-01 controls. No unrelated arbitrary proxy or internal-network fetch endpoint was found.

## Totals

| Measure | Total |
| --- | ---: |
| Critical vulnerabilities | 0 |
| High vulnerabilities | 1 |
| Medium findings | 7 |
| Low findings | 5 |
| Total findings | 13 |
| Confirmed vulnerabilities/conditions | 11 |
| Potential or deployment-verification findings | 2 |
| Fixed in repository | 6 |
| Fixed and deployed to live Supabase | 6 |
| Partially remediated | 1 |
| Remaining issues before production sign-off | 7 |

“Fixed in repository” means the source or migration contains the fix; it does not mean the live Supabase project has received it.

## OWASP Top 10 coverage summary

| OWASP Category | Status |
| --- | --- |
| A01 Broken Access Control | Findings — live RLS is enabled and no unrestricted public policies were found; relationship/owner hardening is deployed, with two-account verification still required. |
| A02 Cryptographic Failures | Pass — no client secret exposure or inappropriate custom cryptography found in tested scope. |
| A03 Injection | Findings — browser/editor XSS paths passed; AI prompt-boundary hardening is tracked in F-10. |
| A04 Insecure Design | Findings — credit enforcement and ownership integrity are deployed; deletion atomicity remains. |
| A05 Security Misconfiguration | Findings — wildcard CORS, production headers, optional schema drift, and intentional authenticated helper grants remain. |
| A06 Vulnerable and Outdated Components | Findings — two moderate React Router advisories remain. |
| A07 Identification and Authentication Failures | **Not Tested — Out of Scope** |
| A08 Software and Data Integrity Failures | Findings — AI prompt boundary and migration integrity are deployed; cross-system deletion atomicity remains. |
| A09 Security Logging and Monitoring Failures | Pass for reviewed client/server logging behavior; platform alerting and retention were not independently assessed. |
| A10 Server-Side Request Forgery | Findings — tested SSRF/resource-exhaustion vectors are mitigated in the deployed function; DNS-rebinding/egress enforcement remains an infrastructure consideration. |

## Post-deployment verification sequence

The migration and Edge Functions have been deployed. Do not run the migration again. Use these read-only checks:

```bash
npx supabase migration list
npx supabase functions list
npx supabase db advisors --linked --type security --level warn --fail-on none
```

After deployment, verify:

1. The hardening migration appears on both local and remote migration lists.
2. Live Storage shows the private bucket, 120 MB limit, and MIME allowlist.
3. Security advisors no longer report the addressed anonymous trigger grants or mutable search path. Authenticated helper warnings may remain because RLS uses those helpers.
4. Two test accounts cannot read, update, delete, restore, or attach each other’s rows.
5. Signing out and signing into the second account never renders the first account’s cached folders, calendar, timer, notes, exams, flashcards, chat, or credits.
6. Direct calls to every AI function require the bearer-authenticated user and consume/refund server-side credits correctly.
7. URL imports reject private/loopback/redirect/oversized/unsupported targets.
8. Production response headers and exact CORS origins are verified at the deployed host.

For the Storage check, paste this SQL into **Supabase Dashboard → SQL Editor → New query**, not into the terminal:

```sql
select
  id,
  public,
  file_size_limit,
  allowed_mime_types is not null as has_mime_allowlist
from storage.buckets
where id = 'uploads';
```

Authentication security (OWASP A07) was intentionally excluded from this audit and requires a separate security assessment.
