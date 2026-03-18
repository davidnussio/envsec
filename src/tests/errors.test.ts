import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import {
  CommandNotFoundError,
  InvalidKeyError,
  KeychainError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";

describe("SecretNotFoundError", () => {
  test("should create error with required fields", () => {
    const error = new SecretNotFoundError({
      key: "api-key",
      context: "myapp.prod",
      message: "Secret not found",
    });

    expect(error.key).toBe("api-key");
    expect(error.context).toBe("myapp.prod");
    expect(error.message).toBe("Secret not found");
  });

  test("should have correct tag", () => {
    const error = new SecretNotFoundError({
      key: "token",
      context: "stripe.dev",
      message: "Not found",
    });

    expect(error._tag).toBe("SecretNotFoundError");
  });

  test("should be serializable with Schema", () => {
    const error = new SecretNotFoundError({
      key: "db-password",
      context: "postgres.staging",
      message: "Secret not found",
    });

    const decoded = Schema.decodeSync(SecretNotFoundError)(error);
    expect(decoded.key).toBe("db-password");
    expect(decoded.context).toBe("postgres.staging");
  });
});

describe("KeychainError", () => {
  test("should create error with required fields", () => {
    const error = new KeychainError({
      command: "security find-generic-password",
      stderr: "The specified item could not be found in the keychain",
      message: "Keychain operation failed",
    });

    expect(error.command).toBe("security find-generic-password");
    expect(error.stderr).toContain("item could not be found");
    expect(error.message).toBe("Keychain operation failed");
  });

  test("should have correct tag", () => {
    const error = new KeychainError({
      command: "security add-generic-password",
      stderr: "error",
      message: "Failed",
    });

    expect(error._tag).toBe("KeychainError");
  });

  test("should preserve stderr with special characters", () => {
    const stderr = 'Error: "item" with name "test-key" not found';
    const error = new KeychainError({
      command: "cmdkey /generic:service",
      stderr,
      message: "Windows credential access failed",
    });

    const decoded = Schema.decodeSync(KeychainError)(error);
    expect(decoded.stderr).toBe(stderr);
  });
});

describe("MetadataStoreError", () => {
  test("should create error with required fields", () => {
    const error = new MetadataStoreError({
      operation: "INSERT",
      message: "Database constraint violation",
    });

    expect(error.operation).toBe("INSERT");
    expect(error.message).toBe("Database constraint violation");
  });

  test("should have correct tag", () => {
    const error = new MetadataStoreError({
      operation: "SELECT",
      message: "Query failed",
    });

    expect(error._tag).toBe("MetadataStoreError");
  });

  test("should handle various database operations", () => {
    const operations = ["SELECT", "INSERT", "UPDATE", "DELETE"];

    for (const op of operations) {
      const error = new MetadataStoreError({
        operation: op,
        message: `Failed to execute ${op}`,
      });

      const decoded = Schema.decodeSync(MetadataStoreError)(error);
      expect(decoded.operation).toBe(op);
    }
  });
});

describe("InvalidKeyError", () => {
  test("should create error with required fields", () => {
    const error = new InvalidKeyError({
      key: "invalid..key",
      message: "Key contains invalid characters",
    });

    expect(error.key).toBe("invalid..key");
    expect(error.message).toBe("Key contains invalid characters");
  });

  test("should have correct tag", () => {
    const error = new InvalidKeyError({
      key: "test",
      message: "Invalid",
    });

    expect(error._tag).toBe("InvalidKeyError");
  });

  test("should preserve key format in serialization", () => {
    const keys = [
      "key-with-dashes",
      "key_with_underscores",
      "UPPERCASE_KEY",
      "key123",
    ];

    for (const key of keys) {
      const error = new InvalidKeyError({
        key,
        message: `${key} is invalid`,
      });

      const decoded = Schema.decodeSync(InvalidKeyError)(error);
      expect(decoded.key).toBe(key);
    }
  });
});

describe("CommandNotFoundError", () => {
  test("should create error with required fields", () => {
    const error = new CommandNotFoundError({
      name: "secret-tool",
      message: "Command not found in PATH",
    });

    expect(error.name).toBe("secret-tool");
    expect(error.message).toBe("Command not found in PATH");
  });

  test("should have correct tag", () => {
    const error = new CommandNotFoundError({
      name: "security",
      message: "Not available",
    });

    expect(error._tag).toBe("CommandNotFoundError");
  });

  test("should be serializable with Schema", () => {
    const error = new CommandNotFoundError({
      name: "cmdkey",
      message: "Windows Credential Manager tool not found",
    });

    const decoded = Schema.decodeSync(CommandNotFoundError)(error);
    expect(decoded.name).toBe("cmdkey");
    expect(decoded.message).toContain("Credential Manager");
  });
});

describe("Error Schema Validation", () => {
  test("all errors should encode/decode correctly", () => {
    const errors = [
      new SecretNotFoundError({
        key: "api-key",
        context: "prod",
        message: "Not found",
      }),
      new KeychainError({
        command: "test",
        stderr: "error",
        message: "Failed",
      }),
      new MetadataStoreError({
        operation: "SELECT",
        message: "Failed",
      }),
      new InvalidKeyError({
        key: "invalid",
        message: "Invalid key",
      }),
      new CommandNotFoundError({
        name: "tool",
        message: "Not found",
      }),
    ];

    for (const error of errors) {
      const ErrorType = Object.getPrototypeOf(error).constructor;
      const decoded = Schema.decodeSync(ErrorType)(error);
      expect(decoded).toBeDefined();
      expect(decoded.message).toBeDefined();
    }
  });
});
