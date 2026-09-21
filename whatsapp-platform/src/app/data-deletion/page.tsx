import { LegalPage } from "@/components/legal-page";

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion" lastUpdated="21 September 2026">
      <section>
        <p>
          This page explains how to request deletion of your data from the WhatsApp Business
          messaging platform operated by <strong>SitesNSign Prop Tech Pvt. Ltd.</strong> There are
          two different kinds of requests, depending on who you are.
        </p>
      </section>

      <section>
        <h2>If you are a business using this platform (a &quot;Customer&quot;)</h2>
        <p>You can delete your own data directly, without waiting on us:</p>
        <ul>
          <li>
            <strong>Delete a single contact</strong>: go to Dashboard → Contacts, and use the
            &quot;Delete&quot; action next to the contact. This removes the contact and its
            associated conversations and messages immediately.
          </li>
          <li>
            <strong>Export your organization&apos;s data</strong>: Dashboard → Settings →
            &quot;Download export&quot; gives you a full JSON export of your contacts, leads,
            conversations, messages, and templates.
          </li>
          <li>
            <strong>Delete your entire organization</strong>: Dashboard → Settings → &quot;Request
            organization deletion&quot;. This does not happen instantly — it flags your account for
            a platform administrator to review and action, since deleting an entire organization&apos;s
            data cannot be undone. You will be contacted if we need anything further from you.
          </li>
        </ul>
      </section>

      <section>
        <h2>If you are an individual contacted via WhatsApp by a business using this platform</h2>
        <p>
          If a business messaged you on WhatsApp using this platform, that business — not us
          directly — is the one who controls your contact information and message history (we act
          only as their technology processor). To request your data be deleted:
        </p>
        <ol>
          <li>Contact the business directly (the WhatsApp number or business you were messaged from) and ask them to delete your data — they can do this immediately from their own dashboard, as described above.</li>
          <li>
            If you are unable to reach the business, or your request goes unaddressed, email us at{" "}
            <strong>[data deletion request email to be inserted]</strong> with the business name, the
            phone number that was messaged, and your request. We will identify the responsible
            Customer and act on your request within a reasonable time where required by law.
          </li>
        </ol>
      </section>

      <section>
        <h2>What gets deleted</h2>
        <p>
          A contact deletion removes the contact record, their conversations, and their messages
          from our active database. A small number of records may be retained where necessary for
          legal, security, or audit purposes (for example, an immutable audit log entry recording
          that a deletion occurred, which itself contains no message content) — see our{" "}
          <a href="/privacy" className="text-brand-700 underline">
            Privacy Policy
          </a>{" "}
          for our retention approach.
        </p>
      </section>

      <section>
        <h2>Timeframe</h2>
        <p>
          Customer-initiated contact deletions are immediate. Requests routed through us directly
          (the email above) are actioned within a reasonable time, and in any case within any
          timeframe required by applicable law.
        </p>
      </section>
    </LegalPage>
  );
}
