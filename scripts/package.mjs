#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginName = "com.ulanzi.windowsaudio.ulanziPlugin";
const plugin = path.join(root, pluginName);
const dist = path.join(root, "dist");

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd, shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["install", "--omit=dev"], plugin);
fs.mkdirSync(dist, { recursive: true });
const zipPath = path.join(dist, `${pluginName}.zip`);
if (process.platform === "win32") {
  run("powershell", ["-NoProfile", "-Command", `Compress-Archive -Force -Path '${plugin}' -DestinationPath '${zipPath}'`]);
} else {
  run("zip", ["-r", "-q", zipPath, pluginName], root);
}
console.log(`Built ${zipPath}`);
