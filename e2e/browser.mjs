import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

/**
 * Launches the Chromium that this machine actually ships.
 *
 * The cloud container pre-installs one build under PLAYWRIGHT_BROWSERS_PATH and
 * blocks the download of another, so a Playwright upgrade that expects a newer
 * build number would otherwise fail every test with "Executable doesn't exist".
 * A Windows dev box has the same problem with %LOCALAPPDATA%\ms-playwright.
 * Fall back to whatever chromium is on disk.
 */
export function launchChromium(options = {}) {
  // Some suites hard-code the cloud container's path; honour it only where it exists.
  const { executablePath, ...rest } = options
  if (executablePath && existsSync(executablePath)) return chromium.launch(options)
  options = rest
  // E2E_CHANNEL=msedge|chrome uses an installed browser instead (Windows boxes
  // where the bundled build cannot be spawned).
  if (process.env.E2E_CHANNEL) return chromium.launch({ channel: process.env.E2E_CHANNEL, ...options })
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
  ].filter(Boolean)
  for (const root of roots) {
    if (!existsSync(root)) continue
    const dirs = readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()
    for (const dir of dirs) {
      for (const rel of ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe']) {
        const exe = join(root, dir, rel)
        if (existsSync(exe)) return chromium.launch({ executablePath: exe, ...options })
      }
    }
  }
  return chromium.launch(options)
}
