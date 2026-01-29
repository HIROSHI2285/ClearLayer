/** @type {import('next').NextConfig} */
const nextConfig = {
    // Headers for Cross-Origin Isolation (optional but recommended for high-performance AI apps)
    // Security Headers & COOP/COEP
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()', // Minimize permissions
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload', // HSTS for HTTPS
                    },
                    {
                        // CSP: Restrict sources to self, blobs (images/workers), and Wasm.
                        // 'unsafe-eval' is required for Wasm/Transformers.js execution in some environments.
                        // 'unsafe-inline' for styles is needed for Next.js inline styles (or 'unsafe-eval' for dev).
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; font-src 'self' data: https://fonts.gstatic.com; connect-src * blob: data:; worker-src 'self' blob:;",
                    }
                ],
            },
        ];
    },
    // Output static files for safest deployment (no server vulnerability)
    // output: 'export', // Uncomment this if deploying to Vercel/Netlify/S3 directly as static site

};

export default nextConfig;
