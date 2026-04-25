import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 4173,
    allowedHosts: [
      "operadores-frontend-production.up.railway.app",
      process.env.RAILWAY_PUBLIC_DOMAIN,
    ].filter(Boolean),
  },
  server: {
    host: "0.0.0.0",
  },
});
