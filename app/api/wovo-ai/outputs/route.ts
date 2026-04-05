import { NextResponse } from "next/server";
import { requireServerUser, supabaseServiceRoleRequest } from "@/lib/supabase/server";
import {
  FEED_ALLOWED_MODULES,
  asRecord,
  asString,
  extractVideoJobIdFromPath,
  isEligibleFeedPost,
  isUuid,
} from "@/lib/wovo-ai/feed-utils";
import { getModerationStateForUser } from "@/lib/wovo-ai/moderation";
import {
  getFallbackOutputForUser,
  insertFallbackOutputForUser,
  isMissingGenerationsTableError,
  listFallbackOutputsForUser,
  updateFallbackOutputForUser,
} from "@/lib/wovo-ai/output-fallback-store";

type OutputRecord = {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
};

type OutputRequestBody = {
  module?: string;
  prompt?: string;
  output?: {
    text?: string;
    image?: string;
    video?: string;
    extra?: Record<string, unknown>;
  };
};

type OutputDistributionRequestBody = {
  outputId?: string;
  shareToFeed?: boolean;
  savedForSocial?: boolean;
  channels?: string[];
  decisionMade?: boolean;
};

type VideoJobRow = {
  id: string;
  status: string;
  provider_job_id: string | null;
};

const REQUIRED_VIDEO_OUTPUT_MODULES = new Set(["video_studio", "dance_remix"]);
const OPTIONAL_VIDEO_OUTPUT_MODULES = new Set(["spokesperson"]);
const VERIFIED_VIDEO_OUTPUT_MODULES = new Set(["video_studio", "dance_remix", "spokesperson"]);

export async function GET(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));

    let rows: OutputRecord[] | null = null;
    try {
      rows = await supabaseServiceRoleRequest<OutputRecord[]>(
        `/rest/v1/generations?select=id,input,output,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=20`
      );
    } catch (error) {
      if (!isMissingGenerationsTableError(error)) throw error;
      rows = await listFallbackOutputsForUser(user.id, 20);
    }

    return NextResponse.json({ outputs: rows ?? [] });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load outputs." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const moderation = await getModerationStateForUser(user.id);
    if (moderation.banned) {
      return NextResponse.json({ error: "Your account is currently restricted." }, { status: 403 });
    }
    const body = (await request.json()) as OutputRequestBody;

    if (!body.module || !body.prompt || !body.output) {
      return NextResponse.json({ error: "module, prompt, and output are required." }, { status: 400 });
    }
    if (!FEED_ALLOWED_MODULES.has(body.module)) {
      return NextResponse.json({ error: "Unsupported generation module." }, { status: 400 });
    }

    const normalizedExtra = asRecord(body.output.extra);
    const normalizedText = body.output.text ?? "";
    const normalizedImage = body.output.image ?? null;
    let normalizedVideo = body.output.video ?? null;

    if (VERIFIED_VIDEO_OUTPUT_MODULES.has(body.module)) {
      const videoPath = (body.output.video ?? "").trim();
      if (REQUIRED_VIDEO_OUTPUT_MODULES.has(body.module) && !videoPath) {
        return NextResponse.json(
          { error: "This module requires a generated Wovo video asset." },
          { status: 400 },
        );
      }
      if ((REQUIRED_VIDEO_OUTPUT_MODULES.has(body.module) || OPTIONAL_VIDEO_OUTPUT_MODULES.has(body.module)) && videoPath) {
        const pathJobId = extractVideoJobIdFromPath(videoPath);
        if (!pathJobId || !isUuid(pathJobId)) {
          return NextResponse.json(
            { error: "Video outputs must reference a valid Wovo video job." },
            { status: 400 },
          );
        }

        const videoRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
          `/rest/v1/video_jobs?select=id,status,provider_job_id&id=eq.${encodeURIComponent(pathJobId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
        );
        const videoJob = videoRows?.[0];
        const normalizedStatus = (videoJob?.status ?? "").trim().toLowerCase();
        const isCompleted = ["completed", "success", "succeeded"].includes(normalizedStatus);
        if (!videoJob || !isCompleted || !videoJob.provider_job_id) {
          return NextResponse.json(
            { error: "Video job is not ready yet. Please wait for completion and try again." },
            { status: 400 },
          );
        }

        normalizedVideo = videoPath;
        normalizedExtra.videoJobId = pathJobId;
      } else if (REQUIRED_VIDEO_OUTPUT_MODULES.has(body.module)) {
        normalizedVideo = null;
        delete normalizedExtra.videoJobId;
      }
    }

    const payload = {
      user_id: user.id,
      input: {
        module: body.module,
        prompt: body.prompt,
      },
      output: {
        text: normalizedText,
        image: normalizedImage,
        video: normalizedVideo,
        extra: {
          ...normalizedExtra,
          generatedBy: "wovo_ai",
          module: body.module,
        },
      },
    };

    let inserted: OutputRecord[] | null = null;
    try {
      inserted = await supabaseServiceRoleRequest<OutputRecord[]>("/rest/v1/generations", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (!isMissingGenerationsTableError(error)) throw error;
      const fallbackOutput = await insertFallbackOutputForUser({
        userId: user.id,
        input: payload.input,
        output: payload.output,
      });
      inserted = [fallbackOutput];
    }

    return NextResponse.json({ output: inserted?.[0] ?? null });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save output." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireServerUser(request.headers.get("authorization"));
    const moderation = await getModerationStateForUser(user.id);
    if (moderation.banned) {
      return NextResponse.json({ error: "Your account is currently restricted." }, { status: 403 });
    }
    const body = (await request.json()) as OutputDistributionRequestBody;
    const outputId = body.outputId?.trim();

    if (!outputId) {
      return NextResponse.json({ error: "outputId is required." }, { status: 400 });
    }

    let useFallbackOutputs = false;
    let current: { id: string; input: Record<string, unknown>; output: Record<string, unknown> } | null = null;
    try {
      const currentRows = await supabaseServiceRoleRequest<Array<{ id: string; input: Record<string, unknown>; output: Record<string, unknown> }>>(
        `/rest/v1/generations?select=id,input,output&id=eq.${encodeURIComponent(outputId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
      );
      current = currentRows?.[0] ?? null;
    } catch (error) {
      if (!isMissingGenerationsTableError(error)) throw error;
      useFallbackOutputs = true;
      current = await getFallbackOutputForUser(user.id, outputId);
    }
    if (!current) {
      return NextResponse.json({ error: "Output not found." }, { status: 404 });
    }

    const existingOutput = asRecord(current.output);
    const existingExtra = asRecord(existingOutput.extra);
    const existingDistribution = asRecord(existingExtra.distribution);

    const normalizedChannels = Array.isArray(body.channels)
      ? body.channels.map((channel) => channel.trim().toLowerCase()).filter(Boolean)
      : undefined;

    const shareToFeed = body.shareToFeed ?? Boolean(existingDistribution.shareToFeed);
    const savedForSocial = body.savedForSocial ?? Boolean(existingDistribution.savedForSocial);
    const inheritedDecision = Boolean(existingDistribution.decisionMade);
    const decisionMade =
      typeof body.decisionMade === "boolean" ? body.decisionMade : inheritedDecision || shareToFeed || savedForSocial;

    const distribution = {
      shareToFeed,
      savedForSocial,
      decisionMade,
      channels: normalizedChannels ?? (Array.isArray(existingDistribution.channels) ? existingDistribution.channels : []),
      updatedAt: new Date().toISOString(),
    };

    const currentInput = asRecord(current.input);
    const moduleId = typeof currentInput.module === "string" ? currentInput.module : "";
    if (typeof existingExtra.generatedBy !== "string" || !asString(existingExtra.generatedBy).trim()) {
      existingExtra.generatedBy = "wovo_ai";
    }
    if (typeof existingExtra.module !== "string" || !asString(existingExtra.module).trim()) {
      existingExtra.module = moduleId || "ad_studio";
    }

    const nextOutput = {
      ...existingOutput,
      extra: {
        ...existingExtra,
        distribution,
      },
    };

    if (distribution.shareToFeed) {
      if (moderation.feedPostingDisabled) {
        return NextResponse.json(
          { error: "Feed posting is disabled for your account by admin review." },
          { status: 403 },
        );
      }

      const nextOutputRecord = asRecord(nextOutput);
      const nextOutputExtra = asRecord(nextOutput.extra);
      const outputVideoPath = typeof nextOutputRecord.video === "string" ? nextOutputRecord.video.trim() : "";

      if (REQUIRED_VIDEO_OUTPUT_MODULES.has(moduleId) && !outputVideoPath) {
        return NextResponse.json(
          { error: "This post requires a generated Wovo video asset before publishing." },
          { status: 400 },
        );
      }

      if (VERIFIED_VIDEO_OUTPUT_MODULES.has(moduleId) && outputVideoPath) {
        const jobIdFromPath = extractVideoJobIdFromPath(outputVideoPath);
        const jobIdFromExtra =
          typeof nextOutputExtra.videoJobId === "string" ? nextOutputExtra.videoJobId.trim().toLowerCase() : "";
        if (!jobIdFromPath || !isUuid(jobIdFromPath) || jobIdFromPath !== jobIdFromExtra) {
          return NextResponse.json(
            { error: "Video feed posts must use a verified Wovo video job." },
            { status: 400 },
          );
        }

        const videoRows = await supabaseServiceRoleRequest<VideoJobRow[]>(
          `/rest/v1/video_jobs?select=id,status,provider_job_id&id=eq.${encodeURIComponent(jobIdFromPath)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
        );
        const videoJob = videoRows?.[0];
        const normalizedStatus = (videoJob?.status ?? "").trim().toLowerCase();
        const isCompleted = ["completed", "success", "succeeded"].includes(normalizedStatus);
        if (!videoJob || !isCompleted || !videoJob.provider_job_id) {
          return NextResponse.json(
            { error: "This video cannot be posted yet because the generation job is incomplete." },
            { status: 400 },
          );
        }
      }

      const eligible = isEligibleFeedPost({
        input: current.input,
        output: nextOutput,
      });
      if (!eligible) {
        return NextResponse.json(
          { error: "Only eligible Wovo AI generated posts can be shared to feed." },
          { status: 400 },
        );
      }
    }

    let updatedOutput: OutputRecord | null = null;
    if (useFallbackOutputs) {
      updatedOutput = await updateFallbackOutputForUser({
        userId: user.id,
        outputId,
        output: nextOutput,
      });
    } else {
      const updatedRows = await supabaseServiceRoleRequest<OutputRecord[]>(
        `/rest/v1/generations?id=eq.${encodeURIComponent(outputId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            output: nextOutput,
          }),
        }
      );
      updatedOutput = updatedRows?.[0] ?? null;
    }

    if (!updatedOutput) {
      return NextResponse.json({ error: "Output not found." }, { status: 404 });
    }

    return NextResponse.json({ output: updatedOutput, distribution });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update output distribution." },
      { status: 500 }
    );
  }
}
