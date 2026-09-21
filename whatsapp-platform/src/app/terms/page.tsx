import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="21 September 2026">
      <section>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of the WhatsApp
          Business messaging platform (the &quot;Service&quot;) provided by{" "}
          <strong>SitesNSign Prop Tech Pvt. Ltd.</strong> (&quot;we&quot;, &quot;us&quot;). By creating an
          account or otherwise using the Service, you (&quot;Customer&quot;) agree to these Terms.
        </p>
      </section>

      <section>
        <h2>1. The Service</h2>
        <p>
          The Service lets a Customer connect their own WhatsApp Business Account (via Meta&apos;s
          official WhatsApp Cloud API) to send and receive messages, manage contacts and leads, run
          message campaigns, and automate parts of their WhatsApp communication. We are a technology
          provider — we are not Meta/WhatsApp, and use of WhatsApp through the Service is also
          subject to{" "}
          <a
            href="https://www.whatsapp.com/legal/business-policy"
            className="text-brand-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp&apos;s own Business Messaging Policy
          </a>
          , which the Customer agrees to comply with independently of these Terms.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and account registration</h2>
        <ul>
          <li>You must be an authorized representative of a real, lawfully operating business to create an account.</li>
          <li>You are responsible for the accuracy of the information you provide and for keeping your login credentials confidential.</li>
          <li>You are responsible for all activity that occurs under your account, including actions taken by team members you add.</li>
        </ul>
      </section>

      <section>
        <h2>3. Customer responsibilities — WhatsApp messaging consent</h2>
        <p>
          This is the most important section for using WhatsApp responsibly. As the Customer, you
          are solely responsible for:
        </p>
        <ul>
          <li>
            Obtaining valid, documented opt-in consent from every Contact before messaging them on
            WhatsApp, in line with WhatsApp&apos;s policies and applicable law.
          </li>
          <li>Honoring opt-out requests promptly — the Service supports marking a Contact as suppressed, and you must act on such requests.</li>
          <li>The accuracy and legality of the content you send, including template messages and campaign content.</li>
          <li>Not using the Service to send spam, unsolicited marketing without consent, or any content that violates WhatsApp&apos;s policies or applicable law.</li>
          <li>Ensuring you have the right to upload and process any Contact data you put into the Service.</li>
        </ul>
        <p>
          We provide tooling (the Compliance Guardian pre-flight check, suppression lists, opt-in
          tracking) to help you meet these obligations, but the underlying compliance obligation is
          yours as the sender.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Violate any law, or WhatsApp&apos;s or Meta&apos;s policies;</li>
          <li>Send spam, phishing, malware, or fraudulent content;</li>
          <li>Attempt to circumvent tenant isolation, security controls, or rate limits;</li>
          <li>Resell or sublicense access to the Service without our prior written consent (see Section 9 on reselling);</li>
          <li>Reverse-engineer or attempt to extract the Service&apos;s source code.</li>
        </ul>
      </section>

      <section>
        <h2>5. Fees and billing</h2>
        <ul>
          <li>Subscription plans and pricing are as displayed in the Service at the time of purchase and may be changed prospectively with notice.</li>
          <li>Payments are processed through our payment processor (Razorpay); we do not store your card details.</li>
          <li>Fees are non-refundable except as required by law or as we expressly state in writing.</li>
          <li>Message-level charges from Meta (WhatsApp&apos;s own per-message pricing) may apply in addition to your subscription fee and are passed through, not marked up without disclosure.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data and privacy</h2>
        <p>
          Our collection and use of data is described in our{" "}
          <a href="/privacy" className="text-brand-700 underline">
            Privacy Policy
          </a>
          . As between you and us, you retain ownership of the Contact and business data you upload
          to the Service; we process it only to provide the Service to you.
        </p>
      </section>

      <section>
        <h2>7. Third-party services</h2>
        <p>
          The Service depends on Meta&apos;s WhatsApp Cloud API and, once enabled, Razorpay for
          payments. We are not responsible for outages, policy changes, or account actions
          (including WhatsApp number bans or messaging-limit changes) taken by Meta or Razorpay,
          though we will make reasonable efforts to help you resolve issues arising from them.
        </p>
      </section>

      <section>
        <h2>8. Intellectual property</h2>
        <p>
          We retain all rights to the Service&apos;s software, design, and branding. You retain all
          rights to your own business data and content. You grant us a limited license to process
          your data solely to provide the Service.
        </p>
      </section>

      <section>
        <h2>9. Reselling to your own clients</h2>
        <p>
          If your plan permits it, you may use the Service&apos;s multi-tenant features to onboard
          your own clients as sub-accounts. You are responsible for your clients&apos; compliance
          with these Terms and WhatsApp&apos;s policies as if it were your own conduct, and for any
          agreement you have with your clients regarding their data and pricing.
        </p>
      </section>

      <section>
        <h2>10. Disclaimers and limitation of liability</h2>
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind, to the maximum
          extent permitted by law. To the maximum extent permitted by law, we are not liable for
          indirect, incidental, or consequential damages, or for any loss arising from a WhatsApp
          account suspension, messaging-limit change, or Meta policy enforcement action, except
          where such limitation is not permitted by law.
        </p>
      </section>

      <section>
        <h2>11. Termination</h2>
        <p>
          Either party may terminate an account as described in the applicable plan terms. We may
          suspend or terminate access immediately for a material violation of these Terms,
          WhatsApp&apos;s policies, or applicable law.
        </p>
      </section>

      <section>
        <h2>12. Changes to these Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Service after an update constitutes acceptance of the revised Terms.</p>
      </section>

      <section>
        <h2>13. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute will be subject to the
          exclusive jurisdiction of the courts at [city to be inserted].
        </p>
      </section>

      <section>
        <h2>14. Contact</h2>
        <p>Questions about these Terms: <strong>[legal contact email to be inserted]</strong></p>
      </section>
    </LegalPage>
  );
}
