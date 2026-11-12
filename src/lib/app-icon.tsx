import { ImageResponse } from "next/og";

/** The rail motif: a vertical line with the orange "now" dot, on ink. */
export function renderAppIcon(size: number, rounded: boolean) {
  const unit = size / 16;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          borderRadius: rounded ? unit * 3.5 : 0,
        }}
      >
        <div style={{ position: "relative", width: unit * 8, height: unit * 9, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: unit * 1.4,
              top: 0,
              width: unit * 0.7,
              height: unit * 9,
              background: "#d6d0c2",
              borderRadius: unit,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: unit * 3.2,
              width: unit * 3.5,
              height: unit * 3.5,
              borderRadius: unit * 2,
              background: "#e2672e",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: unit * 4.4,
              top: unit * 4.45,
              width: unit * 3.6,
              height: unit * 1,
              borderRadius: unit,
              background: "#f6f3ec",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
