import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,

  /**
   * We mount the Next app under `/app` to coexist with the ASP.NET MVC legacy
   * (route-by-route promotion + easy rollback).
   */
  basePath: "/app",

  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
