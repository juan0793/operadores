import dotenv from "dotenv";

dotenv.config();

function env(primary, fallback, defaultValue = "") {
  return process.env[primary] || process.env[fallback] || defaultValue;
}

export const config = {
  port: Number(process.env.PORT || 4001),
  nodeEnv: process.env.NODE_ENV || "development",
  dbHost: env("DB_HOST", "MYSQLHOST", "127.0.0.1"),
  dbPort: Number(env("DB_PORT", "MYSQLPORT", "3307")),
  dbUser: env("DB_USER", "MYSQLUSER", "root"),
  dbPassword: env("DB_PASSWORD", "MYSQLPASSWORD"),
  dbName: env("DB_NAME", "MYSQLDATABASE", "sistema_rutas_operadores"),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5174",
  deviationWarningMeters: Number(process.env.DEVIATION_WARNING_METERS || 80),
};
