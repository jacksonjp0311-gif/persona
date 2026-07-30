"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  MAX_CODEX_TURN_TEXT_LENGTH,
  bearerToken,
  ensureCodexTurnToken,
  normalizeCodexTurnBody,
  tokenMatches,
} = require("./codex-turn.cjs");

test("accepts only a bounded assistant-text payload", () => {
  assert.deepEqual(normalizeCodexTurnBody({ text: "  Hello\r\nthere.  " }), {
    type: "codex-turn",
    text: "Hello\nthere.",
  });
  assert.equal(normalizeCodexTurnBody({ text: "Hello", turn_id: "private" }), null);
  assert.equal(normalizeCodexTurnBody({ text: "" }), null);
  assert.equal(normalizeCodexTurnBody({ text: "x\0y" }), null);
  assert.equal(
    normalizeCodexTurnBody({
      text: "x".repeat(MAX_CODEX_TURN_TEXT_LENGTH + 1),
    }),
    null,
  );
});

test("validates a fixed-size bearer token without accepting alternate schemes", () => {
  const token = "ab".repeat(32);
  assert.equal(bearerToken(`Bearer ${token}`), token);
  assert.equal(tokenMatches(`Bearer ${token.toUpperCase()}`, token), true);
  assert.equal(tokenMatches(`Basic ${token}`, token), false);
  assert.equal(tokenMatches(`Bearer ${"cd".repeat(32)}`, token), false);
  assert.equal(tokenMatches(undefined, token), false);
});

test("creates and reuses a private Codex-turn token", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "persona-turn-token-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const first = ensureCodexTurnToken({
    directory,
    randomBytes: () => Buffer.alloc(32, 0xab),
  });
  const second = ensureCodexTurnToken({
    directory,
    randomBytes: () => Buffer.alloc(32, 0xcd),
  });

  assert.equal(first.token, "ab".repeat(32));
  assert.deepEqual(second, first);
  assert.equal(fs.readFileSync(first.tokenFilePath, "utf8"), `${first.token}\n`);
});
