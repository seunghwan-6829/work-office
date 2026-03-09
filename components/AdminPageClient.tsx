"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCurrentSession, loadProjects, signOut, subscribeToAuthChanges } from "../lib/app-data";
import { ADMIN_EMAIL, isAdminEmail } from "../lib/admin";
import { getMissingPublicEnvKeys, getSupabaseBrowserConfig, getSupabaseProjectRefFromUrl } from "../lib/env";

export default function AdminPageClient() {
  const missingEnvKeys = getMissingPublicEnvKeys();
  const supabaseConfig = getSupabaseBrowserConfig();
  const projectRef = getSupabaseProjectRefFromUrl(supabaseConfig.url);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = subscribeToAuthChanges(async (_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const projectCount = useMemo(() => {
    const email = session?.user.email;
    return email ? loadProjects(email).length : 0;
  }, [session?.user.email]);

  if (loading) {
    return <div className="app-loading">Preparing admin workspace...</div>;
  }

  if (!session) {
    return (
      <main className="admin-page-shell">
        <div className="admin-guard glass-card">
          <h1>Sign in required</h1>
          <p>The admin page is available only after login.</p>
          <Link className="button button-primary" href="/">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="admin-page-shell">
        <div className="admin-guard glass-card">
          <h1>Admin access denied</h1>
          <p>
            Current account: <strong>{session.user.email}</strong>. Admin email: <strong>{ADMIN_EMAIL}</strong>.
          </p>
          <Link className="button button-primary" href="/">
            Back to workspace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <section className="admin-header glass-card">
        <div>
          <p className="section-kicker">Admin</p>
          <h1>Control center</h1>
          <p>Admin-only view for checking environment status, user context, and project counts.</p>
        </div>
        <div className="inline-actions">
          <Link className="button button-secondary" href="/">
            Workspace
          </Link>
          <button className="button button-primary" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </section>

      <section className="admin-grid">
        <article className="dashboard-card glass-card">
          <p className="section-kicker">Viewer</p>
          <h3>Active admin</h3>
          <strong>{session.user.email}</strong>
          <p>This email is currently whitelisted for admin access.</p>
        </article>
        <article className="dashboard-card glass-card">
          <p className="section-kicker">Supabase</p>
          <h3>Connection status</h3>
          <strong>{missingEnvKeys.length === 0 ? "Ready" : "Check env"}</strong>
          <p>{missingEnvKeys.length === 0 ? `${projectRef} is ready` : missingEnvKeys.join(", ")}</p>
        </article>
        <article className="dashboard-card glass-card">
          <p className="section-kicker">Projects</p>
          <h3>Project count</h3>
          <strong>{projectCount}</strong>
          <p>Current count is based on local projects for the signed-in account.</p>
        </article>
      </section>
    </main>
  );
}