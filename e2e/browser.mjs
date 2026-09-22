import { existsSync, readdirSync } from 'node:fs'
import { chromium } from 'playwright'

/**
 * Launches the Chromium that this image actually ships.
 *
 * The container pre-installs one build under PLAYWRIGHT_BROWSERS_PATH and
 * blocks the download of another, so a Playwright upgrade that expects a newer
 * build number would otherwise fail every test with "Executable doesn't exist".
 * Fall back to whatever chromium is on disk.
 */
export function launchChromium(options = {}) {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  if (existsSync(root)) {
    const dir = readdirSync(root)
      .filter(d => d.startsWith('chromium-'))
      .sort()
      .pop()
    const exe = dir && `${root}/${dir}/chrome-linux/chrome`
    if (exe && existsSync(exe)) return chromium.launch({ executablePath: exe, ...options })
  }
  return chromium.launch(options)
}
