import "server-only";

export const WOVO_AI_MODES = ["fast", "balanced", "premium"] as const;
export const WOVO_AI_FEATURES = ["chat", "image_visual", "website_page", "product_page", "code"] as const;

export type WovoAiMode = (typeof WOVO_AI_MODES)[number];
export type WovoAiFeature = (typeof WOVO_AI_FEATURES)[number];

const FEATURE_BASE_UNITS: Record<WovoAiFeature, Record<WovoAiMode, number>> = {
  chat: { fast: 2, balanced: 4, premium: 10 },
  image_visual: { fast: 12, balanced: 22, premium: 44 },
  website_page: { fast: 8, balanced: 16, premium: 32 },
  product_page: { fast: 7, balanced: 14, premium: 28 },
  code: { fast: 6, balanced: 15, premium: 36 },
};

const INPUT_LIMITS: Record<WovoAiFeature, number> = {
  chat: 12_000,
  image_visual: 6_000,
  website_page: 24_000,
  product_page: 18_000,
  code: 30_000,
};

function positiveInteger(name: string): number | null {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function modelEnv(mode: WovoAiMode, code: boolean): string {
  const key = `WOVO_${code ? "CODE" : "AI"}_${mode.toUpperCase()}_MODEL`;
  return process.env[key]?.trim() ?? "";
}

function costPerUnit(mode: WovoAiMode): number | null {
  return positiveInteger(`WOVO_AI_PROVIDER_COST_MICROS_PER_UNIT_${mode.toUpperCase()}`);
}

export type WovoAiRuntimeState = {
  aiReady: boolean;
  codeReady: boolean;
  topupReady: boolean;
  providerCredentialReady: boolean;
  moderationReady: boolean;
  telemetryReady: boolean;
  codeSandboxReady: boolean;
  pricingGuardReady: boolean;
};

export function getWovoAiRuntimeState(): WovoAiRuntimeState {
  const providerCredentialReady = Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim());
  const moderationReady = enabled("WOVO_AI_MODERATION_READY");
  const telemetryReady = enabled("WOVO_AI_TELEMETRY_READY");
  const codeSandboxReady = enabled("WOVO_CODE_SANDBOX_READY");
  const revenuePerUnit = positiveInteger("WOVO_AI_REVENUE_MICROCENTS_PER_UNIT");
  const marginBps = positiveInteger("WOVO_AI_MIN_GROSS_MARGIN_BPS");
  const costs = WOVO_AI_MODES.map(costPerUnit);
  const pricingGuardReady = Boolean(
    revenuePerUnit
    && marginBps
    && marginBps < 10_000
    && costs.every((cost) => cost && revenuePerUnit * (10_000 - marginBps) >= cost * 10_000)
  );
  const aiModelsReady = WOVO_AI_MODES.every((mode) => Boolean(modelEnv(mode, false)));
  const codeModelsReady = WOVO_AI_MODES.every((mode) => Boolean(modelEnv(mode, true)));
  const commonReady = enabled("WOVO_AI_ENABLED")
    && providerCredentialReady
    && moderationReady
    && telemetryReady
    && pricingGuardReady
    && aiModelsReady;
  const aiReady = commonReady;
  const codeReady = commonReady
    && enabled("WOVO_CODE_ENABLED")
    && codeSandboxReady
    && codeModelsReady
    && Boolean(process.env.WOVO_CODE_PRICE_ID?.trim());
  const topupReady = aiReady
    && enabled("WOVO_AI_CREDIT_TOPUP_ENABLED")
    && Boolean(process.env.WOVO_AI_CREDIT_TOPUP_PRICE_IDS?.trim());
  return {
    aiReady,
    codeReady,
    topupReady,
    providerCredentialReady,
    moderationReady,
    telemetryReady,
    codeSandboxReady,
    pricingGuardReady,
  };
}

export type WovoAiCostEstimate = {
  feature: WovoAiFeature;
  mode: WovoAiMode;
  units: number;
  estimatedProviderCostMicros: number;
  requiresConfirmation: boolean;
  maxInputCharacters: number;
};

export function estimateWovoAiCost(input: {
  feature: WovoAiFeature;
  mode: WovoAiMode;
  inputCharacters: number;
}): WovoAiCostEstimate {
  if (!WOVO_AI_FEATURES.includes(input.feature)) throw new Error("Unsupported WOVO AI feature.");
  if (!WOVO_AI_MODES.includes(input.mode)) throw new Error("Unsupported WOVO AI mode.");
  const maxInputCharacters = INPUT_LIMITS[input.feature];
  if (!Number.isInteger(input.inputCharacters) || input.inputCharacters < 0 || input.inputCharacters > maxInputCharacters) {
    throw new Error(`Input must be ${maxInputCharacters.toLocaleString()} characters or fewer.`);
  }
  const inputUnits = Math.ceil(input.inputCharacters / 4_000);
  const units = FEATURE_BASE_UNITS[input.feature][input.mode] + inputUnits;
  const perUnit = costPerUnit(input.mode);
  if (!perUnit) throw new Error("AI pricing controls are not configured.");
  return {
    feature: input.feature,
    mode: input.mode,
    units,
    estimatedProviderCostMicros: units * perUnit,
    requiresConfirmation: units >= 20 || input.mode === "premium",
    maxInputCharacters,
  };
}

/** Provider/model identifiers are server-only and never shown in the default client UI. */
export function resolveServerModelRoute(mode: WovoAiMode, feature: WovoAiFeature): string {
  const state = getWovoAiRuntimeState();
  const code = feature === "code";
  if (code ? !state.codeReady : !state.aiReady) throw new Error(`${code ? "WOVO Code" : "WOVO AI"} is not enabled.`);
  const model = modelEnv(mode, code);
  if (!model.includes("/")) throw new Error("Configured model route must use provider/model format.");
  return model;
}
