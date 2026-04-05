import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { listAuthAdminUsers, supabaseServiceRoleRequest, type AuthUser } from "@/lib/supabase/server";
import { getPlanConfig } from "@/lib/wovo-ai/plans";
import { listAdminActions, listAdminNotifications } from "@/lib/admin/audit-log";

type AdminDashboardUser = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  created_at: string;
};

type AdminDashboardCredit = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
};

type AdminDashboardPlan = {
  id: string;
  name: string;
  price: number;
  features_json: unknown;
};

type AdminDashboardSubscription = {
  user_id: string;
  plan: string | null;
  plan_id: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminActionRow = {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: unknown;
  created_at: string;
};

type AdminNotificationRow = {
  id: string;
  type: string;
  created_at: string;
  payload: unknown;
  read?: boolean;
};

type ProfileCreditsRow = {
  user_id: string;
  extra_credits: number | null;
  updated_at?: string | null;
  plan?: string | null;
};

type ProfileUserRow = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  created_at?: string | null;
};

type SubscriptionPartialRow = {
  user_id: string;
  plan?: string | null;
  plan_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function metadataRole(user: AuthUser): "admin" | "user" {
  const appRole = asString(asRecord(user.app_metadata).role).trim().toLowerCase();
  if (appRole === "admin") return "admin";
  const userRole = asString(asRecord(user.user_metadata).role).trim().toLowerCase();
  return userRole === "admin" ? "admin" : "user";
}

function metadataEmail(user: AuthUser): string {
  const direct = asString(user.email).trim().toLowerCase();
  if (direct) return direct;
  const userMetadata = asRecord(user.user_metadata);
  return asString(userMetadata.email).trim().toLowerCase();
}

function metadataName(user: AuthUser): string | null {
  const userMetadata = asRecord(user.user_metadata);
  const fullName = asString(userMetadata.full_name).trim();
  if (fullName) return fullName;
  const name = asString(userMetadata.name).trim();
  return name || null;
}

function parseDateToTime(value: string | null | undefined): number {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldRetrySubscriptionQuery(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes("column subscriptions.") && message.includes("does not exist")) ||
    (message.includes("could not find the") &&
      message.includes("column") &&
      message.includes("subscriptions") &&
      message.includes("schema cache"))
  );
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request.headers.get("authorization"));

    const [authUsers, usersResult, creditsResult, profileCreditsResult, profileUsersResult, plansResult, actionsResult, notificationsResult] = await Promise.all([
      listAuthAdminUsers({ page: 1, perPage: 800 }).catch(() => []),
      supabaseServiceRoleRequest<AdminDashboardUser[]>(
        "/rest/v1/users?select=id,email,role,name,created_at&order=created_at.desc&limit=300"
      ).catch(() => null),
      supabaseServiceRoleRequest<AdminDashboardCredit[]>(
        "/rest/v1/credits?select=id,user_id,balance,updated_at&order=updated_at.desc&limit=600"
      ).catch(() => null),
      supabaseServiceRoleRequest<ProfileCreditsRow[]>(
        "/rest/v1/profiles?select=user_id,extra_credits,updated_at,plan&limit=600"
      ).catch(() => null),
      supabaseServiceRoleRequest<ProfileUserRow[]>(
        "/rest/v1/profiles?select=user_id,email,full_name,created_at&limit=600"
      ).catch(async () => {
        return await supabaseServiceRoleRequest<ProfileUserRow[]>(
          "/rest/v1/profiles?select=user_id,email,full_name&limit=600"
        ).catch(() => null);
      }),
      supabaseServiceRoleRequest<AdminDashboardPlan[]>(
        "/rest/v1/plans?select=id,name,price,features_json&order=price.asc"
      ).catch(() => null),
      listAdminActions(200).catch(() => []),
      listAdminNotifications(200).catch(() => []),
    ]);

    const usersMap = new Map<string, AdminDashboardUser>();
    for (const authUser of authUsers) {
      if (!authUser?.id) continue;
      usersMap.set(authUser.id, {
        id: authUser.id,
        email: metadataEmail(authUser),
        role: metadataRole(authUser),
        name: metadataName(authUser),
        created_at: asString(authUser.created_at) || new Date().toISOString(),
      });
    }
    for (const row of usersResult ?? []) {
      if (!row?.id) continue;
      const existing = usersMap.get(row.id);
      usersMap.set(row.id, {
        id: row.id,
        email: row.email?.trim().toLowerCase() || existing?.email || "",
        role: (row.role ?? existing?.role ?? "user").toLowerCase() === "admin" ? "admin" : "user",
        name: row.name ?? existing?.name ?? null,
        created_at: row.created_at || existing?.created_at || new Date().toISOString(),
      });
    }
    for (const row of profileUsersResult ?? []) {
      if (!row?.user_id) continue;
      const existing = usersMap.get(row.user_id);
      usersMap.set(row.user_id, {
        id: row.user_id,
        email: row.email?.trim().toLowerCase() || existing?.email || "",
        role: existing?.role ?? "user",
        name: row.full_name ?? existing?.name ?? null,
        created_at: row.created_at ?? existing?.created_at ?? new Date().toISOString(),
      });
    }

    const users = Array.from(usersMap.values())
      .sort((left, right) => parseDateToTime(right.created_at) - parseDateToTime(left.created_at))
      .slice(0, 400);

    const creditsMap = new Map<string, AdminDashboardCredit>();
    for (const row of creditsResult ?? []) {
      if (!row?.user_id) continue;
      creditsMap.set(row.user_id, {
        id: row.id || `credits-${row.user_id}`,
        user_id: row.user_id,
        balance: Number.isFinite(row.balance) ? row.balance : 0,
        updated_at: row.updated_at || new Date().toISOString(),
      });
    }
    for (const row of profileCreditsResult ?? []) {
      if (!row?.user_id) continue;
      if (creditsMap.has(row.user_id)) continue;
      creditsMap.set(row.user_id, {
        id: `profile-${row.user_id}`,
        user_id: row.user_id,
        balance: Number.isFinite(row.extra_credits ?? 0) ? Number(row.extra_credits ?? 0) : 0,
        updated_at: row.updated_at ?? new Date().toISOString(),
      });
    }
    const credits = Array.from(creditsMap.values())
      .sort((left, right) => parseDateToTime(right.updated_at) - parseDateToTime(left.updated_at));

    const subscriptionSelectCandidates: Array<{ select: string; orderByUpdatedAt: boolean }> = [
      { select: "user_id,plan,plan_id,status,created_at,updated_at", orderByUpdatedAt: true },
      { select: "user_id,plan,status,created_at,updated_at", orderByUpdatedAt: true },
      { select: "user_id,plan,status", orderByUpdatedAt: false },
      { select: "user_id,status", orderByUpdatedAt: false },
    ];
    let subscriptionsRaw: SubscriptionPartialRow[] = [];
    for (const candidate of subscriptionSelectCandidates) {
      try {
        const rows = await supabaseServiceRoleRequest<SubscriptionPartialRow[]>(
          `/rest/v1/subscriptions?select=${candidate.select}${candidate.orderByUpdatedAt ? "&order=updated_at.desc" : ""}&limit=600`,
        );
        subscriptionsRaw = rows ?? [];
        break;
      } catch (error) {
        if (shouldRetrySubscriptionQuery(error)) continue;
        break;
      }
    }

    const subscriptionsMap = new Map<string, AdminDashboardSubscription>();
    for (const row of subscriptionsRaw) {
      if (!row?.user_id) continue;
      subscriptionsMap.set(row.user_id, {
        user_id: row.user_id,
        plan: row.plan ?? null,
        plan_id: row.plan_id ?? null,
        status: row.status ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
      });
    }

    for (const profile of profileCreditsResult ?? []) {
      if (!profile?.user_id) continue;
      const current = subscriptionsMap.get(profile.user_id);
      if (!current) {
        const fallbackPlan = (profile.plan ?? "").trim().toLowerCase();
        subscriptionsMap.set(profile.user_id, {
          user_id: profile.user_id,
          plan: fallbackPlan || null,
          plan_id: null,
          status: fallbackPlan && fallbackPlan !== "none" ? "active" : "inactive",
          created_at: null,
          updated_at: profile.updated_at ?? null,
        });
        continue;
      }
      if (!current.plan && profile.plan) {
        current.plan = profile.plan;
      }
      if (!current.updated_at && profile.updated_at) {
        current.updated_at = profile.updated_at;
      }
      if (!current.status && current.plan && current.plan !== "none") {
        current.status = "active";
      }
      subscriptionsMap.set(profile.user_id, current);
    }

    for (const authUser of authUsers) {
      if (!authUser?.id) continue;
      const userMetadata = asRecord(authUser.user_metadata);
      const appMetadata = asRecord(authUser.app_metadata);
      const forcedStatus = asString(userMetadata.forced_subscription_status || appMetadata.forced_subscription_status)
        .trim()
        .toLowerCase();
      const forcedPlan = asString(userMetadata.forced_plan || appMetadata.forced_plan)
        .trim()
        .toLowerCase();
      if (!forcedStatus && !forcedPlan) continue;

      const current = subscriptionsMap.get(authUser.id) ?? {
        user_id: authUser.id,
        plan: null,
        plan_id: null,
        status: null,
        created_at: null,
        updated_at: null,
      };
      if (forcedPlan) current.plan = forcedPlan;
      if (forcedStatus) current.status = forcedStatus;
      current.updated_at = current.updated_at ?? new Date().toISOString();
      subscriptionsMap.set(authUser.id, current);
    }

    const subscriptions = Array.from(subscriptionsMap.values())
      .sort((left, right) => parseDateToTime(right.updated_at) - parseDateToTime(left.updated_at));

    const actions: AdminActionRow[] = (actionsResult ?? []).map((row) => ({
      id: row.id,
      admin_user_id: row.admin_user_id,
      action: row.action,
      target_user_id: row.target_user_id,
      metadata: row.metadata,
      created_at: row.created_at,
    }));

    const notifications: AdminNotificationRow[] = (notificationsResult ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      created_at: row.created_at,
      payload: row.payload,
      read: row.read,
    }));

    const plans =
      plansResult ??
      ([
        {
          id: "starter",
          name: getPlanConfig("starter").label,
          price: 49,
          features_json: null,
        },
        {
          id: "pro",
          name: getPlanConfig("pro").label,
          price: 229,
          features_json: null,
        },
      ] satisfies AdminDashboardPlan[]);

    return NextResponse.json({
      users,
      credits,
      plans,
      subscriptions,
      actions,
      notifications,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load admin dashboard." },
      { status: 500 }
    );
  }
}
