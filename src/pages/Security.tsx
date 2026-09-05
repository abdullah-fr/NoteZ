import { CheckCircle2, LockKeyhole, Server, UserRoundCheck } from 'lucide-react';
import { PublicPageShell, PolicyList, PolicySection } from '@/components/landing/PublicPageShell';

const CONTROLS = [
  {
    icon: UserRoundCheck,
    title: 'Account-scoped access',
    description: 'User data is associated with the authenticated account, and database access policies are intended to prevent cross-account reads and writes.',
  },
  {
    icon: LockKeyhole,
    title: 'Protected configuration',
    description: 'AI provider credentials and private model configuration stay on the server instead of being shipped in browser code or client storage.',
  },
  {
    icon: Server,
    title: 'Controlled processing',
    description: 'AI requests go through NoteZ backend functions, where authentication, usage checks, and provider calls can be handled consistently.',
  },
];

export default function Security() {
  return (
    <PublicPageShell
      eyebrow="NoteZ / Security"
      title="Security that stays out of your way."
      description="NoteZ is designed to keep your account, study material, and AI-assisted workflows separated and protected as you use them."
      lastUpdated="September 4, 2026"
    >
      <div className="mx-auto max-w-4xl space-y-14 sm:space-y-16">
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card/70 text-primary">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">Our approach</p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Private by design, practical in operation.</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Security is part of the product workflow, not a label added afterward. We limit what the browser receives, scope account data to the signed-in user, and keep sensitive provider configuration on the backend.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="NoteZ security controls">
          {CONTROLS.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm sm:p-6">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>

        <div className="space-y-8 sm:space-y-10">
          <PolicySection title="Data protection">
            <PolicyList>
              <li>Connections to NoteZ use HTTPS/TLS while data moves between your browser and the service.</li>
              <li>Authentication is handled through the account session rather than by exposing private provider credentials to the browser.</li>
              <li>Database policies and account identifiers are used to keep folders, notes, calendar data, focus history, AI history, and other user-specific records scoped to the correct account.</li>
              <li>Uploaded files are treated as account-specific assets and are included in the account deletion workflow.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="AI and secrets">
            <p>
              NoteZ sends AI requests through backend functions. API keys, provider credentials, and model configuration are stored in server-side secrets and are not intentionally included in HTML, browser JavaScript bundles, local storage, or request data sent directly from the browser to a provider.
            </p>
            <p>
              The browser receives only the response needed for the feature you used. Avoid placing passwords, access tokens, or other secrets inside notes and prompts.
            </p>
          </PolicySection>

          <PolicySection title="Account deletion">
            <p>
              Account deletion is designed to remove the account&apos;s associated records and uploaded assets, clear the active session, and prevent the deleted account&apos;s data from remaining in the client workspace. Deleting one account must not delete or expose another account&apos;s data.
            </p>
          </PolicySection>

          <PolicySection title="Your part">
            <PolicyList>
              <li>Use a unique password and do not share your account credentials.</li>
              <li>Sign out on devices you do not control.</li>
              <li>Report suspicious access or unexpected account data as soon as you notice it.</li>
              <li>Keep highly sensitive secrets out of notes, uploads, and AI prompts.</li>
            </PolicyList>
          </PolicySection>

          <PolicySection title="Reporting a security concern">
            <p>
              If you discover a possible security or privacy issue, please report it through the feedback or support channel available in your NoteZ account. Include the affected area, what you observed, and the smallest set of steps needed to reproduce it. Do not include passwords, API keys, or private study material in the report.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p>We appreciate responsible reports and will use them to investigate and improve NoteZ.</p>
            </div>
          </PolicySection>
        </div>
      </div>
    </PublicPageShell>
  );
}
