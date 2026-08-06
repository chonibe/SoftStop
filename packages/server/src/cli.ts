#!/usr/bin/env node

import { readFile } from "fs/promises";
import { createGovernor, type GovernorConfig } from "@governor/core";
import { MemoryGovernorStorage, SupabaseGovernorStorage } from "@governor/storage";
import { startGovernorServer } from "./api";

const loadConfig = async (): Promise<GovernorConfig> => {
  const policyFile = process.env.GOVERNOR_POLICY_FILE;
  const policyJson = process.env.GOVERNOR_POLICIES_JSON;

  if (policyFile) {
    return JSON.parse(await readFile(policyFile, "utf8")) as GovernorConfig;
  }

  if (policyJson) {
    return JSON.parse(policyJson) as GovernorConfig;
  }

  return { policies: [] };
};

const main = async () => {
  const config = await loadConfig();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const hostname = process.env.HOST ?? "127.0.0.1";
  const governor = createGovernor(config);
  const storage = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseGovernorStorage({
        url: process.env.SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      })
    : new MemoryGovernorStorage();
  const { url } = await startGovernorServer({ governor, port, hostname, storage });

  console.log(`Governor server listening on ${url}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
