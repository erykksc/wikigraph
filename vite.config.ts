import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function resolveBasePath() {
  const rawBasePath = process.env.APP_BASE_PATH?.trim();

  if (!rawBasePath) {
    return "/";
  }

  const withLeadingSlash = rawBasePath.startsWith("/")
    ? rawBasePath
    : `/${rawBasePath}`;

  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: resolveBasePath(),
}));
