import { PublicPageShell, PolicyList, PolicySection } from '@/components/landing/PublicPageShell';

export default function Terms() {
  return (
    <PublicPageShell
      eyebrow="NoteZ / Terms"
      title="A clear agreement for a focused workspace."
      description="These terms set the ground rules for using NoteZ responsibly and explain what you can expect from the service."
      lastUpdated="September 4, 2026"
    >
      <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
        <PolicySection title="1. Using NoteZ">
          <p>
            By creating an account or using NoteZ, you agree to these terms and our Privacy Policy. You must provide accurate account information, keep your sign-in details secure, and use the service only as allowed by law.
          </p>
          <p>
            NoteZ is intended for personal study and learning workflows. You are responsible for the activity that takes place through your account.
          </p>
        </PolicySection>

        <PolicySection title="2. Your content">
          <p>
            You keep ownership of the notes, files, prompts, and other material you submit to NoteZ. You give NoteZ the limited permission needed to host, process, display, back up, and transform that material to provide the features you request.
          </p>
          <p>
            You must have the right to upload or use the material you submit. Do not upload content that violates another person&apos;s rights, contains malware, or includes sensitive information you are not authorized to process.
          </p>
        </PolicySection>

        <PolicySection title="3. AI output and study decisions">
          <p>
            NoteZ can generate explanations, summaries, practice material, and recommendations. AI output is provided as a study aid and may be wrong, incomplete, or unsuitable for your specific situation.
          </p>
          <p>
            You are responsible for checking important facts and deciding how to use generated material. NoteZ is not a substitute for a teacher, academic institution, professional adviser, or emergency service.
          </p>
        </PolicySection>

        <PolicySection title="4. Plans, limits, and payments">
          <p>
            NoteZ may offer free and paid plans with different allowances or features. Plan details, prices, and limits are shown on the Pricing page or in your account before you choose a plan.
          </p>
          <PolicyList>
            <li>Usage allowances are applied to the account and plan that generated the request.</li>
            <li>You may change or cancel a paid plan through the account controls made available for that plan.</li>
            <li>Unless a law requires otherwise, fees already charged for a billing period are not automatically refundable.</li>
            <li>We may change plan details or pricing in the future and will provide notice when required.</li>
          </PolicyList>
        </PolicySection>

        <PolicySection title="5. Prohibited activity">
          <p>You may not:</p>
          <PolicyList>
            <li>Attempt to access another account, bypass account limits, or interfere with user-data separation.</li>
            <li>Probe, overload, scrape, reverse engineer, or disrupt NoteZ or its supporting systems.</li>
            <li>Use NoteZ to create malware, facilitate abuse, infringe rights, or submit unlawful content.</li>
            <li>Share account credentials or use automation to evade rate limits or other safeguards.</li>
          </PolicyList>
        </PolicySection>

        <PolicySection title="6. Availability and termination">
          <p>
            We work to keep NoteZ available and reliable, but the service may occasionally change, pause, or become unavailable for maintenance, updates, or circumstances outside our control. We do not promise that every feature will always be error-free or uninterrupted.
          </p>
          <p>
            You can stop using NoteZ at any time. We may suspend or terminate access if an account creates a security, legal, or operational risk. Account deletion removes associated data according to the Privacy Policy and the deletion flow.
          </p>
        </PolicySection>

        <PolicySection title="7. Changes and contact">
          <p>
            We may update these terms as the product evolves. Continued use after an updated version becomes effective means you accept the revised terms. If you do not agree, stop using NoteZ and delete your account.
          </p>
          <p>
            Questions about these terms can be sent through the feedback or support channel available in your NoteZ account.
          </p>
        </PolicySection>
      </div>
    </PublicPageShell>
  );
}
