/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Recommended if storing images locally on cPanel
  },
};

export default nextConfig;