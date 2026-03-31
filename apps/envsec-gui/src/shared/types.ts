import type { RPCSchema } from "electrobun/bun";

export interface Secret {
  account: string;
  expiresAt: string | null;
  key: string;
  service: string;
  updatedAt: string;
}

export interface Context {
  count: number;
  name: string;
}

export interface EnvsecRPC {
  bun: RPCSchema<{
    requests: {
      // biome-ignore lint/complexity/noBannedTypes: required by RPC schema
      listContexts: { params: {}; response: Context[] };
      listSecrets: {
        params: { context: string };
        response: Secret[];
      };
      getSecret: {
        params: { context: string; key: string };
        response: string;
      };
      addSecret: {
        params: {
          context: string;
          key: string;
          value: string;
          expires?: string;
        };
        response: { ok: boolean; error?: string };
      };
      deleteSecret: {
        params: { context: string; key: string };
        response: { ok: boolean; error?: string };
      };
      deleteContext: {
        params: { context: string };
        response: { ok: boolean; error?: string };
      };
      searchContexts: {
        params: { pattern: string };
        response: Context[];
      };
      auditSecrets: {
        // biome-ignore lint/complexity/noBannedTypes: required by RPC schema
        params: {};
        response: {
          expired: { context: string; key: string; expiresAt: string }[];
          expiring: {
            context: string;
            key: string;
            expiresAt: string;
            daysLeft: number;
          }[];
        };
      };
    };
    messages: {
      log: { msg: string };
    };
  }>;
  webview: RPCSchema<{
    // biome-ignore lint/complexity/noBannedTypes: required by RPC schema
    requests: {};
    messages: {
      secretsChanged: { context: string };
    };
  }>;
}
