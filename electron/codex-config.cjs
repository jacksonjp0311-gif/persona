"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { installPersonaCodexHook } = require("./codex-hook.cjs");

const PERSONA_SECTION = "[mcp_servers.persona]";

function upsertPersonaMcpConfig(source, serverUrl) {
  if (
    typeof serverUrl !== "string" ||
    !/^http:\/\/127\.0\.0\.1:\d+\/mcp$/.test(serverUrl)
  ) {
    throw new Error("Persona MCP URL must use the local loopback server.");
  }
  const normalized = typeof source === "string" ? source.replaceAll("\r\n", "\n") : "";
  const lines = normalized.split("\n");
  const sectionStart = lines.findIndex((line) => line.trim() === PERSONA_SECTION);
  const urlLine = `url = ${JSON.stringify(serverUrl)}`;

  if (sectionStart < 0) {
    const separator = normalized.trim() === "" ? "" : "\n\n";
    return `${normalized.trimEnd()}${separator}${PERSONA_SECTION}\n${urlLine}\n`;
  }

  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }
  const existingUrl = lines.findIndex(
    (line, index) =>
      index > sectionStart &&
      index < sectionEnd &&
      /^\s*url\s*=/.test(line),
  );
  if (existingUrl >= 0) lines[existingUrl] = urlLine;
  else lines.splice(sectionStart + 1, 0, urlLine);
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}

function connectCodexCli({
  homeDirectory,
  serverUrl,
  speechHook = null,
}) {
  const codexDirectory = path.join(homeDirectory, ".codex");
  const configPath = path.join(codexDirectory, "config.toml");
  fs.mkdirSync(codexDirectory, { recursive: true });
  const existing = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, "utf8")
    : "";
  const next = upsertPersonaMcpConfig(existing, serverUrl);
  const temporaryPath = `${configPath}.persona-tmp`;
  fs.writeFileSync(temporaryPath, next, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
  const installedSpeechHook =
    speechHook == null
      ? null
      : installPersonaCodexHook({
          codexDirectory,
          endpoint: speechHook.endpoint,
          tokenFilePath: speechHook.tokenFilePath,
        });
  return {
    config_path: configPath,
    server_url: serverUrl,
    ...(installedSpeechHook
      ? { speech_hook: installedSpeechHook }
      : {}),
    status: "connected",
  };
}

module.exports = {
  connectCodexCli,
  installPersonaCodexHook,
  upsertPersonaMcpConfig,
};
