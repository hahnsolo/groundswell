import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { REMOVAL_RETENTION_DAYS } from "@/lib/moderation";

export const metadata: Metadata = { title: "Code of conduct" };

export default function ConductPage() {
  return (
    <LegalPage
      title="Code of conduct"
      updated="November 5, 2026"
      intro={
        <p>
          <strong className="text-foreground">Be kind, be specific, assume good faith.</strong> Groundswell works when neighbours who
          disagree can still work on the same street. These are the rules that keep it that way.
        </p>
      }
    >
      <section>
        <h2>Do</h2>
        <ul>
          <li>Keep it local and about the cause. Say what&apos;s happening, where, and what would fix it.</li>
          <li>Disagree with ideas, not people. Assume your neighbours mean well.</li>
          <li>Hold events in public places, and look out for each other there.</li>
          <li>Contact public officials through their public office details (the ones Groundswell shows).</li>
        </ul>
      </section>

      <section>
        <h2>Don&apos;t</h2>
        <ul>
          <li>Harass, threaten, bully or insult anyone, or encourage others to.</li>
          <li>Post hate based on race, ethnicity, religion, gender, sexual orientation, disability, age or any similar trait.</li>
          <li>
            Share private information about other people: home addresses, phone numbers, photos or anything they haven&apos;t made
            public. (Public officials&apos; office contacts are fine.)
          </li>
          <li>Spam, advertise, or post the same thing over and over.</li>
          <li>Pretend to be someone else, or make several accounts to look like more people.</li>
          <li>Post things you know are false, or that break the law.</li>
        </ul>
      </section>

      <section>
        <h2>If you see something wrong</h2>
        <ul>
          <li>
            Use <strong>Report</strong> on the cause or message. Reports are private: the person isn&apos;t told who reported them.
          </li>
          <li>
            When three members whose accounts are more than a day old report the same thing, it&apos;s hidden right away until a
            moderator looks at it. Brand-new accounts don&apos;t count, so a few throwaway accounts can&apos;t silence someone.
          </li>
          <li>
            Moderators decide whether to keep or remove it. If something of yours is removed, you&apos;ll see the moderator&apos;s
            reason. Removals can be undone for {REMOVAL_RETENTION_DAYS} days, then the content is deleted for good.
          </li>
          <li>For serious or repeated problems, we may close an account.</li>
        </ul>
      </section>

      <section>
        <h2>In danger?</h2>
        <p>
          If someone is in immediate danger, call <strong>911</strong>. Groundswell isn&apos;t an emergency service and isn&apos;t
          watched around the clock.
        </p>
      </section>

      <p>
        These rules are part of the <Link href="/terms">terms of use</Link>.
      </p>
    </LegalPage>
  );
}
