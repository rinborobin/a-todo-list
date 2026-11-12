import { renderAppIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so the square stays square.
export default function AppleIcon() {
  return renderAppIcon(180, false);
}
