"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSessionFromStorage } from "@/lib/supabase/session-client";

type BadgeType = "none" | "verified" | "gold";

type PublicProfilePost = {
  id: string;
  createdAt: string;
  module: string;
  prompt: string;
  text: string;
  image: string | null;
  video: string | null;
  brandName: string;
  channels: string[];
  shareToFeed: boolean;
};

type PublicProfilePayload = {
  profile: {
    userId: string;
    username: string;
    displayName: string;
    isOwnProfile: boolean;
    followersCount: number;
    followingCount: number;
    isFollowedByViewer: boolean;
    isVerified: boolean;
    badgeType: BadgeType;
  };
  posts: PublicProfilePost[];
};

type FollowListItem = {
  userId: string;
  username: string;
  displayName: string;
  isFollowedByViewer: boolean;
};

function moduleTitle(moduleId: string | undefined): string {
  if (!moduleId) return "Campaign";
  return moduleId.replaceAll("_", " ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function badgeDetails(badgeType: BadgeType): { label: string; className: string } | null {
  if (badgeType === "gold") {
    return {
      label: "Admin",
      className:
        "rounded-full border border-amber-300/55 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200",
    };
  }
  if (badgeType === "verified") {
    return {
      label: "Verified",
      className:
        "rounded-full border border-emerald-300/45 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200",
    };
  }
  return null;
}

function isProtectedVideoPath(value: string): boolean {
  return /^\/api\/wovo\/video\/[0-9a-f-]+\?content=1$/i.test(value.trim());
}

export default function CreatorProfilePage() {
  const params = useParams<{ username?: string }>();
  const router = useRouter();
  const username = (params?.username ?? "").trim().toLowerCase();

  const [token, setToken] = useState<string | null>(null);
  const [profilePayload, setProfilePayload] = useState<PublicProfilePayload | null>(null);
  const [followers, setFollowers] = useState<FollowListItem[]>([]);
  const [following, setFollowing] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLists, setLoadingLists] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvedVideoUrls, setResolvedVideoUrls] = useState<Record<string, string>>({});
  const resolvingVideoSourcesRef = useRef<Set<string>>(new Set());
  const resolvedVideoUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    resolvedVideoUrlsRef.current = resolvedVideoUrls;
  }, [resolvedVideoUrls]);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      if (!token) throw new Error("Missing session token.");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }

      return await fetch(input, {
        ...init,
        headers,
        cache: "no-store",
      });
    },
    [token],
  );

  const loadFollowLists = useCallback(
    async (userId: string) => {
      setLoadingLists(true);
      try {
        const [followersRes, followingRes] = await Promise.all([
          authedFetch(`/api/wovo-ai/social/follow/list?userId=${encodeURIComponent(userId)}&type=followers`),
          authedFetch(`/api/wovo-ai/social/follow/list?userId=${encodeURIComponent(userId)}&type=following`),
        ]);
        const followersPayload = (await followersRes.json().catch(() => ({}))) as { profiles?: FollowListItem[] };
        const followingPayload = (await followingRes.json().catch(() => ({}))) as { profiles?: FollowListItem[] };
        setFollowers(followersPayload.profiles ?? []);
        setFollowing(followingPayload.profiles ?? []);
      } catch {
        setFollowers([]);
        setFollowing([]);
      } finally {
        setLoadingLists(false);
      }
    },
    [authedFetch],
  );

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const response = await authedFetch(`/api/wovo-ai/social/profiles/${encodeURIComponent(username)}`);
      const payload = (await response.json().catch(() => ({}))) as PublicProfilePayload & { error?: string };
      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Unable to load creator profile.");
      }
      setProfilePayload(payload);
      await loadFollowLists(payload.profile.userId);
    } catch (profileError) {
      setProfilePayload(null);
      setFollowers([]);
      setFollowing([]);
      setError(profileError instanceof Error ? profileError.message : "Unable to load creator profile.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, loadFollowLists, username]);

  const toggleFollow = useCallback(async () => {
    if (!profilePayload || profilePayload.profile.isOwnProfile) return;
    setFollowBusy(true);
    try {
      const endpoint = "/api/wovo-ai/social/follow";
      const method = profilePayload.profile.isFollowedByViewer ? "DELETE" : "POST";
      const response = await authedFetch(endpoint, {
        method,
        body: JSON.stringify({ targetUserId: profilePayload.profile.userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update follow state.");
      }
      await loadProfile();
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Unable to update follow state.");
    } finally {
      setFollowBusy(false);
    }
  }, [authedFetch, loadProfile, profilePayload]);

  const openDmThread = useCallback(async () => {
    if (!profilePayload || profilePayload.profile.isOwnProfile) return;
    try {
      const response = await authedFetch("/api/wovo-ai/social/dm/threads", {
        method: "POST",
        body: JSON.stringify({ targetUserId: profilePayload.profile.userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to open DM.");
      }
      router.push("/wovo-ai#dm-hub");
    } catch (dmError) {
      setError(dmError instanceof Error ? dmError.message : "Unable to open DM.");
    }
  }, [authedFetch, profilePayload, router]);

  useEffect(() => {
    const session = readSessionFromStorage();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }
    setToken(session.access_token);
  }, [router]);

  useEffect(() => {
    if (!token || !username) return;
    void loadProfile();
  }, [loadProfile, token, username]);

  useEffect(() => {
    if (!token || !profilePayload) return;
    const protectedSources = profilePayload.posts
      .map((post) => post.video?.trim() ?? "")
      .filter((value) => Boolean(value) && isProtectedVideoPath(value));
    if (protectedSources.length === 0) return;

    let cancelled = false;

    const resolveSource = async (source: string) => {
      if (resolvedVideoUrlsRef.current[source]) return;
      if (resolvingVideoSourcesRef.current.has(source)) return;
      resolvingVideoSourcesRef.current.add(source);
      try {
        const response = await authedFetch(source);
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setResolvedVideoUrls((current) => {
          if (current[source]) {
            URL.revokeObjectURL(objectUrl);
            return current;
          }
          return { ...current, [source]: objectUrl };
        });
      } finally {
        resolvingVideoSourcesRef.current.delete(source);
      }
    };

    for (const source of protectedSources) {
      void resolveSource(source);
    }

    return () => {
      cancelled = true;
    };
  }, [authedFetch, profilePayload, token]);

  useEffect(() => {
    return () => {
      Object.values(resolvedVideoUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const profileBadge = badgeDetails(profilePayload?.profile.badgeType ?? "none");
  const posts = profilePayload?.posts ?? [];

  const publicPostCountLabel = useMemo(() => {
    const count = posts.length;
    return `${count} public post${count === 1 ? "" : "s"}`;
  }, [posts.length]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(0,233,145,0.2),transparent_42%),#060b11] px-4 py-16 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-black/35 p-8 text-center">
          <p className="text-sm uppercase tracking-[0.14em] text-emerald-200">Creator Profile</p>
          <p className="mt-3 text-xl font-semibold">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!profilePayload) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(0,233,145,0.2),transparent_42%),#060b11] px-4 py-16 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-300/35 bg-red-500/10 p-8">
          <p className="text-sm font-semibold text-red-200">{error || "Creator profile unavailable."}</p>
          <Link href="/wovo-ai" className="mt-4 inline-flex rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-slate-100">
            Back to Wovo AI
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(0,233,145,0.2),transparent_42%),#060b11] px-4 py-12 text-slate-100 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/35 bg-black/40 text-2xl font-semibold text-emerald-200">
                {(profilePayload.profile.displayName[0] ?? "W").toUpperCase()}
              </div>
              <div>
                <p className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
                  {profilePayload.profile.displayName}
                  {profileBadge ? <span className={profileBadge.className}>{profileBadge.label}</span> : null}
                </p>
                <p className="mt-1 text-emerald-200">@{profilePayload.profile.username}</p>
                <p className="mt-2 text-sm text-slate-300">{publicPostCountLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!profilePayload.profile.isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => void toggleFollow()}
                    disabled={followBusy}
                    className="rounded-lg border border-emerald-300/45 px-3 py-1.5 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                  >
                    {followBusy
                      ? "Updating..."
                      : profilePayload.profile.isFollowedByViewer
                        ? "Following"
                        : "Follow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openDmThread()}
                    className="rounded-lg border border-sky-300/35 px-3 py-1.5 text-sm font-semibold text-sky-200"
                  >
                    Message
                  </button>
                </>
              ) : null}
              <Link
                href="/wovo-ai"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-slate-100"
              >
                Back To App
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-xs uppercase tracking-[0.11em] text-slate-300">Followers</p>
              <p className="mt-1 text-lg font-semibold text-white">{profilePayload.profile.followersCount}</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-sm text-slate-200">
                {loadingLists ? (
                  <p className="text-xs text-slate-400">Loading followers...</p>
                ) : followers.length === 0 ? (
                  <p className="text-xs text-slate-400">No followers yet.</p>
                ) : (
                  followers.map((entry) => (
                    <Link
                      key={entry.userId}
                      href={`/wovo-ai/creator/${encodeURIComponent(entry.username)}`}
                      className="block rounded-md border border-white/10 bg-black/25 px-2 py-1.5 hover:border-emerald-300/30"
                    >
                      <p className="text-sm font-semibold text-white">{entry.displayName}</p>
                      <p className="text-xs text-emerald-200">@{entry.username}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-xs uppercase tracking-[0.11em] text-slate-300">Following</p>
              <p className="mt-1 text-lg font-semibold text-white">{profilePayload.profile.followingCount}</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-sm text-slate-200">
                {loadingLists ? (
                  <p className="text-xs text-slate-400">Loading following...</p>
                ) : following.length === 0 ? (
                  <p className="text-xs text-slate-400">Not following anyone yet.</p>
                ) : (
                  following.map((entry) => (
                    <Link
                      key={entry.userId}
                      href={`/wovo-ai/creator/${encodeURIComponent(entry.username)}`}
                      className="block rounded-md border border-white/10 bg-black/25 px-2 py-1.5 hover:border-emerald-300/30"
                    >
                      <p className="text-sm font-semibold text-white">{entry.displayName}</p>
                      <p className="text-xs text-emerald-200">@{entry.username}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-5 sm:p-6">
          <p className="text-sm uppercase tracking-[0.13em] text-emerald-200">Public Content</p>
          {posts.length === 0 ? (
            <p className="mt-3 rounded-xl border border-white/12 bg-black/35 p-4 text-sm text-slate-300">
              This creator has no public posts yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => {
                const videoSource = post.video ? (isProtectedVideoPath(post.video) ? (resolvedVideoUrls[post.video] ?? "") : post.video) : "";
                return (
                  <article key={post.id} className="overflow-hidden rounded-2xl border border-white/12 bg-black/35">
                    {post.video ? (
                      videoSource ? (
                        <video src={videoSource} controls className="h-52 w-full object-cover" />
                      ) : (
                        <div className="flex h-52 items-center justify-center text-xs text-slate-300">Preparing secure video...</div>
                      )
                    ) : post.image ? (
                      <img src={post.image} alt={post.brandName || "Public ad"} className="h-52 w-full object-cover" />
                    ) : (
                      <div className="flex h-52 items-center justify-center px-4 text-center text-xs text-slate-300">
                        Text-only post
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                        {moduleTitle(post.module)}
                      </p>
                      <p className="mt-1 line-clamp-3 text-sm text-slate-100">{post.text || post.prompt || "Generated post"}</p>
                      <p className="mt-2 text-[11px] text-slate-400">{formatDate(post.createdAt)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        ) : null}
      </section>
    </main>
  );
}
