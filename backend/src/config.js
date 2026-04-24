import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4001),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5174",
};

if (!config.databaseUrl) {
  console.warn("DATABASE_URL no esta definida. Configura backend/.env antes de iniciar.");
}
