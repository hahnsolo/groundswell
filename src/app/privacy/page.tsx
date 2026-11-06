import type { Metadata } from "next";
import Link from "next/link";
import { ContactComingSoon, LegalPage } from "@/components/legal-page";
import { REMOVAL_RETENTION_DAYS } from "@/lib/moderation";
import { ACCOUNT_GRACE_DAYS } from "@/lib/accounts";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="November 5, 2026"
      intro={
        <p>
          Groundswell is run by the Groundswell team. This page explains, in plain words, what we keep about you, why, who else
          handles it, how long we keep it, and what you can do about it.
        </p>
      }
    >
      <section>
        <h2>The short version</h2>
        <ul>
          <li>We keep what we need to run Groundswell: your name, your email, and what you post.</li>
          <li>We only ever store a rough area (like <strong>M5V</strong> or a US ZIP code), never your street address.</li>
          <li>We don&apos;t sell your information, show ads, or track you around the web.</li>
          <li>You can leave a cause or delete your account yourself, at any time.</li>
        </ul>
      </section>

      <section>
        <h2>What we keep, and why</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name (shown next to what you post), your email (never shown to anyone else; used to
            sign in and to send you account emails), and your password, stored scrambled so even we can&apos;t read it. If you sign in
            with Google or Apple, we get your name and email from them.
          </li>
          <li>
            <strong>Your home area, if you add one:</strong> your country and the first part of your postal code, or your ZIP code. It
            lets us show you what&apos;s happening nearby.
          </li>
          <li>
            <strong>What you do on Groundswell:</strong> causes you start, chat messages, events you create or say you&apos;re going
            to, campaigns, signatures (and any note you add), the causes you join, and reports you make.
          </li>
          <li>
            <strong>To keep accounts safe:</strong> when you sign in, we keep your device&apos;s network address and browser type with
            your session, so suspicious sign-ins can be spotted. We also count attempts from each network address for a short time to
            slow down spam and password guessing.
          </li>
          <li>
            <strong>Cookies:</strong> one to keep you signed in, and one that remembers the neighbourhood you last looked at (the area
            only). When you arrive from a flyer or a shared post, one more remembers just where from (like &ldquo;flyer&rdquo; or
            &ldquo;WhatsApp&rdquo;) for 30 days; if you join, that word is saved with your membership so the people leading it can see
            how many came from each place. No advertising or tracking cookies, and no analytics.
          </li>
          <li>
            <strong>Invites:</strong> if you join through someone&apos;s invite link, we note who invited you, so the people leading the
            cause can see how many joined from their invite. If you lead a cause and use your own contact list to invite people, the
            file is read on your own device only: it&apos;s never sent to us or stored, and we never email or text the people on it. You
            send the invites yourself, from your own apps.
          </li>
          <li>
            <strong>Finding your representatives:</strong> if you type your full postal code to find your representatives, it&apos;s
            sent to Open North to look them up and is not saved. The representatives shown on each cause are looked up from the
            area&apos;s centre, not from anyone&apos;s address.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li>
            <strong>Anyone:</strong> causes, events, campaigns and the names on them, and notes added to signatures. You can turn off{" "}
            <em>Show my name on causes I join</em> on <Link href="/me#privacy">your activity page</Link>: you then appear as &ldquo;A
            neighbour&rdquo; and are just counted. Leading a cause or hosting an event is public, so your name shows there either way.
          </li>
          <li>
            <strong>Members of a cause:</strong> its chat.
          </li>
          <li>
            <strong>The people leading a cause:</strong> everyone who&apos;s joined it, by name (whatever your name setting), when they
            joined, whether they&apos;ve signed and are going to the next event, and how they found it. When you sign one of its campaigns, your name, your rough home area (like
            M5V or a ZIP code, if you set one), the date and your note go on the petition they can download and deliver to whoever
            they&apos;re asking. Never your email.
          </li>
          <li>
            <strong>Only you (and the Groundswell team, to run the site):</strong> your email and home area.
          </li>
          <li>
            <strong>Moderators:</strong> reports, and content they&apos;ve removed while it can still be restored.
          </li>
        </ul>
      </section>

      <section>
        <h2>Services that handle information for us</h2>
        <p>We use a few companies to run Groundswell. They handle information only to provide their service to us.</p>
        <ul>
          <li>
            <strong>Vercel</strong> runs the website.
          </li>
          <li>
            <strong>Neon</strong> stores the database, in Ohio, USA.
          </li>
          <li>
            <strong>Resend</strong> sends our emails: confirming your email and resetting your password. Everything else shows as a notification on the site.
          </li>
          <li>
            <strong>Cloudflare</strong> runs the &quot;are you human?&quot; check on sign-up and sign-in, and passes along live chat
            signals. Those signals only say &quot;something changed in this cause&quot;: your messages never go through Cloudflare.
          </li>
          <li>
            <strong>Open North</strong> answers representative lookups.
          </li>
          <li>
            <strong>Your browser&apos;s push service</strong> (Google, Apple, Mozilla or Microsoft, depending on your device) delivers
            notifications if you turn them on. The message is encrypted so only your device can read it. We keep the address your browser
            gives us for that device until you turn notifications off or sign out.
          </li>
        </ul>
        <p>
          Because these services are based in or store information in the United States, your information may be handled there and be
          subject to US law.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Your account and posts: until you delete your account.</li>
          <li>
            Deleted accounts: you have {ACCOUNT_GRACE_DAYS} days to change your mind (just sign back in). After that, your name,
            email, password and home area are erased for good. What you posted stays so conversations still make sense, shown as
            &quot;Former member&quot;.
          </li>
          <li>Content a moderator removes: deleted for good {REMOVAL_RETENTION_DAYS} days after it was removed.</li>
          <li>Sign-in sessions: they end after 30 days. Email links expire after 48 hours (confirming your email) or 1 hour (password reset).</li>
          <li>Counts of attempts used to slow down spam: hours, not days.</li>
        </ul>
      </section>

      <section>
        <h2>What you can do</h2>
        <ul>
          <li>
            <strong>Change or remove what you posted:</strong> edit your causes and events, and fix a chat message within 15 minutes.
          </li>
          <li>
            <strong>Leave a cause:</strong> removes your membership, your RSVPs to its upcoming events and your signatures, in one go.
          </li>
          <li>
            <strong>Delete your account</strong> from <Link href="/me">your activity page</Link>.
          </li>
          <li>
            Under Canadian privacy law you can ask what we hold about you, ask us to correct it, and withdraw your consent. You can also
            complain to the{" "}
            <a href="https://www.priv.gc.ca/" target="_blank" rel="noopener noreferrer">
              Office of the Privacy Commissioner of Canada
            </a>
            .
          </li>
        </ul>
        <div className="mt-4">
          <ContactComingSoon />
        </div>
      </section>

      <section>
        <h2>Age</h2>
        <p>Groundswell is for people 13 and older.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we change this policy, we&apos;ll update this page and the date at the top. If a change affects what we do with your
          information in a big way, we&apos;ll say so on the site first.
        </p>
      </section>
    </LegalPage>
  );
}
