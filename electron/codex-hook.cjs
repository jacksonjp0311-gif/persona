"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  CODEX_TURN_PATH,
  MAX_CODEX_TURN_TEXT_LENGTH,
  TOKEN_PATTERN,
} = require("./codex-turn.cjs");

const PERSONA_HOOK_MARKER = "persona-codex-speech-v1";
const PERSONA_HOOK_DIRECTORY = "persona";
const NODE_HOOK_FILENAME = "persona-codex-stop-hook.cjs";
const POWERSHELL_HOOK_FILENAME = "persona-codex-stop-hook.ps1";

const NODE_HOOK_SCRIPT_SOURCE = String.raw`"use strict";

const fs = require("node:fs");
const http = require("node:http");

const MAX_INPUT_BYTES = 128 * 1024;
const MAX_TEXT_LENGTH = 16000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function endpoint(raw) {
  try {
    const value = new URL(raw);
    if (
      value.protocol !== "http:" ||
      !LOOPBACK_HOSTS.has(value.hostname.toLowerCase()) ||
      value.pathname !== "/codex-turn" ||
      value.search !== "" ||
      value.hash !== "" ||
      value.username !== "" ||
      value.password !== ""
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

let finished = false;
let hardTimeout = null;
function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(hardTimeout);
  process.stdout.write("{}\n");
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) {
    process.stdin.resume();
    finish();
  }
});
process.stdin.on("error", finish);
process.stdin.on("end", () => {
  if (finished) return;
  try {
    const event = JSON.parse(input);
    const text =
      event?.hook_event_name === "Stop" &&
      typeof event.last_assistant_message === "string"
        ? event.last_assistant_message.trim()
        : "";
    const target = endpoint(argument("--endpoint"));
    const tokenFile = argument("--token-file");
    const token =
      typeof tokenFile === "string"
        ? fs.readFileSync(tokenFile, "utf8").trim().toLowerCase()
        : "";
    if (
      target == null ||
      text.length === 0 ||
      text.length > MAX_TEXT_LENGTH ||
      text.includes("\0") ||
      !TOKEN_PATTERN.test(token)
    ) {
      finish();
      return;
    }

    const body = JSON.stringify({ text });
    const request = http.request(
      target,
      {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-length": Buffer.byteLength(body),
          "content-type": "application/json",
        },
        timeout: 1200,
      },
      (response) => {
        response.resume();
        response.once("end", finish);
      },
    );
    request.once("timeout", () => request.destroy());
    request.once("error", finish);
    request.end(body);
    hardTimeout = setTimeout(() => {
      request.destroy();
      finish();
    }, 1500);
  } catch {
    finish();
  }
});
`;

const POWERSHELL_HOOK_SCRIPT_SOURCE = String.raw`param(
  [Parameter(Mandatory = $true)]
  [string]$Endpoint,
  [Parameter(Mandatory = $true)]
  [string]$TokenFile,
  [string]$HookId = "persona-codex-speech-v1"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

try {
  $target = [System.Uri]$Endpoint
  $allowedHosts = @("127.0.0.1", "localhost", "::1", "[::1]")
  if (
    $target.Scheme -ne "http" -or
    $allowedHosts -notcontains $target.Host.ToLowerInvariant() -or
    $target.AbsolutePath -ne "/codex-turn" -or
    $target.Query -ne "" -or
    $target.Fragment -ne "" -or
    $target.UserInfo -ne ""
  ) {
    throw "Persona hook endpoint must be loopback."
  }

  $eventText = [Console]::In.ReadToEnd()
  $event = $eventText | ConvertFrom-Json
  $message = if (
    $event.hook_event_name -eq "Stop" -and
    $event.last_assistant_message -is [string]
  ) {
    $event.last_assistant_message.Trim()
  } else {
    ""
  }
  $token = (Get-Content -LiteralPath $TokenFile -Raw).Trim().ToLowerInvariant()
  if (
    $message.Length -gt 0 -and
    $message.Length -le 16000 -and
    $message.IndexOf([char]0) -lt 0 -and
    $token -match "^[a-f0-9]{64}$"
  ) {
    $body = @{ text = $message } | ConvertTo-Json -Compress
    Invoke-WebRequest -Uri $target -Method Post -UseBasicParsing -TimeoutSec 2 -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body | Out-Null
  }
} catch {
  # Persona must never block or alter the Codex turn when it is unavailable.
} finally {
  [Console]::Out.WriteLine("{}")
}
`;

function isLoopbackCodexTurnUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(
        url.hostname.toLowerCase(),
      ) &&
      url.pathname === CODEX_TURN_PATH &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function quotePosix(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function quoteWindows(value) {
  const text = String(value);
  if (text.includes('"') || /[\r\n]/.test(text)) {
    throw new Error("Persona hook paths cannot contain quotes or newlines.");
  }
  return `"${text}"`;
}

function createPersonaStopHookHandler({
  endpoint,
  nodeScriptPath,
  powershellScriptPath,
  tokenFilePath,
}) {
  if (!isLoopbackCodexTurnUrl(endpoint)) {
    throw new Error("Persona's Codex-turn endpoint must use local loopback.");
  }
  for (const filePath of [
    nodeScriptPath,
    powershellScriptPath,
    tokenFilePath,
  ]) {
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("Persona hook paths are required.");
    }
  }

  return {
    type: "command",
    command: [
      "node",
      quotePosix(nodeScriptPath),
      "--endpoint",
      quotePosix(endpoint),
      "--token-file",
      quotePosix(tokenFilePath),
      "--hook-id",
      PERSONA_HOOK_MARKER,
    ].join(" "),
    commandWindows: [
      "powershell.exe",
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      quoteWindows(powershellScriptPath),
      "-Endpoint",
      quoteWindows(endpoint),
      "-TokenFile",
      quoteWindows(tokenFilePath),
      "-HookId",
      PERSONA_HOOK_MARKER,
    ].join(" "),
    timeout: 3,
    statusMessage: "Sending the final response to Persona",
  };
}

function isPersonaHookHandler(handler) {
  return (
    handler != null &&
    typeof handler === "object" &&
    [handler.command, handler.commandWindows].some(
      (command) =>
        typeof command === "string" &&
        command.includes(PERSONA_HOOK_MARKER),
    )
  );
}

function parseHooksDocument(source) {
  if (typeof source !== "string" || source.trim() === "") {
    return {
      description: "Local Codex lifecycle hooks.",
      hooks: {},
    };
  }
  const document = JSON.parse(source);
  if (document == null || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("Codex hooks.json must contain a JSON object.");
  }
  if (document.hooks == null) document.hooks = {};
  if (
    typeof document.hooks !== "object" ||
    Array.isArray(document.hooks)
  ) {
    throw new Error("Codex hooks.json has an invalid hooks object.");
  }
  return document;
}

function upsertPersonaStopHookConfig(source, handler) {
  const document = parseHooksDocument(source);
  const stopGroups = document.hooks.Stop ?? [];
  if (!Array.isArray(stopGroups)) {
    throw new Error("Codex hooks.json has an invalid Stop hook list.");
  }

  let inserted = false;
  for (const group of stopGroups) {
    if (
      group == null ||
      typeof group !== "object" ||
      !Array.isArray(group.hooks)
    ) {
      continue;
    }
    const nextHandlers = [];
    for (const existing of group.hooks) {
      if (isPersonaHookHandler(existing)) {
        if (!inserted) {
          nextHandlers.push(handler);
          inserted = true;
        }
      } else {
        nextHandlers.push(existing);
      }
    }
    group.hooks = nextHandlers;
  }
  if (!inserted) {
    stopGroups.push({ hooks: [handler] });
  }
  document.hooks.Stop = stopGroups;
  return `${JSON.stringify(document, null, 2)}\n`;
}

function removePersonaStopHookConfig(source) {
  const document = parseHooksDocument(source);
  const stopGroups = document.hooks.Stop;
  if (!Array.isArray(stopGroups)) return `${JSON.stringify(document, null, 2)}\n`;
  document.hooks.Stop = stopGroups.flatMap((group) => {
    if (
      group == null ||
      typeof group !== "object" ||
      !Array.isArray(group.hooks)
    ) {
      return [group];
    }
    const hooks = group.hooks.filter(
      (handler) => !isPersonaHookHandler(handler),
    );
    return hooks.length > 0 ? [{ ...group, hooks }] : [];
  });
  return `${JSON.stringify(document, null, 2)}\n`;
}

function writePrivateFile(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.persona-tmp`;
  fs.writeFileSync(temporaryPath, contents, {
    encoding: "utf8",
    mode,
  });
  fs.renameSync(temporaryPath, filePath);
}

function installPersonaCodexHook({
  codexDirectory,
  endpoint,
  tokenFilePath,
}) {
  if (typeof codexDirectory !== "string" || codexDirectory.length === 0) {
    throw new Error("A Codex configuration directory is required.");
  }
  if (!isLoopbackCodexTurnUrl(endpoint)) {
    throw new Error("Persona's Codex-turn endpoint must use local loopback.");
  }
  const token = fs.readFileSync(tokenFilePath, "utf8").trim().toLowerCase();
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Persona's Codex-turn token is invalid.");
  }

  const personaDirectory = path.join(
    codexDirectory,
    PERSONA_HOOK_DIRECTORY,
  );
  const nodeScriptPath = path.join(personaDirectory, NODE_HOOK_FILENAME);
  const powershellScriptPath = path.join(
    personaDirectory,
    POWERSHELL_HOOK_FILENAME,
  );
  const hooksPath = path.join(codexDirectory, "hooks.json");
  writePrivateFile(nodeScriptPath, NODE_HOOK_SCRIPT_SOURCE, 0o700);
  writePrivateFile(
    powershellScriptPath,
    POWERSHELL_HOOK_SCRIPT_SOURCE,
    0o700,
  );
  const handler = createPersonaStopHookHandler({
    endpoint,
    nodeScriptPath,
    powershellScriptPath,
    tokenFilePath,
  });
  const existing = fs.existsSync(hooksPath)
    ? fs.readFileSync(hooksPath, "utf8")
    : "";
  writePrivateFile(
    hooksPath,
    upsertPersonaStopHookConfig(existing, handler),
    0o600,
  );
  return {
    hooks_path: hooksPath,
    node_script_path: nodeScriptPath,
    powershell_script_path: powershellScriptPath,
    status: "installed",
  };
}

module.exports = {
  MAX_CODEX_TURN_TEXT_LENGTH,
  NODE_HOOK_FILENAME,
  NODE_HOOK_SCRIPT_SOURCE,
  PERSONA_HOOK_MARKER,
  POWERSHELL_HOOK_FILENAME,
  POWERSHELL_HOOK_SCRIPT_SOURCE,
  createPersonaStopHookHandler,
  installPersonaCodexHook,
  isLoopbackCodexTurnUrl,
  isPersonaHookHandler,
  removePersonaStopHookConfig,
  upsertPersonaStopHookConfig,
};
