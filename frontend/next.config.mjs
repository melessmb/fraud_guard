/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_URL || "http://localhost:8780"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
