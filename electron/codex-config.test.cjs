"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  connectCodexCli,
  upsertPersonaMcpConfig,
} = require("./codex-config.cjs");

const SERVER_URL = "http://127.0.0.1:44832/mcp";

test("adds Persona without disturbing existing Codex configuration", () => {
  const source = 'model = "gpt-5"\n\n[mcp_servers.other]\nurl = "https://example.test/mcp"\n';
  const result = upsertPersonaMcpConfig(source, SERVER_URL);
  assert.match(result, /model = "gpt-5"/);
  assert.match(result, /\[mcp_servers\.other\]/);
  assert.match(result, /\[mcp_servers\.persona\]\nurl = "http:\/\/127\.0\.0\.1:44832\/mcp"/);
});

test("updates an existing Persona URL idempotently", () => {
  const source = '[mcp_servers.persona]\nurl = "http://127.0.0.1:1/mcp"\n';
  const once = upsertPersonaMcpConfig(source, SERVER_URL);
  assert.equal(upsertPersonaMcpConfig(once, SERVER_URL), once);
  assert.equal(once.match(/\[mcp_servers\.persona\]/g)?.length, 1);
});

test("writes the supported Codex config under the selected home", () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), "persona-codex-"));
  try {
    fs.mkdirSync(path.join(temporaryHome, ".codex"));
    fs.writeFileSync(
      path.join(temporaryHome, ".codex", "config.toml"),
      'model = "gpt-5"\n',
    );
    const result = connectCodexCli({
      homeDirectory: temporaryHome,
      serverUrl: SERVER_URL,
    });
    assert.equal(result.status, "connected");
    assert.equal(
      fs.readFileSync(result.config_path, "utf8"),
      `model = "gpt-5"\n\n${PERSONA_CONFIG}`,
    );
  } finally {
    fs.rmSync(temporaryHome, { recursive: true, force: true });
  }
});

test("optionally installs the trusted local speech hook with the MCP connection", () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), "persona-codex-"));
  try {
    const tokenFilePath = path.join(temporaryHome, "codex-turn-token");
    fs.writeFileSync(tokenFilePath, `${"ab".repeat(32)}\n`, { mode: 0o600 });
    const result = connectCodexCli({
      homeDirectory: temporaryHome,
      serverUrl: SERVER_URL,
      speechHook: {
        endpoint: "http://127.0.0.1:44832/codex-turn",
        tokenFilePath,
      },
    });

    assert.equal(result.status, "connected");
    assert.equal(result.speech_hook.status, "installed");
    assert.equal(fs.existsSync(result.speech_hook.hooks_path), true);
    assert.match(
      fs.readFileSync(result.speech_hook.hooks_path, "utf8"),
      /persona-codex-speech-v1/,
    );
  } finally {
    fs.rmSync(temporaryHome, { recursive: true, force: true });
  }
});

const PERSONA_CONFIG = `[mcp_servers.persona]\nurl = "${SERVER_URL}"\n`;
