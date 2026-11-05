import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true);
if (!process.env.OWNER_PASSWORD)
  throw new Error("Owner password is not configured locally.");
console.log(process.env.OWNER_PASSWORD);
