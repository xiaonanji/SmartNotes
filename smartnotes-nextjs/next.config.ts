import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  },
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300
    }
    return config
  }
};

export default nextConfig;
