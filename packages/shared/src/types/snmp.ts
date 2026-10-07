import { z } from "zod";
export const snmpV3Schema = z.object({
  securityLevel: z.enum(["noAuthNoPriv", "authNoPriv", "authPriv"]), username: z.string().min(1),
  authProtocol: z.enum(["MD5", "SHA", "SHA224", "SHA256", "SHA384", "SHA512"]).optional(), authKey: z.string().min(8).optional(),
  privProtocol: z.enum(["DES", "AES", "AES256"]).optional(), privKey: z.string().min(8).optional(),
}).superRefine((config, ctx) => {
  if (config.securityLevel !== "noAuthNoPriv" && (!config.authProtocol || !config.authKey)) ctx.addIssue({ code: "custom", path: ["authKey"], message: "Authentication protocol and key are required" });
  if (config.securityLevel === "authPriv" && (!config.privProtocol || !config.privKey)) ctx.addIssue({ code: "custom", path: ["privKey"], message: "Privacy protocol and key are required" });
});
export type SnmpV3Config = z.infer<typeof snmpV3Schema>;
