"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");
const {
  PERSONA_HOOK_MARKER,
  installPersonaCodexHook,
  isLoopbackCodexTurnUrl,
  removePersonaStopHookConfig,
  upsertPersonaStopHookConfig,
} = require("./codex-hook.cjs");

function temporaryFixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "persona-codex-hook-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const codexDirectory = path.join(root, ".codex");
  const tokenFilePath = path.join(root, "codex-turn-token");
  fs.mkdirSync(codexDirectory, { recursive: true });
  fs.writeFileSync(tokenFilePath, `${"ab".repeat(32)}\n`, { mode: 0o600 });
  return { codexDirectory, root, tokenFilePath };
}

function runProcess(executable, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      resolve({
        code,
        signal,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      }),
    );
    child.stdin.end(input);
  });
}

function captureServer(context, token) {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
        method: request.method,
        url: request.url,
      });
      response.writeHead(202, { "content-type": "application/json" });
      response.end('{"accepted":true}');
    });
  });
  context.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        endpoint: `http://127.0.0.1:${address.port}/codex-turn`,
        requests,
        token,
      });
    });
  });
}

test("accepts only an exact loopback Codex-turn endpoint", () => {
  assert.equal(
    isLoopbackCodexTurnUrl("http://127.0.0.1:47831/codex-turn"),
    true,
  );
  assert.equal(
    isLoopbackCodexTurnUrl("http://localhost:47831/codex-turn"),
    true,
  );
  assert.equal(
    isLoopbackCodexTurnUrl("https://127.0.0.1:47831/codex-turn"),
    false,
  );
  assert.equal(
    isLoopbackCodexTurnUrl("http://example.test/codex-turn"),
    false,
  );
  assert.equal(
    isLoopbackCodexTurnUrl("http://127.0.0.1:47831/codex-turn?text=secret"),
    false,
  );
});

test("merges the Persona Stop hook without changing existing hooks", () => {
  const source = JSON.stringify({
    custom: { keep: true },
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "pre" }] }],
      Stop: [{ hooks: [{ type: "command", command: "existing-stop" }] }],
    },
  });
  const handler = {
    type: "command",
    command: `node hook.cjs --hook-id ${PERSONA_HOOK_MARKER}`,
    commandWindows: `powershell hook.ps1 -HookId ${PERSONA_HOOK_MARKER}`,
  };
  const once = upsertPersonaStopHookConfig(source, handler);
  const twice = upsertPersonaStopHookConfig(once, handler);
  const document = JSON.parse(twice);
  const handlers = document.hooks.Stop.flatMap((group) => group.hooks ?? []);

  assert.deepEqual(document.custom, { keep: true });
  assert.equal(document.hooks.PreToolUse.length, 1);
  assert.ok(handlers.some((candidate) => candidate.command === "existing-stop"));
  assert.equal(
    handlers.filter((candidate) =>
      candidate.command?.includes(PERSONA_HOOK_MARKER),
    ).length,
    1,
  );
  assert.equal(twice, once);

  const removed = JSON.parse(removePersonaStopHookConfig(twice));
  assert.deepEqual(
    removed.hooks.Stop.flatMap((group) => group.hooks ?? []),
    [{ type: "command", command: "existing-stop" }],
  );
});

test("installs private forwarding scripts and an idempotent hooks document", (context) => {
  const fixture = temporaryFixture(context);
  const endpoint = "http://127.0.0.1:47831/codex-turn";
  fs.writeFileSync(
    path.join(fixture.codexDirectory, "hooks.json"),
    '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"keep"}]}]}}\n',
  );

  const first = installPersonaCodexHook({
    codexDirectory: fixture.codexDirectory,
    endpoint,
    tokenFilePath: fixture.tokenFilePath,
  });
  const firstConfig = fs.readFileSync(first.hooks_path, "utf8");
  const second = installPersonaCodexHook({
    codexDirectory: fixture.codexDirectory,
    endpoint,
    tokenFilePath: fixture.tokenFilePath,
  });

  assert.equal(second.status, "installed");
  assert.equal(fs.readFileSync(second.hooks_path, "utf8"), firstConfig);
  assert.equal(fs.existsSync(second.node_script_path), true);
  assert.equal(fs.existsSync(second.powershell_script_path), true);
  assert.match(firstConfig, /"commandWindows"/);
  assert.match(firstConfig, /"command": "keep"/);
});

test("Node Stop hook forwards only last_assistant_message and always prints valid JSON", async (context) => {
  const fixture = temporaryFixture(context);
  const capture = await captureServer(context, "ab".repeat(32));
  const installed = installPersonaCodexHook({
    codexDirectory: fixture.codexDirectory,
    endpoint: capture.endpoint,
    tokenFilePath: fixture.tokenFilePath,
  });
  const input = JSON.stringify({
    hook_event_name: "Stop",
    last_assistant_message: "  Hello from Codex.  ",
    prompt: "must not be forwarded",
    transcript_path: "must not be forwarded",
  });

  const result = await runProcess(
    process.execPath,
    [
      installed.node_script_path,
      "--endpoint",
      capture.endpoint,
      "--token-file",
      fixture.tokenFilePath,
      "--hook-id",
      PERSONA_HOOK_MARKER,
    ],
    input,
  );

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim(), "{}");
  assert.deepEqual(capture.requests, [
    {
      authorization: `Bearer ${capture.token}`,
      body: '{"text":"Hello from Codex."}',
      method: "POST",
      url: "/codex-turn",
    },
  ]);
});

test(
  "PowerShell Stop hook forwards only last_assistant_message and always prints valid JSON",
  { skip: process.platform !== "win32" },
  async (context) => {
    const fixture = temporaryFixture(context);
    const capture = await captureServer(context, "ab".repeat(32));
    const installed = installPersonaCodexHook({
      codexDirectory: fixture.codexDirectory,
      endpoint: capture.endpoint,
      tokenFilePath: fixture.tokenFilePath,
    });
    const input = JSON.stringify({
      hook_event_name: "Stop",
      last_assistant_message: "PowerShell says hello.",
      tool_response: "must not be forwarded",
    });

    const result = await runProcess(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        installed.powershell_script_path,
        "-Endpoint",
        capture.endpoint,
        "-TokenFile",
        fixture.tokenFilePath,
        "-HookId",
        PERSONA_HOOK_MARKER,
      ],
      input,
    );

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim(), "{}");
    assert.deepEqual(capture.requests, [
      {
        authorization: `Bearer ${capture.token}`,
        body: '{"text":"PowerShell says hello."}',
        method: "POST",
        url: "/codex-turn",
      },
    ]);
  },
);
