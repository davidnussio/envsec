export interface EnvsecClientOptions {
  /**
   * Context(s) to operate on.
   * - Single context: `"myapp.dev"`
   * - Multiple contexts: `["myapp.defaults", "myapp.dev"]`
   *
   * When an array is provided, secrets are merged left-to-right
   * (later contexts override earlier ones).
   */
  context: string | string[];
  /** Override default SQLite path (~/.envsec/store.sqlite) */
  dbPath?: string;
}

export interface LoadSecretsOptions extends EnvsecClientOptions {
  /**
   * Inject secrets into process.env after loading.
   * Key transform: "api.token" → "API_TOKEN"
   * @default false
   */
  inject?: boolean;
}

export interface WithSecretsOptions extends EnvsecClientOptions {
  inject?: boolean;
}
