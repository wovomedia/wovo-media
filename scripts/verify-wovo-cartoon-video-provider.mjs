import OpenAI from "openai";

if (!process.argv.includes("--confirm-live-cost")) {
  throw new Error("This check creates one 8-second provider test. Re-run with --confirm-live-cost after approving the small provider charge.");
}

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
const video = await client.videos.create({
  model: process.env.WOVO_CARTOON_VIDEO_MODEL || "sora-2",
  seconds: "8",
  size: "720x1280",
  prompt: "An original friendly coral paper-cut bird mascot waves beside a simple ivory W letter, warm studio lighting, clean vertical composition, no people, no brands, no copyrighted characters, no private data.",
}, { idempotencyKey: "wovo-cartoon-provider-release-test-v1" });

let current = video;
for (let attempt = 0; attempt < 60 && !["completed", "failed"].includes(current.status); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  current = await client.videos.retrieve(video.id);
}

if (current.status !== "completed") {
  throw new Error(`Production video provider test ended with status ${current.status}.`);
}

const output = await client.videos.downloadContent(video.id);
const sizeBytes = (await output.arrayBuffer()).byteLength;
if (sizeBytes < 1_000 || sizeBytes > 100 * 1024 * 1024) throw new Error("Production video provider returned an invalid asset size.");

console.log(JSON.stringify({
  verified: true,
  provider: "openai",
  model: current.model,
  seconds: 8,
  dimensions: "720x1280",
  outputReceived: true,
  outputSizeBytes: sizeBytes,
  externalPublishingTested: false,
}, null, 2));
