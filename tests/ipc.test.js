import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import net from "node:net";
import { describe, it } from "node:test";
import { decodeMessage, encodeRequest, isEvent } from "../com.ulanzi.windowsaudio.ulanziPlugin/plugin/lib/ipc/protocol.js";

describe("IPC protocol", () => {
  it("encodes a request as a single JSON line", () => {
    const line = encodeRequest({ id: "1", cmd: "ping" });
    assert.equal(line.endsWith("\n"), true);
    const parsed = JSON.parse(line);
    assert.equal(parsed.cmd, "ping");
  });

  it("decodes valid responses and events", () => {
    const response = decodeMessage('{"id":"1","ok":true,"data":{"volume":0.5}}');
    assert.equal(isEvent(response), false);
    assert.equal(response.ok, true);
    const event = decodeMessage('{"type":"event","event":"masterChanged","data":{"volume":0.2,"muted":false}}');
    assert.equal(isEvent(event), true);
    assert.equal(event.event, "masterChanged");
  });

  it("rejects invalid JSON", () => {
    assert.equal(decodeMessage("not-json"), null);
    assert.equal(decodeMessage(""), null);
  });
});

describe("IPC transport", () => {
  it("times out when the helper never answers", async () => {
    const server = net.createServer((socket) => {
      socket.on("data", () => {});
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    socket.write(encodeRequest({ id: "timeout", cmd: "ping" }));
    const timedOut = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), 50);
      socket.once("data", () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    socket.destroy();
    server.close();
    assert.equal(timedOut, true);
  });

  it("handles unexpected disconnects", async () => {
    const closed = new EventEmitter();
    const server = net.createServer((socket) => {
      socket.destroy();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const disconnected = await new Promise((resolve) => {
      socket.on("close", () => resolve(true));
      socket.on("error", () => resolve(true));
      setTimeout(() => resolve(false), 1000);
    });
    server.close();
    closed.emit("done");
    assert.equal(disconnected, true);
  });
});
