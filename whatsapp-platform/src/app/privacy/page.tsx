import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="21 September 2026">
      <section>
        <p>
          This Privacy Policy explains how <strong>SitesNSign Prop Tech Pvt. Ltd.</strong> (&quot;we&quot;,
          &quot;us&quot;, &quot;our&quot;) collects, uses, discloses, and protects information through our WhatsApp
          Business messaging platform (the &quot;Service&quot;), including when businesses (&quot;Customers&quot;)
          use the Service to communicate with their own end users (&quot;Contacts&quot;) over WhatsApp.
        </p>
        <p>
          <strong>[Registered office address to be inserted]</strong> · Contact:{" "}
          <strong>[privacy contact email to be inserted]</strong>
        </p>
      </section>

      <section>
        <h2>1. Who this policy applies to</h2>
        <p>Two categories of people interact with the Service, and this policy covers both:</p>
        <ul>
          <li>
            <strong>Customers</strong> — the businesses (and their team members) who sign up for an
            account on the platform to manage their own WhatsApp Business presence, contacts, and
            messaging.
          </li>
          <li>
            <strong>Contacts</strong> — the individuals a Customer messages or is messaged by through
            WhatsApp. Contacts do not create accounts on this platform; their data is provided to us
            by the Customer or received directly from WhatsApp on the Customer&apos;s behalf.
          </li>
        </ul>
        <p>
          For Contacts&apos; data, the Customer is the data controller and we act as a data processor
          on the Customer&apos;s instructions. Questions about a specific Contact&apos;s data should
          first be directed to the Customer (the business messaging them), who can also action a
          deletion request — see our{" "}
          <a href="/data-deletion" className="text-brand-700 underline">
            Data Deletion
          </a>{" "}
          page.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong>: name, email, password (stored hashed, never in plain
            text), organization/company name, role, and team membership.
          </li>
          <li>
            <strong>WhatsApp connection data</strong>: WhatsApp Business Account ID, phone number ID,
            and an access token issued by Meta for the Customer&apos;s own WhatsApp number (encrypted
            at rest).
          </li>
          <li>
            <strong>Contact and lead data</strong>: whatever the Customer uploads or that WhatsApp
            sends us on their behalf — phone numbers, names, tags, message content, message
            status, and opt-in/opt-out records.
          </li>
          <li>
            <strong>Billing data</strong>: subscription plan, invoice history. Card/payment details
            are handled directly by our payment processor (Razorpay) and are not stored on our
            servers.
          </li>
          <li>
            <strong>Usage and log data</strong>: sign-in activity, audit logs of account actions
            (e.g. team role changes, API key creation), and technical logs needed to operate and
            secure the Service.
          </li>
          <li>
            <strong>Cookies</strong>: a session cookie to keep a Customer signed in. We do not use
            third-party advertising or tracking cookies.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. How we use it</h2>
        <ul>
          <li>To operate the Service: sending/receiving WhatsApp messages on a Customer&apos;s behalf, storing conversation history, and running the dashboard, CRM, and campaign features the Customer configures.</li>
          <li>To bill Customers for their subscription and usage.</li>
          <li>To secure the platform: detecting abuse, keeping an audit trail, and enforcing tenant isolation so no Customer can see another Customer&apos;s data.</li>
          <li>To communicate with Customers about their account, billing, or changes to the Service.</li>
          <li>To comply with legal obligations and respond to lawful requests.</li>
        </ul>
        <p>We do not sell personal data, and we do not use Contact data for advertising.</p>
      </section>

      <section>
        <h2>4. Who we share it with</h2>
        <ul>
          <li>
            <strong>Meta / WhatsApp</strong> — messages sent and received necessarily pass through
            Meta&apos;s WhatsApp Cloud API, governed by{" "}
            <a
              href="https://www.whatsapp.com/legal/business-data-processing-terms"
              className="text-brand-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Meta&apos;s own data processing terms
            </a>
            .
          </li>
          <li>
            <strong>Razorpay</strong> — for payment processing, once a Customer&apos;s subscription
            billing is active.
          </li>
          <li>
            <strong>Service providers</strong> who host our infrastructure (our servers are operated
            on a VPS we control) under confidentiality obligations.
          </li>
          <li>Law enforcement or regulators, only where legally required.</li>
        </ul>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <p>
          We retain account and messaging data for as long as a Customer&apos;s account is active,
          plus a reasonable period afterward for legal, tax, and dispute-resolution purposes.
          Audit logs are kept indefinitely as an immutable security record. A Customer can request
          export or deletion of their organization&apos;s data at any time from their dashboard
          Settings page, or an individual Contact&apos;s data via the Customer.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We use database-level tenant isolation (row-level security) so one Customer&apos;s data is
          never visible to another, encrypt WhatsApp access tokens at rest, hash passwords, and log
          security-relevant account actions. No system is perfectly secure, and we cannot guarantee
          absolute security, but we take reasonable technical and organizational measures
          appropriate to the sensitivity of the data involved.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          Subject to applicable law (including India&apos;s Digital Personal Data Protection Act,
          2023), you may have the right to access, correct, or request deletion of your personal
          data, and to withdraw consent to messaging at any time. See our{" "}
          <a href="/data-deletion" className="text-brand-700 underline">
            Data Deletion
          </a>{" "}
          page for how to exercise a deletion request.
        </p>
      </section>

      <section>
        <h2>8. Children</h2>
        <p>The Service is intended for business use and is not directed at children.</p>
      </section>

      <section>
        <h2>9. International transfers</h2>
        <p>
          Because the Service uses Meta&apos;s WhatsApp Cloud API, message data may be processed on
          Meta&apos;s infrastructure outside India, under Meta&apos;s own data processing terms.
        </p>
      </section>

      <section>
        <h2>10. Grievance Officer</h2>
        <p>
          In accordance with applicable Indian law, grievances regarding this policy or the
          handling of personal data may be addressed to:
          <br />
          <strong>[Grievance Officer name to be inserted]</strong>
          <br />
          <strong>[Grievance Officer email/address to be inserted]</strong>
        </p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by
          updating the &quot;last updated&quot; date above.
        </p>
      </section>

      <section>
        <h2>12. Governing law</h2>
        <p>This policy is governed by the laws of India, courts at [city to be inserted] having jurisdiction.</p>
      </section>
    </LegalPage>
  );
}
