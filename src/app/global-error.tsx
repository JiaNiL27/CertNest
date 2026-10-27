"use client";

// Last-resort boundary when the root layout itself fails. It renders its own
// document without the app's CSS, so styles are inline.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          color: "#173a40",
        }}
      >
        <title>Something went wrong · CertNest</title>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#55707a", marginBottom: 24 }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#0f5e57",
              color: "white",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
