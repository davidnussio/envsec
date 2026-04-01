import { execFile } from "node:child_process";
import { Effect, Layer } from "effect";
import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

/**
 * Windows implementation using PowerShell + Windows Credential Manager.
 *
 * All operations (set/get/remove) use P/Invoke to call Win32 Credential
 * Manager APIs (CredWriteW, CredReadW, CredDeleteW) directly via PowerShell.
 * This avoids cmdkey and its nested shell escaping issues entirely.
 *
 * No extra dependencies required — uses only built-in Windows APIs via PowerShell.
 *
 * Credential target format: "envsec:<service>/<account>"
 */

const runPowerShell = (script: string) =>
  Effect.async<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { maxBuffer: 1 * 1024 * 1024 }, // 1MB buffer for large scripts
      (error, stdout, stderr) => {
        if (error && "code" in error && error.code === "ENOENT") {
          resume(
            Effect.fail(
              new KeychainError({
                command: "powershell",
                stderr: "powershell.exe not found",
                message:
                  "PowerShell is not available. Ensure you are running on Windows.",
              })
            )
          );
          return;
        }
        let exitCode = 0;
        if (error) {
          exitCode = typeof error.code === "number" ? error.code : 1;
        }
        resume(
          Effect.succeed({
            exitCode,
            stdout,
            stderr,
          })
        );
      }
    );
  });

/**
 * Escape a string for use inside PowerShell single-quoted strings.
 * In PS single-quoted strings, the ONLY special character is the
 * single quote itself, which is escaped by doubling it.
 * Null bytes are stripped to prevent truncation attacks.
 */
const escapePS = (s: string): string =>
  s.replaceAll("\0", "").replaceAll("'", "''");

const targetName = (service: string, account: string) =>
  `envsec:${service}/${account}`;

/**
 * P/Invoke-based PowerShell script for writing credentials.
 * Uses CredWriteW directly — avoids cmdkey and its nested shell escaping issues.
 * All dynamic values are injected via PS single-quoted strings (escapePS).
 */
const credWriteScript = (target: string, user: string, password: string) =>
  [
    `Add-Type @'`,
    "using System;",
    "using System.Runtime.InteropServices;",
    "using System.Text;",
    "public class CredWriter {",
    `  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]`,
    "  public static extern bool CredWrite(ref CREDENTIAL cred, int flags);",
    "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]",
    "  public struct CREDENTIAL {",
    "    public int Flags; public int Type;",
    "    public string TargetName; public string Comment;",
    "    public long LastWritten; public int CredentialBlobSize;",
    "    public IntPtr CredentialBlob; public int Persist;",
    "    public int AttributeCount; public IntPtr Attributes;",
    "    public string TargetAlias; public string UserName;",
    "  }",
    "  public static bool Write(string target, string user, string pass) {",
    "    var bytes = Encoding.Unicode.GetBytes(pass);",
    "    var blob = Marshal.AllocHGlobal(bytes.Length);",
    "    Marshal.Copy(bytes, 0, blob, bytes.Length);",
    "    var c = new CREDENTIAL();",
    "    c.Type = 1; c.Persist = 2;",
    "    c.TargetName = target; c.UserName = user;",
    "    c.CredentialBlobSize = bytes.Length; c.CredentialBlob = blob;",
    "    var ok = CredWrite(ref c, 0);",
    "    Marshal.FreeHGlobal(blob);",
    "    return ok;",
    "  }",
    "}",
    `'@`,
    `$ok = [CredWriter]::Write('${target}', '${user}', '${password}')`,
    "if (-not $ok) { exit 1 }",
  ].join("\n");

/**
 * P/Invoke-based PowerShell script for deleting credentials.
 * Uses CredDeleteW directly — avoids cmdkey and its nested shell escaping issues.
 */
const credDeleteScript = (target: string) =>
  [
    `Add-Type @'`,
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class CredDeleter {",
    `  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]`,
    "  public static extern bool CredDelete(string target, int type, int flags);",
    "  public static bool Delete(string target) {",
    "    return CredDelete(target, 1, 0);",
    "  }",
    "}",
    `'@`,
    `$ok = [CredDeleter]::Delete('${target}')`,
    "if (-not $ok) { exit 1 }",
  ].join("\n");

const make = KeychainAccess.of({
  set: Effect.fn("WindowsCredentialManagerAccess.set")(function* (
    service: string,
    account: string,
    password: string
  ) {
    const target = escapePS(targetName(service, account));
    const user = escapePS(account);
    const pass = escapePS(password);

    const script = credWriteScript(target, user, pass);
    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "CredWriteW",
        stderr: result.stderr || result.stdout,
        message: `Failed to store credential: ${service}/${account}`,
      });
    }
  }),

  get: Effect.fn("WindowsCredentialManagerAccess.get")(function* (
    service: string,
    account: string
  ) {
    const target = escapePS(targetName(service, account));

    // Read credential using .NET CredentialManager API via PowerShell
    // This is the only reliable way to read the password back from Credential Manager
    const script = [
      "Add-Type -AssemblyName System.Runtime.InteropServices",
      "$cred = [System.Runtime.InteropServices.Marshal]",
      `$target = '${target}'`,
      // Use P/Invoke to call CredReadW
      `Add-Type @'`,
      "using System;",
      "using System.Runtime.InteropServices;",
      "public class CredManager {",
      `  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]`,
      "  public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);",
      `  [DllImport("advapi32.dll")]`,
      "  public static extern void CredFree(IntPtr cred);",
      "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]",
      "  public struct CREDENTIAL {",
      "    public int Flags; public int Type;",
      "    public string TargetName; public string Comment;",
      "    public long LastWritten; public int CredentialBlobSize;",
      "    public IntPtr CredentialBlob; public int Persist;",
      "    public int AttributeCount; public IntPtr Attributes;",
      "    public string TargetAlias; public string UserName;",
      "  }",
      "  public static string Read(string target) {",
      "    IntPtr ptr;",
      "    if (!CredRead(target, 1, 0, out ptr)) return null;",
      "    var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));",
      "    var pw = Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2);",
      "    CredFree(ptr);",
      "    return pw;",
      "  }",
      "}",
      `'@`,
      `$result = [CredManager]::Read('${target}')`,
      "if ($result -eq $null) { exit 1 }",
      "Write-Output $result",
    ].join("\n");

    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new SecretNotFoundError({
        key: account,
        context: service,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    return result.stdout.trim();
  }),

  remove: Effect.fn("WindowsCredentialManagerAccess.remove")(function* (
    service: string,
    account: string
  ) {
    const target = escapePS(targetName(service, account));

    const script = credDeleteScript(target);
    const result = yield* runPowerShell(script);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "CredDeleteW",
        stderr: result.stderr || result.stdout,
        message: `Failed to remove credential: ${service}/${account}`,
      });
    }
  }),
});

export const WindowsCredentialManagerAccessLive = Layer.succeed(
  KeychainAccess,
  make
);
