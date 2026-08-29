import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "WOVO Media weekly marketing workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3efe6",
          color: "#191714",
          padding: "72px 78px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-3px" }}>WOVO</div>
          <div style={{ border: "2px solid rgba(25,23,20,.25)", borderRadius: 999, padding: "8px 16px", fontSize: 15, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" }}>
            Media
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
          <div style={{ color: "#d94326", fontSize: 18, fontWeight: 800, letterSpacing: "4px", textTransform: "uppercase" }}>
            Weekly marketing workspace
          </div>
          <div style={{ marginTop: 24, fontSize: 76, lineHeight: .98, fontWeight: 700, letterSpacing: "-4px" }}>
            Make the week make sense.
          </div>
          <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 18, fontSize: 24, color: "#655f56" }}>
            <span>Plan</span><span style={{ color: "#f05a3a" }}>•</span><span>Review</span><span style={{ color: "#f05a3a" }}>•</span><span>Move forward</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, color: "#655f56" }}>
          <span>Start free · plans or one-time credits</span>
          <span>Serving businesses worldwide</span>
        </div>
        <div style={{ position: "absolute", right: 78, top: 72, width: 82, height: 82, borderRadius: 999, background: "#f05a3a" }} />
      </div>
    ),
    size
  );
}
