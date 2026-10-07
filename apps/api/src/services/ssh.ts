import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Client } from "ssh2";
import { config } from "../config.js";
import { HttpError } from "./access.js";
const key = () => createHash("sha256").update(config.jwtSecret).update("netpulse-ssh-v1").digest();
export function encryptSshKey(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}
function decryptSshKey(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new HttpError(400, "Re-enter the SSH private key in device settings");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
export async function captureSshConfiguration(device: { ip: string; sshHost: string | null; sshPort: number | null; sshUsername: string | null; sshKeyEncrypted: string | null; sshHostFingerprint: string | null }, command: string) {
  if (!device.sshUsername || !device.sshKeyEncrypted) throw new HttpError(400, "Configure SSH username and private key first");
  if (!device.sshHostFingerprint) throw new HttpError(400, "Configure the trusted SSH host fingerprint first");
  const trustedFingerprint = device.sshHostFingerprint.startsWith("SHA256:") ? Buffer.from(device.sshHostFingerprint.slice(7), "base64").toString("hex") : device.sshHostFingerprint.toLowerCase();
  const privateKey = decryptSshKey(device.sshKeyEncrypted);
  const username = device.sshUsername;
  return new Promise<string>((resolve, reject) => {
    const client = new Client(); let settled = false; let output = ""; let stderr = "";
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); client.end(); if (error) reject(error); else if (!output.trim()) reject(new HttpError(502, "SSH returned an empty configuration")); else resolve(output); };
    const timer = setTimeout(() => finish(new HttpError(504, "SSH configuration capture timed out")), 15000);
    client.on("error", () => finish(new HttpError(502, "SSH connection or authentication failed")));
    client.on("ready", () => client.exec(command, (error, stream) => {
      if (error) return finish(new HttpError(502, "SSH command could not be started"));
      stream.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); if (Buffer.byteLength(output) > 2 * 1024 * 1024) finish(new HttpError(413, "Configuration exceeds 2 MiB")); });
      stream.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
      stream.on("close", (code: number | null) => finish(code && code !== 0 ? new HttpError(502, `SSH command failed${stderr ? "; inspect the device command" : ""}`) : undefined));
    }));
    client.connect({ host: device.sshHost || device.ip, port: device.sshPort ?? 22, username, privateKey, hostHash: "sha256", hostVerifier: (hash: string) => hash === trustedFingerprint, readyTimeout: 10000 });
  });
}
