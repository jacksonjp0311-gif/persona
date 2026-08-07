"use strict";

const nodeCrypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CODEX_TURN_PATH = "/codex-turn";
const CODEX_TURN_TOKEN_FILENAME = "codex-turn-token";
const MAX_CODEX_TURN_TEXT_LENGTH = 16_000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function normalizeCodexTurnBody(value) {
  if (
    value == null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "text") ||
    typeof value.text !== "string"
  ) {
    return null;
  }

  const text = value.text.replaceAll("\r\n", "\n").trim();
  if (
    text.length === 0 ||
    text.length > MAX_CODEX_TURN_TEXT_LENGTH ||
    text.includes("\0")
  ) {
    return null;
  }

  return {
    type: "codex-turn",
    text,
  };
}

function bearerToken(header) {
  if (typeof header !== "string") return null;
  const match = /^Bearer ([A-Fa-f0-9]{64})$/.exec(header);
  return match?.[1].toLowerCase() ?? null;
}

function tokenMatches(header, expectedToken) {
  const actual = bearerToken(header);
  if (actual == null || !TOKEN_PATTERN.test(expectedToken ?? "")) return false;
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expectedToken.toLowerCase(), "utf8");
  return (
    actualBytes.length === expectedBytes.length &&
    nodeCrypto.timingSafeEqual(actualBytes, expectedBytes)
  );
}

function ensureCodexTurnToken({
  directory,
  filename = CODEX_TURN_TOKEN_FILENAME,
  randomBytes = nodeCrypto.randomBytes,
} = {}) {
  if (typeof directory !== "string" || directory.length === 0) {
    throw new Error("A token directory is required.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    throw new Error("The token filename is invalid.");
  }

  fs.mkdirSync(directory, { recursive: true });
  const tokenFilePath = path.join(directory, filename);
  if (fs.existsSync(tokenFilePath)) {
    const existing = fs.readFileSync(tokenFilePath, "utf8").trim().toLowerCase();
    if (TOKEN_PATTERN.test(existing)) {
      return { token: existing, tokenFilePath };
    }
  }

  const token = randomBytes(32).toString("hex");
  const temporaryPath = `${tokenFilePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${token}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, tokenFilePath);
  return { token, tokenFilePath };
}

module.exports = {
  CODEX_TURN_PATH,
  CODEX_TURN_TOKEN_FILENAME,
  MAX_CODEX_TURN_TEXT_LENGTH,
  TOKEN_PATTERN,
  bearerToken,
  ensureCodexTurnToken,
  normalizeCodexTurnBody,
  tokenMatches,
};
