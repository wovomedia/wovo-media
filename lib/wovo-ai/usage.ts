export type PromptActionType = "chat" | "caption" | "caption_image" | "image";

export function getPromptCreditCost(type: string): number {
  if (type === "chat")          return 1;
  if (type === "caption")       return 1;
  if (type === "caption_image") return 2;
  if (type === "image")         return 3;
  return 1;
}

export function getCreditTone(credits: number): "green" | "yellow" | "red" {
  if (credits > 20) return "green";
  if (credits >= 6) return "yellow";
  return "red";
}

export function userHasEnoughCredits(credits: number, type: string): boolean {
  return credits >= getPromptCreditCost(type);
}

export function normalizeActionType(type: string): PromptActionType {
  if (type === "caption" || type === "caption_image" || type === "image") return type;
  return "chat";
}
