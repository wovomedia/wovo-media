const baseUrl = (process.argv[2] || "https://wovomedia.com").replace(/\/$/, "");
const routes = ["/login", "/signup", "/forgot-password", "/auth/callback"];

function collectAssetPaths(html) {
  const matches = html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

for (const route of routes) {
  const pageResponse = await fetch(`${baseUrl}${route}`, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "WOVO-release-verifier/1.0" },
  });

  if (pageResponse.status !== 200) {
    throw new Error(`${route} returned ${pageResponse.status}`);
  }

  const html = await pageResponse.text();
  const assets = collectAssetPaths(html);
  if (assets.length === 0) {
    throw new Error(`${route} did not reference any Next.js assets`);
  }

  for (const assetPath of assets) {
    const assetUrl = new URL(assetPath, baseUrl);
    const assetResponse = await fetch(assetUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "WOVO-release-verifier/1.0" },
    });
    if (assetResponse.status !== 200) {
      throw new Error(`${route} references ${assetUrl.pathname}, which returned ${assetResponse.status}`);
    }
  }

  console.log(`${route}: 200 with ${assets.length} verified assets`);
}
