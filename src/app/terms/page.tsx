import type { Metadata } from "next";
import Link from "next/link";
import { ContactComingSoon, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="November 5, 2026"
      intro={
        <p>
          Groundswell is a free place for neighbours to raise local causes and organize around them, run by the Groundswell team. By
          creating an account or using Groundswell, you agree to these terms and to the <Link href="/conduct">code of conduct</Link>.
        </p>
      }
    >
      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be 13 or older.</li>
          <li>One account per person, in your own name or the name your neighbours know you by. Don&apos;t pretend to be someone else.</li>
          <li>Keep your password to yourself. You&apos;re responsible for what happens on your account.</li>
          <li>You can delete your account at any time from <Link href="/me">your activity page</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>What you post</h2>
        <ul>
          <li>What you post stays yours. You let us show it on Groundswell, and keep it there as described in the <Link href="/privacy">privacy policy</Link>.</li>
          <li>You&apos;re responsible for what you post. Make sure it&apos;s true as far as you know, and that you have the right to share it.</li>
          <li>Follow the <Link href="/conduct">code of conduct</Link>. We may remove anything that breaks it, and close accounts for serious or repeated problems.</li>
        </ul>
      </section>

      <section>
        <h2>Events and meeting up</h2>
        <ul>
          <li>Events are organized by members, not by Groundswell. We don&apos;t check, run or supervise them.</li>
          <li>Meet in public places, tell someone where you&apos;re going, and leave if something feels wrong.</li>
        </ul>
      </section>

      <section>
        <h2>Representatives and letters</h2>
        <ul>
          <li>
            Representative details come from public sources (Open North) and can be out of date. Check before you rely on them.
          </li>
          <li>Letters and emails you write with Groundswell are sent by you, from your own email. Groundswell doesn&apos;t send them for you.</li>
        </ul>
      </section>

      <section>
        <h2>The service</h2>
        <ul>
          <li>
            Groundswell is free and provided as it is. We work to keep it running and accurate, but we can&apos;t promise it will
            always be available or error-free.
          </li>
          <li>
            As far as the law allows, the Groundswell team isn&apos;t responsible for what members post or do, at events or
            elsewhere, or for losses from using or not being able to use Groundswell.
          </li>
          <li>We may change or stop features. If we ever shut Groundswell down, we&apos;ll give notice on the site first.</li>
        </ul>
      </section>

      <section>
        <h2>Changes to these terms</h2>
        <p>
          We&apos;ll update this page and the date at the top when these terms change. Big changes will be announced on the site
          first. Using Groundswell after a change means you accept the new terms.
        </p>
        <div className="mt-4">
          <ContactComingSoon />
        </div>
      </section>
    </LegalPage>
  );
}
