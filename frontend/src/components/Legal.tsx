import { Link } from "react-router-dom";

// ponytail: placeholder until there's a real support address — replace before
// these pages go live, the policy promises people a way to reach you.
const CONTACT = "[your contact email]";
const UPDATED = "3 October 2026";

/**
 * Privacy policy and terms. Written to match what the code actually does —
 * if a new feature sends data somewhere new, this page has to change with it.
 */
function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link to="/" className="legal-back">← Student OS</Link>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      {children}
      <p className="legal-foot">
        <Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms and conditions</Link>
      </p>
    </main>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Student OS is a personal organiser for students: tasks, courses, notes, a calendar, a
        weekly schedule, timers, spending, and an assistant called Octi. This page explains what
        it stores about you, where, and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your name and email address, and a password if you sign up
          with one. If you continue with Google, we receive your name, email address and profile
          picture from Google. We do not get access to your Gmail, Drive or anything else in your
          Google account.
        </li>
        <li>
          <strong>What you put in the app.</strong> Tasks, courses, notes, calendar events,
          schedule blocks, timers and focus sessions, expenses, app shortcuts, and your settings.
        </li>
        <li>
          <strong>Conversations with Octi.</strong> The messages you send the assistant, along with
          the parts of your data it needs to answer (for example your tasks, when you ask what is
          due).
        </li>
      </ul>
      <p>
        We do not use advertising or analytics trackers, and we do not sell your data or share it
        for marketing.
      </p>

      <h2>Where it is kept</h2>
      <ul>
        <li>
          <strong>On your device.</strong> The app keeps a working copy of your data in your
          browser so it works offline.
        </li>
        <li>
          <strong>In your account.</strong> That copy is synced to our database, hosted by Supabase,
          so it is the same on every device you sign in on. Only your account can read it.
        </li>
        <li>
          <strong>PDFs stay on your device.</strong> PDF files you add to notes are saved only in
          the browser you added them in. They are not uploaded to us. The note's title and file name
          do sync.
        </li>
      </ul>

      <h2>Who else processes it</h2>
      <ul>
        <li><strong>Supabase</strong>: sign-in and storing your synced data.</li>
        <li><strong>Google</strong>: only if you choose to sign in with Google.</li>
        <li>
          <strong>Our AI provider</strong> (currently Groq): when you talk to Octi, your messages
          and the data needed to answer them are sent through our server to the provider to
          generate a reply. We don't keep a separate copy of those conversations on our server.
        </li>
        <li><strong>Our hosting providers</strong>: to serve the website and run our server.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. Deleting something in the app deletes it from your
        synced data. To delete your account and everything in it, use <strong>Delete
        account</strong> at the top of any page in the app. It is removed straight away, along
        with the data and PDFs stored in that browser.
      </p>

      <h2>Your choices</h2>
      <p>
        You can see, change or delete your data in the app at any time. You can also ask us for a
        copy of it, to correct it, or to delete it, by emailing {CONTACT}.
      </p>

      <h2>Children</h2>
      <p>
        Student OS is meant for people aged 13 and over. If you are under the age of digital
        consent where you live, please use it with a parent or guardian's permission.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we will update the date at the top. If a change affects how your
        data is used, we will tell you in the app first.
      </p>

      <h2>Contact</h2>
      <p>Questions about your privacy: {CONTACT}.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms and conditions">
      <p>
        By creating an account or using Student OS, you agree to these terms. If you don't agree,
        please don't use the app.
      </p>

      <h2>The service</h2>
      <p>
        Student OS is free. It is provided as is: we work to keep it running and your data safe,
        but we can't promise it will always be available or free of mistakes. We may change, add
        or remove features over time.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login details to yourself; you are responsible for what happens under your
        account. Tell us at {CONTACT} if you think someone else has got into it.
      </p>

      <h2>Your content</h2>
      <p>
        Everything you put into Student OS stays yours. You give us only the permission we need to
        store it, sync it between your devices, and send it to our AI provider when you ask Octi
        something. Only add material you have the right to use, including PDFs.
      </p>

      <h2>Octi, the assistant</h2>
      <p>
        Octi's answers are generated by AI and can be wrong. Check anything important, like an
        exam date or a deadline, against the official source. Octi can make changes for you (for
        example adding tasks or notes) when you ask it to; review what it does.
      </p>

      <h2>Keep backups</h2>
      <p>
        PDFs are stored only on the device you added them on and are lost if you clear your
        browser's data. Keep your own copies of anything you can't afford to lose.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don't use Student OS to break the law, to try to get into other people's accounts or our
        systems, or to overload the service, including the assistant. We may suspend accounts
        that do.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect losses, such as missed
        deadlines, lost grades or lost data, that come from using or being unable to use Student
        OS.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using Student OS at any time and delete your account from inside the app.
        We may close accounts that break these terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top shows the latest version; if a change is
        significant, we will tell you in the app first. Continuing to use Student OS after that
        means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: {CONTACT}.</p>
    </LegalPage>
  );
}
