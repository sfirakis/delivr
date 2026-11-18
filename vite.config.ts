import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Google Search Console verification (URL-prefix property).
 * Set VITE_GOOGLE_SITE_VERIFICATION in Vercel → Settings → Environment
 * Variables (the token only, not the whole <meta> tag) and redeploy.
 * When it is not set, no tag is written.
 */
function googleSiteVerification(token: string | undefined): Plugin {
  const clean = (token ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '')
  return {
    name: 'google-site-verification',
    transformIndexHtml(html) {
      return html.replace(
        '<!--%GOOGLE_SITE_VERIFICATION%-->',
        clean ? `<meta name="google-site-verification" content="${clean}" />` : '',
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), googleSiteVerification(env.VITE_GOOGLE_SITE_VERIFICATION)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
    },
  }
})
