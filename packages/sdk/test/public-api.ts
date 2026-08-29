import {
  EnvsecClient,
  type EnvsecClientOptions,
  type LoadSecretsOptions,
  loadSecrets,
  type WithSecretsOptions,
  withSecrets,
} from "../src/index.js";

export const createContract: (
  options: EnvsecClientOptions
) => Promise<EnvsecClient> = EnvsecClient.create;

export const loadSecretsContract: (
  options: LoadSecretsOptions
) => Promise<Record<string, string>> = loadSecrets;

export const withSecretsContract: <Result>(
  options: WithSecretsOptions,
  callback: (secrets: Record<string, string>) => Promise<Result>
) => Promise<Result> = withSecrets;

declare const client: EnvsecClient;

export const getContract: Promise<string | null> = client.get("api.key");
export const requireContract: Promise<string> = client.require("api.key");
export const setContract: Promise<void> = client.set("api.key", "secret", {
  expires: "30d",
});
export const deleteContract: Promise<void> = client.delete("api.key");
export const loadAllContract: Promise<Record<string, string>> =
  client.loadAll();
export const injectEnvContract: Promise<void> = client.injectEnv();
export const closeContract: Promise<void> = client.close();
