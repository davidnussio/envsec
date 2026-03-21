import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: join(import.meta.dirname, "."),
  },
};

export default nextConfig;
