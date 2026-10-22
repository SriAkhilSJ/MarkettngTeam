/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Arena / E2B live-preview host in dev (and any *.e2b.app preview)
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev"],
};

export default nextConfig;
