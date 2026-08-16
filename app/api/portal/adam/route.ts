import { NextResponse } from "next/server";
import {
  archiveTask,
  askAdamOwner,
  acknowledgeFailureAlert,
  createCampaignDraft,
  createDeliveryDraft,
  createGoal,
  createLead,
  createTask,
  decideApproval,
  decideRecommendation,
  generateRecommendations,
  generateWeeklyReport,
  loadAdamSnapshot,
  refreshIntegrations,
  refreshKpis,
  requireAdamOwner,
  saveMemory,
  setMemoryArchive,
  submitCampaignReview,
  submitDeliveryReview,
  suppressLead,
  updateDailyReportSettings,
  updateAdamAiControls,
  updateLeadStatus,
  updateObjective,
  updateTask,
  type AdamActionBody,
} from "@/lib/adam/server";
import { PortalHttpError } from "@/lib/portal/server";
import { createDailyReportDraft, runDailyReport } from "@/lib/adam/daily-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof PortalHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && (error.message.includes("Missing bearer token") || error.message.includes("Unable to verify session"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("Adam Operations request failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
  return NextResponse.json({ error: "Adam Operations could not complete the request." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await requireAdamOwner(request.headers.get("authorization"));
    return NextResponse.json(await loadAdamSnapshot(context), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAdamOwner(request.headers.get("authorization"));
    const body = await request.json() as AdamActionBody;
    switch (body.action) {
      case "update_objective":
        return NextResponse.json(await updateObjective(context, body));
      case "ask_adam":
        return NextResponse.json(await askAdamOwner(context, body));
      case "update_ai_controls":
        return NextResponse.json(await updateAdamAiControls(context, body));
      case "create_goal":
        return NextResponse.json(await createGoal(context, body), { status: 201 });
      case "create_task":
        return NextResponse.json(await createTask(context, body), { status: 201 });
      case "update_task":
        return NextResponse.json(await updateTask(context, body));
      case "archive_task":
        return NextResponse.json(await archiveTask(context, body, false));
      case "restore_task":
        return NextResponse.json(await archiveTask(context, body, true));
      case "save_memory":
        return NextResponse.json(await saveMemory(context, body), { status: body.memoryId ? 200 : 201 });
      case "archive_memory":
        return NextResponse.json(await setMemoryArchive(context, body, false));
      case "restore_memory":
        return NextResponse.json(await setMemoryArchive(context, body, true));
      case "refresh_kpis":
        return NextResponse.json(await refreshKpis(context));
      case "generate_weekly_report":
        return NextResponse.json(await generateWeeklyReport(context), { status: 201 });
      case "generate_recommendations":
        return NextResponse.json(await generateRecommendations(context));
      case "decide_recommendation":
        return NextResponse.json(await decideRecommendation(context, body));
      case "decide_approval":
        return NextResponse.json(await decideApproval(context, body));
      case "refresh_integrations":
        return NextResponse.json(await refreshIntegrations(context));
      case "update_daily_report_settings":
        return NextResponse.json(await updateDailyReportSettings(context, body));
      case "run_daily_report": {
        const snapshot = await loadAdamSnapshot(context);
        return NextResponse.json(await runDailyReport(snapshot.workspace));
      }
      case "draft_daily_ai_report": {
        const snapshot = await loadAdamSnapshot(context);
        const result = await createDailyReportDraft(snapshot.workspace);
        return NextResponse.json({ report: result.report, reused: result.reused, externalActionTaken: false });
      }
      case "acknowledge_failure_alert":
        return NextResponse.json(await acknowledgeFailureAlert(context, body));
      case "create_lead":
        return NextResponse.json(await createLead(context, body), { status: 201 });
      case "update_lead_status":
        return NextResponse.json(await updateLeadStatus(context, body));
      case "suppress_lead":
        return NextResponse.json(await suppressLead(context, body));
      case "create_campaign_draft":
        return NextResponse.json(await createCampaignDraft(context, body), { status: 201 });
      case "submit_campaign_review":
        return NextResponse.json(await submitCampaignReview(context, body));
      case "create_delivery_draft":
        return NextResponse.json(await createDeliveryDraft(context, body), { status: 201 });
      case "submit_delivery_review":
        return NextResponse.json(await submitDeliveryReview(context, body));
      default:
        throw new PortalHttpError(400, "Unknown Adam Operations action.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
