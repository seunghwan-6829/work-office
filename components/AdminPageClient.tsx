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
    return <div className="app-loading">관리자 화면을 준비하는 중입니다...</div>;
  }

  if (!session) {
    return (
      <main className="admin-page-shell">
        <div className="admin-guard panel-surface">
          <h1>로그인이 필요합니다</h1>
          <p>관리자 페이지는 로그인한 상태에서만 접근할 수 있습니다.</p>
          <Link className="button button-primary" href="/">홈으로 이동</Link>
        </div>
      </main>
    );
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="admin-page-shell">
        <div className="admin-guard panel-surface">
          <h1>관리자 권한이 없습니다</h1>
          <p>현재 계정: <strong>{session.user.email}</strong> / 관리자 이메일: <strong>{ADMIN_EMAIL}</strong></p>
          <Link className="button button-primary" href="/">워크스페이스로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page-shell">
      <section className="admin-header panel-surface">
        <div>
          <p className="section-kicker">관리자</p>
          <h1>운영 상태 확인</h1>
          <p>관리자 전용 페이지입니다. 현재는 환경 상태와 프로젝트 수를 확인할 수 있습니다.</p>
        </div>
        <div className="inline-actions">
          <Link className="button button-secondary" href="/">워크스페이스</Link>
          <button className="button button-primary" onClick={() => signOut()}>로그아웃</button>
        </div>
      </section>

      <section className="admin-grid compact-grid">
        <article className="dashboard-card panel-surface">
          <p className="section-kicker">계정</p>
          <h3>현재 관리자</h3>
          <strong>{session.user.email}</strong>
        </article>
        <article className="dashboard-card panel-surface">
          <p className="section-kicker">Supabase</p>
          <h3>연결 상태</h3>
          <strong>{missingEnvKeys.length === 0 ? "준비 완료" : "확인 필요"}</strong>
          <p>{missingEnvKeys.length === 0 ? `${projectRef} 연결 준비 완료` : missingEnvKeys.join(", ")}</p>
        </article>
        <article className="dashboard-card panel-surface">
          <p className="section-kicker">프로젝트</p>
          <h3>현재 개수</h3>
          <strong>{projectCount}개</strong>
        </article>
      </section>
    </main>
  );
}