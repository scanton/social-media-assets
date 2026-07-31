import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next guess the wrong workspace root.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
