export interface EnvsecClientOptions {
  /** Context to operate on, e.g. "myapp.dev" */
  context: string;
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
