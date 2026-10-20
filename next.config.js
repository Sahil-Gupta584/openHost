/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Native/streaming server-side deps loaded at runtime (build pipeline deps).
  experimental: {
    serverComponentsExternalPackages: ['archiver', 'adm-zip', 'esbuild'],
  },
};

module.exports = nextConfig;
