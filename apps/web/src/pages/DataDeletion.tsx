import { Link } from "react-router";

import { APP_NAME } from "@/lib/constants";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <Link to="/" className="text-sm font-semibold text-primary">
          ← Back to {APP_NAME}
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Delete your data
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: November 24, 2026
        </p>

        <div className="prose prose-slate mt-8 max-w-none space-y-7 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-bold text-foreground">Request deletion</h2>
            <p className="mt-2">
              To delete your {APP_NAME} account or the care data associated with your
              workspace, email{" "}
              <a
                href="mailto:contact@apexsinc.com?subject=CareShift%20data%20deletion"
                className="font-semibold text-primary"
              >
                contact@apexsinc.com
              </a>{" "}
              with the subject line <strong className="text-foreground">CareShift data deletion</strong>.
            </p>
            <p className="mt-2">Please include:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>The email address used to sign in.</li>
              <li>The care recipient or workspace name, if applicable.</li>
              <li>Whether you want your account deleted or the whole workspace cleared.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">What happens next</h2>
            <p className="mt-2">
              We will verify the request, then delete the requested account or workspace
              data within 30 days. Some records may be retained where required for legal,
              security, or audit purposes, or in backups for a limited period.
            </p>
            <p className="mt-2">
              If you are a care team member, your workspace organizer can also remove your
              access immediately from the organizer app. If you are the organizer, deleting
              the workspace removes the shared care record for everyone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Before you delete</h2>
            <p className="mt-2">
              Export or record any information you need before requesting deletion.
              Deleting a workspace cannot be undone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Privacy</h2>
            <p className="mt-2">
              Read the{" "}
              <Link to="/privacy" className="font-semibold text-primary">
                {APP_NAME} Privacy Policy
              </Link>{" "}
              for details about how information is collected, used, and retained.
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-4 border-t border-border/60 pt-6 text-sm">
          <Link to="/" className="font-semibold text-primary">
            Home
          </Link>
          <Link to="/privacy" className="font-semibold text-primary">
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}
