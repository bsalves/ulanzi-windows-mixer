#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(root, "com.ulanzi.windowsaudio.ulanziPlugin");
const htmlRef = process.env.SDK_HTML_REF || "main";
const nodeRef = process.env.SDK_NODE_REF || "main";

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const tmp = fs.mkdtempSync(path.join(root, "sdk-"));
run("git", ["clone", "--depth", "1", "--branch", htmlRef === "main" ? "main" : htmlRef, "https://github.com/UlanziTechnology/plugin-common-html.git", path.join(tmp, "html")]);
run("git", ["clone", "--depth", "1", "--branch", nodeRef === "main" ? "main" : nodeRef, "https://github.com/UlanziTechnology/plugin-common-node.git", path.join(tmp, "node")]);

fs.rmSync(path.join(plugin, "libs"), { recursive: true, force: true });
fs.mkdirSync(path.join(plugin, "libs"), { recursive: true });
for (const name of ["js", "css", "assets"]) {
  fs.cpSync(path.join(tmp, "html", name), path.join(plugin, "libs", name), { recursive: true });
}
fs.copyFileSync(path.join(tmp, "html", "LICENSE"), path.join(plugin, "libs", "LICENSE"));

fs.rmSync(path.join(plugin, "plugin-common-node"), { recursive: true, force: true });
fs.cpSync(path.join(tmp, "node"), path.join(plugin, "plugin-common-node"), {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}.git`) && !src.endsWith("test.js"),
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log("Vendored Ulanzi SDK into the plugin package.");
