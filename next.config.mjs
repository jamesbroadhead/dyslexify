import { execFileSync } from 'node:child_process'

let gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA
if (!gitSha) {
  try {
    gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    gitSha = 'unknown'
  }
}

const nextConfig = {
  env: { NEXT_PUBLIC_GIT_SHA: gitSha.slice(0, 12) },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}

export default nextConfig
