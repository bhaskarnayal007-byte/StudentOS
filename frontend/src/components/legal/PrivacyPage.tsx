// The privacy policy, at /privacy.
import LegalPage, { CONTACT } from "./LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Stratus is a personal organiser for students: tasks, courses, notes, a calendar, a
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
          <strong>Google Calendar, if you connect it.</strong> Read-only access to the events in your
          primary calendar. They are fetched by your browser and shown on the Calendar page only;
          they are never sent to or stored on our servers, and access lapses after an hour or when
          you disconnect.
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
        <li><strong>Google</strong>: only if you choose to sign in with Google or connect Google Calendar.</li>
        <li>
          <strong>Your browser's speech service</strong>: only when you tap the microphone to talk to
          Octi. Your browser turns your voice into text, and in Chrome that means the audio is sent to
          Google to transcribe. We receive only the text, never the recording.
        </li>
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
        Stratus is meant for people aged 13 and over. If you are under the age of digital
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
