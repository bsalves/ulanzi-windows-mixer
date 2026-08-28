#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginName = "com.ulanzi.windowsaudio.ulanziPlugin";
const source = path.join(root, pluginName);

const dest = process.platform === "win32"
  ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Ulanzi", "UlanziDeck", "Plugins", pluginName)
  : path.join(os.homedir(), "Library", "Application Support", "Ulanzi", "UlanziDeck", "Plugins", pluginName);

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(source, dest, { recursive: true });
console.log(`Installed plugin to:\n${dest}`);
console.log("Restart Ulanzi Studio to load it.");
