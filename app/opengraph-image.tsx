import { ImageResponse } from "next/og";

export const alt = "Citation Agent — trusted crypto research marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          padding: "72px 80px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0)",
            backgroundSize: "28px 28px",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 520,
            height: 520,
            display: "flex",
            background:
              "radial-gradient(ellipse at center, rgba(245,200,66,0.07) 0%, transparent 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 14,
              border: "1px solid #1f1f1f",
              backgroundColor: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
              <path
                d="M11 9L7 16L11 23"
                stroke="#f5f5f5"
                strokeWidth="1.75"
                strokeLinecap="square"
              />
              <path
                d="M21 9L25 16L21 23"
                stroke="#f5f5f5"
                strokeWidth="1.75"
                strokeLinecap="square"
              />
              <circle cx="16" cy="16" r="2.25" fill="#f5c842" />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 14,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#666666",
              }}
            >
              Crypto research marketplace
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 58,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#f5f5f5",
                lineHeight: 1,
              }}
            >
              Citation Agent
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 48,
              height: 3,
              backgroundColor: "#f5c842",
              marginBottom: 28,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.45,
              color: "#f5f5f5",
              marginBottom: 20,
            }}
          >
            Researchers sell crypto research. Agents buy it.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              lineHeight: 1.5,
              color: "#666666",
            }}
          >
            Protocol analysis, wallet investigations, ecosystem reports — paywalled
            per unlock on Arc Testnet.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #1f1f1f",
            paddingTop: 24,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 16,
              letterSpacing: "0.12em",
              color: "#666666",
            }}
          >
            x402 · USDC · Circle Gateway
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#f5c842" }}>
            citation-agent.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}