"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readSessionFromStorage } from "@/lib/supabase/session-client";
import { supabase } from "@/lib/supabase/client";
import { fetchProfileSummary } from "@/lib/wovo-ai/profile-client";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  created_at: string;
};

type AdminCredit = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
};

type AdminPlan = {
  id: string;
  name: string;
  price: number;
  features_json: unknown;
};

type AdminSubscription = {
  user_id: string;
  plan: string | null;
  plan_id: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminAction = {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: unknown;
  created_at: string;
};

type AdminNotification = {
  id: string;
  type: string;
  created_at: string;
  payload: unknown;
  read?: boolean;
};

type DashboardPayload = {
  users: AdminUser[];
  credits: AdminCredit[];
  plans: AdminPlan[];
  subscriptions: AdminSubscription[];
  actions: AdminAction[];
  notifications?: AdminNotification[];
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatNotificationDetails(notification: AdminNotification): string {
  const payload =
    typeof notification.payload === "object" && notification.payload !== null && !Array.isArray(notification.payload)
      ? (notification.payload as Record<string, unknown>)
      : {};

  if (notification.type === "feed_post_flagged") {
    const reporter = typeof payload.reported_by_email === "string" ? payload.reported_by_email : "a user";
    const postId = typeof payload.post_id === "string" ? payload.post_id : "";
    return postId ? `${reporter} flagged post ${postId.slice(0, 8)}...` : `${reporter} flagged a post.`;
  }

  if (notification.type === "user_banned") {
    const email = typeof payload.target_email === "string" ? payload.target_email : "";
    return email ? `${email} was banned.` : "An account was banned.";
  }

  if (notification.type === "subscription_updated") {
    const plan = typeof payload.plan === "string" ? payload.plan : "none";
    const status = typeof payload.status === "string" ? payload.status : "inactive";
    return `Plan set to ${plan} (${status}).`;
  }

  if (notification.type === "credits_adjusted") {
    const delta = typeof payload.delta === "number" ? payload.delta : 0;
    return `Credit delta ${delta > 0 ? "+" : ""}${delta}.`;
  }

  return "New admin event.";
}

export default function AdminPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [creditUserId, setCreditUserId] = useState("");
  const [creditDelta, setCreditDelta] = useState("50");
  const [creditReason, setCreditReason] = useState("manual adjustment");

  const [subUserId, setSubUserId] = useState("");
  const [subStatus, setSubStatus] = useState("active");
  const [subPlan, setSubPlan] = useState("starter");
  const [roleUserId, setRoleUserId] = useState("");
  const [roleEmail, setRoleEmail] = useState("");
  const [roleValue, setRoleValue] = useState("admin");
  const [verifiedUserId, setVerifiedUserId] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verifiedValue, setVerifiedValue] = useState("on");
  const [moderationUserId, setModerationUserId] = useState("");
  const [moderationEmail, setModerationEmail] = useState("");
  const [moderationAction, setModerationAction] = useState("ban");
  const [moderationReason, setModerationReason] = useState("");

  const usersById = useMemo(() => {
    const map = new Map<string, AdminUser>();
    dashboard?.users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [dashboard?.users]);

  useEffect(() => {
    const load = async () => {
      const session = readSessionFromStorage();
      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const token = session.access_token;
      tokenRef.current = token;
      supabase.setAccessToken(token);

      setLoading(true);
      setError("");
      setNotice("");

      const profile = await fetchProfileSummary(token);
      if (profile?.role !== "admin") {
        setError("You do not have admin access.");
        setLoading(false);
        router.replace("/wovo-ai");
        return;
      }

      const response = await fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        setError("You do not have admin access.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Unable to load admin dashboard.");
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as DashboardPayload;
      setDashboard(payload);
      setLoading(false);
    };

    void load();
  }, [router]);

  const refreshDashboard = async () => {
    const token = tokenRef.current;
    if (!token) return;
    const response = await fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.ok) {
      setDashboard((await response.json()) as DashboardPayload);
    }
  };

  const adjustCredits = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenRef.current;
    if (!token) return;

    const delta = Number(creditDelta);
    if (!creditUserId || Number.isNaN(delta)) {
      setError("Choose a user and valid credit delta.");
      return;
    }

    const response = await fetch("/api/admin/credits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: creditUserId,
        delta,
        reason: creditReason,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to adjust credits.");
      return;
    }

    setNotice("Credits updated.");
    setError("");
    await refreshDashboard();
  };

  const updateSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenRef.current;
    if (!token) return;

    if (!subUserId) {
      setError("Choose a user for subscription updates.");
      return;
    }

    const response = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: subUserId,
        status: subStatus,
        plan: subPlan,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to update subscription.");
      return;
    }

    setNotice("Subscription updated.");
    setError("");
    await refreshDashboard();
  };

  const updateAdminRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenRef.current;
    if (!token) return;

    const normalizedEmail = roleEmail.trim().toLowerCase();
    if (!roleUserId && !normalizedEmail) {
      setError("Choose a user or enter an email.");
      return;
    }

    const response = await fetch("/api/admin/users/role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: roleUserId || undefined,
        email: normalizedEmail || undefined,
        role: roleValue,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to update admin role.");
      return;
    }

    setNotice(roleValue === "admin" ? "Admin access granted." : "Admin access removed.");
    setError("");
    await refreshDashboard();
  };

  const updateVerifiedBadge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenRef.current;
    if (!token) return;

    const normalizedEmail = verifiedEmail.trim().toLowerCase();
    if (!verifiedUserId && !normalizedEmail) {
      setError("Choose a user or enter an email.");
      return;
    }

    const response = await fetch("/api/admin/verified", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: verifiedUserId || undefined,
        email: normalizedEmail || undefined,
        verified: verifiedValue === "on",
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to update verified badge.");
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { usedFallback?: boolean };
    if (payload.usedFallback) {
      setNotice(
        verifiedValue === "on"
          ? "Verified badge enabled using admin override fallback."
          : "Verified badge removed using admin override fallback.",
      );
    } else {
      setNotice(verifiedValue === "on" ? "Verified badge enabled." : "Verified badge removed.");
    }
    setError("");
    await refreshDashboard();
  };

  const updateModeration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenRef.current;
    if (!token) return;

    const normalizedEmail = moderationEmail.trim().toLowerCase();
    if (!moderationUserId && !normalizedEmail) {
      setError("Choose a user or enter an email.");
      return;
    }

    const response = await fetch("/api/admin/moderation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: moderationUserId || undefined,
        email: normalizedEmail || undefined,
        action: moderationAction,
        reason: moderationReason.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to update moderation.");
      return;
    }

    setNotice("Moderation updated.");
    setError("");
    await refreshDashboard();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <p>Loading admin dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Wovo AI Control Center</h1>
          <p className="mt-2 text-sm text-slate-300">Manage users, subscriptions, credits, and audit logs. Admin users bypass paywalls and credit locks automatically.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-slate-400">Users</p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.users.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-slate-400">Subscriptions</p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.subscriptions.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-slate-400">Credits Rows</p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.credits.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-slate-400">Audit Logs</p>
              <p className="mt-1 text-2xl font-semibold">{dashboard?.actions.length ?? 0}</p>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-rose-300/40 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p> : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Adjust Credits</h2>
            <form className="mt-4 space-y-3" onSubmit={adjustCredits}>
              <label className="block space-y-1 text-sm">
                <span>User</span>
                <select
                  value={creditUserId}
                  onChange={(event) => setCreditUserId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="">Select user</option>
                  {dashboard?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Delta (positive or negative)</span>
                <input
                  value={creditDelta}
                  onChange={(event) => setCreditDelta(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Reason</span>
                <input
                  value={creditReason}
                  onChange={(event) => setCreditReason(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                />
              </label>
              <button type="submit" className="inline-flex h-11 items-center rounded-xl bg-[var(--wm-accent)] px-5 text-sm font-semibold text-slate-950">
                Apply Credit Change
              </button>
            </form>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Manage Subscription</h2>
            <form className="mt-4 space-y-3" onSubmit={updateSubscription}>
              <label className="block space-y-1 text-sm">
                <span>User</span>
                <select
                  value={subUserId}
                  onChange={(event) => setSubUserId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="">Select user</option>
                  {dashboard?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Status</span>
                <select
                  value={subStatus}
                  onChange={(event) => setSubStatus(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="canceled">canceled</option>
                  <option value="past_due">past_due</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Plan</span>
                <select
                  value={subPlan}
                  onChange={(event) => setSubPlan(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="starter">starter</option>
                  <option value="pro">pro</option>
                  <option value="none">none</option>
                </select>
              </label>
              <button type="submit" className="inline-flex h-11 items-center rounded-xl bg-[var(--wm-accent)] px-5 text-sm font-semibold text-slate-950">
                Update Subscription
              </button>
            </form>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Moderation Controls</h2>
          <p className="mt-1 text-sm text-slate-300">
            Ban/unban accounts and disable/enable feed posting per account.
          </p>
          <form className="mt-4 grid gap-3 lg:grid-cols-5" onSubmit={updateModeration}>
            <label className="block space-y-1 text-sm lg:col-span-2">
              <span>User (optional)</span>
              <select
                value={moderationUserId}
                onChange={(event) => setModerationUserId(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
              >
                <option value="">Select user</option>
                {dashboard?.users.map((user) => (
                  <option key={`mod-${user.id}`} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm lg:col-span-1">
              <span>Email fallback</span>
              <input
                value={moderationEmail}
                onChange={(event) => setModerationEmail(event.target.value)}
                placeholder="name@company.com"
                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1 text-sm lg:col-span-1">
              <span>Action</span>
              <select
                value={moderationAction}
                onChange={(event) => setModerationAction(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
              >
                <option value="ban">ban account</option>
                <option value="unban">unban account</option>
                <option value="disable_feed">disable feed posting</option>
                <option value="enable_feed">enable feed posting</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm lg:col-span-1">
              <span>Reason</span>
              <input
                value={moderationReason}
                onChange={(event) => setModerationReason(event.target.value)}
                placeholder="optional note"
                className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
              />
            </label>
            <div className="lg:col-span-5">
              <button type="submit" className="inline-flex h-11 items-center rounded-xl bg-[var(--wm-accent)] px-5 text-sm font-semibold text-slate-950">
                Apply Moderation
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Admin Access</h2>
            <p className="mt-1 text-sm text-slate-300">Promote another account to admin or remove admin access.</p>
            <form className="mt-4 space-y-3" onSubmit={updateAdminRole}>
              <label className="block space-y-1 text-sm">
                <span>User (optional)</span>
                <select
                  value={roleUserId}
                  onChange={(event) => setRoleUserId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="">Select user</option>
                  {dashboard?.users.map((user) => (
                    <option key={`role-${user.id}`} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Email (optional fallback)</span>
                <input
                  value={roleEmail}
                  onChange={(event) => setRoleEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Role</span>
                <select
                  value={roleValue}
                  onChange={(event) => setRoleValue(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                </select>
              </label>
              <button type="submit" className="inline-flex h-11 items-center rounded-xl bg-[var(--wm-accent)] px-5 text-sm font-semibold text-slate-950">
                Save Admin Access
              </button>
            </form>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Verification Badge</h2>
            <p className="mt-1 text-sm text-slate-300">Force-enable or remove a verification badge from an account.</p>
            <form className="mt-4 space-y-3" onSubmit={updateVerifiedBadge}>
              <label className="block space-y-1 text-sm">
                <span>User (optional)</span>
                <select
                  value={verifiedUserId}
                  onChange={(event) => setVerifiedUserId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="">Select user</option>
                  {dashboard?.users.map((user) => (
                    <option key={`verified-${user.id}`} value={user.id}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Email (optional fallback)</span>
                <input
                  value={verifiedEmail}
                  onChange={(event) => setVerifiedEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Verification</span>
                <select
                  value={verifiedValue}
                  onChange={(event) => setVerifiedValue(event.target.value)}
                  className="h-10 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm"
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <button type="submit" className="inline-flex h-11 items-center rounded-xl bg-[var(--wm-accent)] px-5 text-sm font-semibold text-slate-950">
                Save Verification
              </button>
            </form>
          </article>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Users</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Credits</th>
                  <th className="py-2 pr-3">Subscription</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.users.map((user) => {
                  const credit = dashboard.credits.find((item) => item.user_id === user.id);
                  const subscription = dashboard.subscriptions.find((item) => item.user_id === user.id);
                  return (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">{user.email}</td>
                      <td className="py-2 pr-3">{user.role}</td>
                      <td className="py-2 pr-3">{credit?.balance ?? 0}</td>
                      <td className="py-2 pr-3">{subscription?.plan ? `${subscription.plan} (${subscription.status ?? "-"})` : subscription?.status ?? "-"}</td>
                      <td className="py-2 pr-3">{formatDate(user.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Plans</h2>
            <div className="mt-4 space-y-3">
              {dashboard?.plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-slate-300">${Number(plan.price).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Admin Actions</h2>
            <div className="mt-4 space-y-3">
              {dashboard?.actions.slice(0, 8).map((action) => (
                <div key={action.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-semibold">{formatActionLabel(action.action)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Target: {action.target_user_id ? usersById.get(action.target_user_id)?.email ?? action.target_user_id : "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(action.created_at)}</p>
                </div>
              ))}
              {dashboard?.actions.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                  No admin actions logged yet.
                </p>
              ) : null}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Admin Notifications</h2>
            <div className="mt-4 space-y-3">
              {(dashboard?.notifications ?? []).slice(0, 8).map((notification) => (
                <div key={notification.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-semibold">{formatActionLabel(notification.type)}</p>
                  <p className="mt-1 text-xs text-slate-300">{formatNotificationDetails(notification)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(notification.created_at)}</p>
                </div>
              ))}
              {(dashboard?.notifications ?? []).length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                  No admin notifications yet.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
