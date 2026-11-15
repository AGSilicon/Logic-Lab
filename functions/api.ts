
import { onRequest } from "../../functions/api/[[path]]";

type Env = {
  APP_ORIGIN: string;
  GITHUB_APP_CLIENT_ID: string;
  GITHUB_APP_CLIENT_SECRET: string;
  GITHUB_APP_SLUG: string;
  SESSION_ENCRYPTION_KEY: string;
};

const runtimeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env ?? {};

export default async (request: Request): Promise<Response> => {
  const env: Env = {
    APP_ORIGIN: runtimeEnv.APP_ORIGIN ?? "",
    GITHUB_APP_CLIENT_ID: runtimeEnv.GITHUB_APP_CLIENT_ID ?? "",
    GITHUB_APP_CLIENT_SECRET: runtimeEnv.GITHUB_APP_CLIENT_SECRET ?? "",
    GITHUB_APP_SLUG: runtimeEnv.GITHUB_APP_SLUG ?? "",
    SESSION_ENCRYPTION_KEY: runtimeEnv.SESSION_ENCRYPTION_KEY ?? "",
  };

  return onRequest({ request, env });
};

export const config = {
  path: "/api/*",
};
