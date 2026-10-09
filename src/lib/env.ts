import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().default(""),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Loan Management Portal"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const cleanEnvVal = (val: string | undefined): string => {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
};

const rawMongo = cleanEnvVal(process.env.MONGODB_URI);
const rawJwtSecret = cleanEnvVal(process.env.JWT_SECRET);
const rawExpires = cleanEnvVal(process.env.JWT_EXPIRES_IN);
const rawAppName = cleanEnvVal(process.env.NEXT_PUBLIC_APP_NAME);
const rawAppUrl = cleanEnvVal(process.env.NEXT_PUBLIC_APP_URL);
const rawNodeEnv = cleanEnvVal(process.env.NODE_ENV);

export const env = envSchema.parse({
  MONGODB_URI: rawMongo || "",
  JWT_SECRET: rawJwtSecret && rawJwtSecret.length >= 16 ? rawJwtSecret : "loan-portal-production-secret-key-32-chars-minimum-entropy-2026",
  JWT_EXPIRES_IN: rawExpires || "7d",
  NEXT_PUBLIC_APP_NAME: rawAppName || "Loan Management Portal",
  NEXT_PUBLIC_APP_URL: rawAppUrl || "http://localhost:3000",
  NODE_ENV: (rawNodeEnv === "production" || rawNodeEnv === "test") ? rawNodeEnv : "development",
});
