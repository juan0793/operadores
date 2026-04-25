import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import assignmentsRoutes from "./routes/assignments.routes.js";
import authRoutes from "./routes/auth.routes.js";
import locationsRoutes from "./routes/locations.routes.js";
import publicRoutes from "./routes/public.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import routesRoutes from "./routes/routes.routes.js";
import usersRoutes from "./routes/users.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "sistema-rutas-operadores" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/routes", routesRoutes);
  app.use("/api/assignments", assignmentsRoutes);
  app.use("/api/locations", locationsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/public", publicRoutes);

  app.use((req, res) => res.status(404).json({ message: `Ruta no encontrada: ${req.path}` }));
  app.use((error, _req, res, _next) => {
    const isValidationError = error.name === "ZodError";
    const status = error.statusCode || (isValidationError ? 400 : error.code === "ER_DUP_ENTRY" ? 409 : 500);
    const firstIssue = isValidationError ? error.errors?.[0] : null;
    const field = firstIssue?.path?.join(".");
    const message = isValidationError
      ? `Datos invalidos${field ? ` en ${field}` : ""}: ${firstIssue?.message || "revisa el formulario"}`
      : error.code === "ER_DUP_ENTRY"
        ? "Ya existe un registro con esos datos."
        : error.message || "Error interno";
    res.status(status).json({ message, details: error.errors || undefined });
  });

  return app;
}
