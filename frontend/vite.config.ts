import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The FastAPI backend has no CORS middleware, so in development every API call
// goes through this proxy: /backend/* -> {VITE_BACKEND_URL}/*
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL || "http://localhost:8000";

  const proxy = {
    "/backend": {
      target: backendUrl,
      changeOrigin: true,
      // LLM-backed endpoints (profile, topics, articles) can run for minutes.
      timeout: 15 * 60 * 1000,
      proxyTimeout: 15 * 60 * 1000,
      rewrite: (path: string) => path.replace(/^\/backend/, ""),
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
