import { PublicPageShell, PolicyList, PolicySection } from '@/components/landing/PublicPageShell';

export default function Privacy() {
  return (
    <PublicPageShell
      eyebrow="NoteZ / Privacy"
      title="Your study material stays yours."
      description="This policy explains what NoteZ collects, why it is needed, and the choices you have over your account and study data."
      lastUpdated="September 4, 2026"
    >
      <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
        <PolicySection title="1. What we collect">
          <p>When you create and use a NoteZ account, we may process the following information:</p>
          <PolicyList>
            <li>Account details such as your email address, name, and authentication information.</li>
            <li>Study content you choose to save, including folders, notes, uploaded sources, flashcards, exams, quiz results, and activities.</li>
            <li>Planning and focus information, including calendar events, focus sessions, routines, and related progress.</li>
            <li>Messages and context you submit to NoteZ AI features, along with the resulting responses needed to provide those features.</li>
            <li>Feedback, support messages, preferences, language or theme choices, and service usage information.</li>
          </PolicyList>
        </PolicySection>

        <PolicySection title="2. How we use your information">
          <p>We use this information to operate and improve NoteZ. That includes:</p>
          <PolicyList>
            <li>Authenticating you and keeping your account and study space separate from other accounts.</li>
            <li>Saving, displaying, synchronizing, and organizing the content you create.</li>
            <li>Generating the AI-assisted explanations, summaries, flashcards, exams, and study guidance you request.</li>
            <li>Tracking plan allowances and usage so we can apply limits and show accurate account information.</li>
            <li>Protecting the service, responding to support requests, fixing errors, and understanding which workflows need improvement.</li>
          </PolicyList>
        </PolicySection>

        <PolicySection title="3. AI-assisted features">
          <p>
            When you use an AI feature, the relevant prompt and study context are sent through NoteZ&apos;s backend so the request can be processed. We keep provider credentials and model configuration on the server; they are not part of the NoteZ browser application.
          </p>
          <p>
            Do not include passwords, payment credentials, or other secrets in a note or AI prompt. AI responses can be incomplete or inaccurate, so review important information before relying on it.
          </p>
        </PolicySection>

        <PolicySection title="4. Storage and sharing">
          <p>
            NoteZ uses hosted application infrastructure to store account and study data. Access is tied to your authenticated account, and user-specific records are designed to be scoped to the account that created them.
          </p>
          <p>
            We do not sell your study material. We share information only when needed to provide a requested feature, operate the service, comply with a valid legal obligation, or protect NoteZ and its users.
          </p>
        </PolicySection>

        <PolicySection title="5. Your choices and account deletion">
          <PolicyList>
            <li>You can review and update account information and preferences from Account Settings.</li>
            <li>You can choose whether to use AI features; using the rest of the workspace does not require submitting an AI prompt.</li>
            <li>You can delete your account from Account Settings. Account-associated records and uploaded files are removed as part of the deletion flow, and the session is signed out.</li>
            <li>Some limited records may need to be retained when required for security, fraud prevention, legal compliance, or system backups. They are not kept for ordinary product use.</li>
          </PolicyList>
        </PolicySection>

        <PolicySection title="6. Changes to this policy">
          <p>
            We may update this policy as NoteZ changes. The date above shows when this version was last revised. If a change materially affects how we use personal information, we will provide notice through the service or another appropriate channel.
          </p>
          <p>
            Questions about this policy can be sent through the feedback or support channel available in your NoteZ account.
          </p>
        </PolicySection>
      </div>
    </PublicPageShell>
  );
}
