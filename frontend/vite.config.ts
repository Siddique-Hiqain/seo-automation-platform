import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The FastAPI backend has no CORS middleware, so in development the frontend calls it
// same-origin and Vite forwards the backend's own prefixes to {VITE_BACKEND_URL}.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8000";

  // LLM-backed endpoints (profile, topics, articles) can run for minutes.
  const target = {
    target: backendUrl,
    changeOrigin: true,
    timeout: 15 * 60 * 1000,
    proxyTimeout: 15 * 60 * 1000,
  };

  const proxy = {
    "/api": target,
    "/health": target,
  };

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
