import { Link } from "react-router";

import { APP_NAME } from "@/lib/constants";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <Link to="/" className="text-sm font-semibold text-primary">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: November 24, 2026
        </p>

        <div className="prose prose-slate mt-8 max-w-none space-y-7 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">Who we are</h2>
            <p className="mt-2">
              {APP_NAME} is a care coordination service operated by APEXS INC. It helps a
              family organizer, family members, and hired caregivers share medications,
              appointments, tasks, care notes, and related care information for a person
              they support.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">
              Information we collect
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Account information:</strong> name,
                email address, phone number, role, care schedule, and authentication data.
                Passwords are stored as one-way hashes.
              </li>
              <li>
                <strong className="text-foreground">Care recipient information:</strong>{" "}
                name, preferred name, aliases, date of birth, address, emergency contact,
                and care notes entered by the care team.
              </li>
              <li>
                <strong className="text-foreground">Care activity:</strong> medications and
                dose confirmations, appointments, tasks, visits, vital signs, care journal
                entries, handoff notes, issues, and audit records.
              </li>
              <li>
                <strong className="text-foreground">Location:</strong> the caregiver app may
                collect precise location when a caregiver clocks in or out of a visit, and
                only after the device grants location permission.
              </li>
              <li>
                <strong className="text-foreground">Device and usage data:</strong> device
                type, app version, notification permission, IP address, and security logs
                needed to operate and protect the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">How we use information</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Provide care coordination, reminders, and the shared care record.</li>
              <li>Authenticate users and enforce role-based access.</li>
              <li>Send local device reminders for tasks and medications.</li>
              <li>Maintain audit trails, troubleshoot, and protect the service.</li>
              <li>Comply with legal obligations and respond to lawful requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">How we share information</h2>
            <p className="mt-2">
              Care information is visible to the members of the care team in the same
              workspace. We do not sell personal information. We use service providers for
              hosting, database storage, and app distribution, including Cloudflare for the
              website and API and Google Play for Android app distribution. Providers
              process information on our behalf under their applicable terms. We may
              disclose information when required by law or to protect the safety and rights
              of users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Security</h2>
            <p className="mt-2">
              We use encrypted connections, role-based access controls, audit logging, and
              access-limited infrastructure. No system is completely secure, so please use a
              strong unique password and keep your device protected.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">
              Retention and deletion
            </h2>
            <p className="mt-2">
              We retain care information while the workspace is active and for a reasonable
              period in backups and security logs. A workspace organizer can remove care
              team members and workspace data. To request deletion of your account or data,
              follow the instructions on the{" "}
              <Link to="/data-deletion" className="font-semibold text-primary">
                data deletion page
              </Link>
              . Some records may be retained where required for legal, security, or
              audit purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Your choices</h2>
            <p className="mt-2">
              You can update your account information in the app, ask a workspace organizer
              to correct or remove care information, and control notification and location
              permissions in Android settings. You may contact us to request access,
              correction, or deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Children</h2>
            <p className="mt-2">
              {APP_NAME} is intended for adults coordinating care. It is not directed to
              children under 13. Care recipient information should be entered only by
              authorized adults.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">
              International processing
            </h2>
            <p className="mt-2">
              Our service providers may process information in countries other than your
              own. They apply safeguards required by applicable law for cross-border data
              processing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Medical disclaimer</h2>
            <p className="mt-2">
              {APP_NAME} is a coordination tool, not a medical device or emergency service.
              It does not provide medical advice, diagnosis, or treatment. Call local
              emergency services for an emergency.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Changes</h2>
            <p className="mt-2">
              We may update this policy as the service changes. We will post the new
              effective date on this page and provide additional notice where required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about privacy can be sent to{" "}
              <a
                href="mailto:contact@apexsinc.com?subject=CareShift%20privacy"
                className="font-semibold text-primary"
              >
                contact@apexsinc.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-4 border-t border-border/60 pt-6 text-sm">
          <Link to="/" className="font-semibold text-primary">
            Home
          </Link>
          <Link to="/data-deletion" className="font-semibold text-primary">
            Data deletion
          </Link>
        </div>
      </div>
    </div>
  );
}
