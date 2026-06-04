import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME ?? "Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@warehousenow.local",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
  },
};
