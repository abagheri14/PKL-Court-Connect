function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[ENV] Required environment variable ${name} is not set. Server cannot start.`);
  }
  return value;
}

export const ENV = {
  appId: requireEnv("VITE_APP_ID"),
  cookieSecret: requireEnv("JWT_SECRET"),
  databaseUrl: requireEnv("DATABASE_URL"),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
