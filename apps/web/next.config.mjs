/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@cloudscape-design/components",
    "@cloudscape-design/component-toolkit",
    "@cloudscape-design/board-components",
  ],
  output: "standalone",
};

export default nextConfig;
import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";

nextEnv.loadEnvConfig(fileURLToPath(new URL("../../", import.meta.url)), process.env.NODE_ENV !== "production");
