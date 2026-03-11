/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["pdf-lib", "@pdf-lib/fontkit"],
  },
};

export default nextConfig;