// Optional same-origin API proxy. When API_PROXY_TARGET is set at build time
// (e.g. http://backend:8000 in the deploy compose), the browser calls
// /api/v1/* on the frontend origin and Next.js forwards it to the backend over
// the internal network. This keeps the API off the public internet and lets it
// share the frontend's HTTPS (Cloudflare tunnel) origin.
const apiProxyTarget = (process.env.API_PROXY_TARGET || '').replace(/\/$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // FastAPI list routes end in "/". Without this, Next.js would 308 them to
  // the slash-less path and FastAPI would answer with a redirect to its
  // internal hostname, which the browser cannot reach.
  skipTrailingSlashRedirect: Boolean(apiProxyTarget),
  async rewrites() {
    if (!apiProxyTarget) return []
    return [
      // Listed first so the trailing slash survives the rewrite.
      { source: '/api/v1/:path*/', destination: `${apiProxyTarget}/api/v1/:path*/` },
      { source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` },
    ]
  },
}

module.exports = nextConfig
