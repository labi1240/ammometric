/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    cacheComponents: true,

    // Pin the workspace root so Turbopack doesn't pick up a stray lockfile in a
    // parent directory (e.g. ~/pnpm-lock.yaml) as the root.
    turbopack: {
        root: import.meta.dirname,
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'logo.clearbit.com' },
            { protocol: 'https', hostname: 'placehold.co' },
            { protocol: 'https', hostname: 'images.ammometric.com' },
            { protocol: 'https', hostname: 'pub-e8693513b15ffde1022b7f6a0ae2d0f2.r2.dev' },
            { protocol: 'https', hostname: 'd3hpw7f66a218f.cloudfront.net' }, // Common CDN seen in industry
            // Add other potential image sources if known
        ],
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    },
    experimental: {
        serverComponentsHmrCache: true, // defaults to true
    },
};

export default nextConfig;
