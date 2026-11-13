// The privacy policy, at /privacy. Written to match what the code does; change it whenever data goes somewhere new.
import { Link } from "react-router-dom";
import LegalPage, { CONTACT, Grievance } from "./LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Stratus is a personal organiser for students, with tasks, courses, notes, a calendar, a
        weekly schedule, timers, spending, friends and chats, and an AI assistant called Octi. It
        runs on the web and as an Android app. This policy explains what Stratus collects, why,
        where it goes, and what you can do about it. It applies to both.
      </p>

      <h2>Who we are</h2>
      <p>
        Stratus is made and run by Bhaskar Nayal, an individual developer in Chennai, India
        ("we", "us"). We decide how your personal data is used, so under India's Digital Personal
        Data Protection Act, 2023 we are its data fiduciary. You can reach us at {CONTACT}.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect what you put into Stratus, so it can store and sync it for you.</li>
        <li>No ads, no analytics trackers, and we never sell your data.</li>
        <li>Octi's AI provider sees what you send Octi, only to answer it.</li>
        <li>You can delete your account, and everything in it, at any time from Settings.</li>
      </ul>

      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address, your name, and a password if you
          sign up with one (stored only as a secure hash by our sign-in provider). If you continue
          with Google, Google gives us your name, email address and profile picture, and nothing
          else from your Google account. <em>Why:</em> to sign you in and keep your data yours.
        </li>
        <li>
          <strong>What you put in the app:</strong> tasks, courses and topics, notes and the files
          you attach to them (PDFs, photos, slides, documents, spreadsheets), calendar events,
          schedule blocks, timers, alarms and focus sessions, expenses, app shortcuts, and your
          settings. <em>Why:</em> this is the app; we store it so it's there on every device you
          sign in on.
        </li>
        <li>
          <strong>Friends and chats, if you use them:</strong> the tag, display name and profile
          picture you choose, your friend requests and friends, the messages you send in chats,
          and the copies of notes, events or mind maps you send a friend. <em>Why:</em> so friends
          can find you, talk to you and share with you.
        </li>
        <li>
          <strong>Octi:</strong> the messages you send Octi, and the parts of your Stratus data it
          needs to answer (for example your tasks when you ask what is due). We also count how
          many requests and how much AI your account uses each minute and each day; those
          counters reset on their own. If you report one of Octi's replies, we keep that reply and
          the message before it. <em>Why:</em> to answer you, keep usage fair, and review reports
          of harmful output.
        </li>
        <li>
          <strong>Crash reports:</strong> if the app crashes, an error report with the error, the
          screen it happened on, and your browser or device type. No notes, tasks, chats or other
          content, and no IP address. <em>Why:</em> to find and fix bugs.
        </li>
        <li>
          <strong>Technical data:</strong> like any website, our hosting provider sees your IP
          address and browser details when your device connects, to deliver the app and protect
          it from abuse. We don't use them to identify or profile you.
        </li>
      </ul>

      <h2>What we don't collect</h2>
      <p>
        No location, no contacts, no call logs or SMS, no advertising ID, and no tracking across
        other apps or websites. We don't receive voice recordings (see below). Google Calendar
        events, if you connect it, are never sent to or stored on our servers.
      </p>

      <h2>Permissions and connected services</h2>
      <ul>
        <li>
          <strong>Microphone</strong> (optional): used only while you hold Octi's microphone open,
          to turn speech into text. Android, or your browser on the web, asks for it the first time
          you tap the mic, and Stratus works fine without it. The speech is converted by your
          device's speech service, which on most Android phones and in Chrome is Google's. We
          receive only the text, never the audio.
        </li>
        <li>
          <strong>Google Calendar</strong> (optional): read-only access to your primary calendar,
          so its events show on the Calendar page. Your device fetches them directly from Google;
          access lapses after an hour or when you disconnect. Our use of Google data follows the
          Google API Services User Data Policy, including its Limited Use requirements.
        </li>
        <li>
          <strong>Sharing into Stratus</strong>: when you share a file or text from another app to
          Stratus, it becomes a note. Nothing is read unless you share it.
        </li>
        <li>
          <strong>App updates</strong>: the Android app checks our website for updates to its
          screens and features (the web content it displays) and downloads them. The check sends no
          personal data. The app itself, and anything that changes how it runs on your phone, is
          updated only through Google Play.
        </li>
      </ul>

      <h2>Octi and AI</h2>
      <p>
        Octi's replies are written by an AI model run by our AI provider (currently Groq). When
        you send Octi a message, it goes through our server to the provider together with the
        Stratus data needed to answer it, and the provider uses it to generate the reply.
      </p>
      <p>
        <strong>What we keep:</strong> we don't store your conversations with Octi on our servers,
        and a conversation is gone from the app when you close it.
      </p>
      <p>
        <strong>What Groq keeps:</strong> under Groq's data policy, it doesn't keep messages by
        default. It may log a message and its reply for up to 30 days, and only while
        troubleshooting errors or investigating abuse, unless the law requires longer.
      </p>
      <p> Octi only changes your data in ways
        you ask for, and shows you what it changed.
      </p>

      <h2>Who can see your data</h2>
      <ul>
        <li>
          <strong>You.</strong> Your tasks, notes, files, schedule, spending and settings can be
          read only by your account.
        </li>
        <li>
          <strong>Other Stratus users</strong> can see your tag, display name and profile picture,
          so they can find you. Your profile picture is stored at a public web address that anyone
          who has it can open.
        </li>
        <li>
          <strong>Your friends</strong> see what you send them: chat messages (seen by everyone in
          that chat) and copies of what you share. Once they add a shared copy, it's theirs, and
          deleting yours doesn't delete it.
        </li>
        <li>
          <strong>Service providers</strong> who run Stratus for us, listed below. They may use your
          data only to provide their service to us.
        </li>
        <li>
          <strong>Authorities</strong>, only when Indian law requires us to.
        </li>
      </ul>

      <h2>Service providers</h2>
      <ul>
        <li><strong>Supabase</strong>: sign-in, our database, and file storage.</li>
        <li><strong>Cloudflare</strong>: hosting the website and our server.</li>
        <li><strong>Groq</strong>: the AI model behind Octi.</li>
        <li><strong>Sentry</strong>: crash reports.</li>
        <li><strong>Google</strong>: sign-in with Google, Google Calendar, and speech-to-text, each only if you use it.</li>
      </ul>
      <p>
        Some of these providers process data outside India, including in the United States. We
        choose providers that protect data with industry-standard security.
      </p>

      <h2>How we protect it</h2>
      <p>
        Everything travels encrypted (HTTPS). In our database, access rules mean each account can
        reach only its own data, and the keys that can read everything never leave our server.
        Note files are stored privately. No system is perfectly secure.
      </p>

      <h2>If there is a data breach</h2>
      <p>
        If a breach affects your personal data, we will tell you without delay, by email and in the
        app. We will explain what happened and when, what data it involved and what that could
        mean for you, what we are doing about it, what you can do to protect yourself, and who to
        contact ({CONTACT}). We will also report it to the Data Protection Board of India as the law
        requires.
      </p>

      <h2>How long we keep it</h2>
      <p>
        As long as your account exists. When you delete something in the app, it's deleted from
        your synced data. When you delete your account, your account and everything stored with it
        are deleted straight away, from our servers and from the device you deleted it on.
      </p>
      <p>
        There are two exceptions. Records the law requires us to keep, such as logs of sign-ins and
        account activity, may be kept for up to one year and are then erased; they are used for
        nothing else. Crash reports are deleted by Sentry within 90 days. See{" "}
        <Link to="/delete-account">Delete your account</Link> for exactly what goes.
      </p>

      <h2>Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li>see, change or delete your data inside the app;</li>
        <li>ask us for a summary of the data we hold about you and who we've shared it with;</li>
        <li>ask us to correct, complete or erase it;</li>
        <li>withdraw your consent by deleting your account (this doesn't undo anything done before);</li>
        <li>nominate someone to use these rights for you if you die or can't act yourself;</li>
        <li>complain to us, and if you're not satisfied, to the Data Protection Board of India.</li>
      </ul>
      <p>
        Email {CONTACT} for any of these. We acknowledge your request within 24 hours and complete
        it within 15 days.
      </p>

      <h2>Age</h2>
      <p>
        Stratus is for people aged 18 and over. We don't knowingly collect data from anyone
        younger. If you think someone under 18 has an account, tell us and we will delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        When we change this policy, we update the date at the top. If a change affects how your
        data is used, we tell you in the app before it takes effect.
      </p>

      <Grievance />
    </LegalPage>
  );
}
