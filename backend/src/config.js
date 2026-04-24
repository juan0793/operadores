import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4001),
  nodeEnv: process.env.NODE_ENV || "development",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: Number(process.env.DB_PORT || 3307),
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "sistema_rutas_operadores",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5174",
  deviationWarningMeters: Number(process.env.DEVIATION_WARNING_METERS || 80),
};
