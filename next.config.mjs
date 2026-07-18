const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Phones on the same Wi-Fi open the dev server through this Mac's LAN IP.
  // Next.js 16 blocks dev JS chunks from non-localhost origins unless the
  // hostname is explicitly allowed, leaving the page visible but unhydrated
  // (native file picker opens, but React onClick/onChange never runs).
  allowedDevOrigins: ['192.168.219.100'],
};

export default nextConfig;
