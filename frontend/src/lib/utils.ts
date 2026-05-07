import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { DateTime } from 'luxon'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertDate (obj: Record<string, any>, dateKeys: string[]) {
  dateKeys.map(key => {
    if (obj[key]) {
      obj[key] = new Date(obj[key])
    }
  })

  return obj
}

/**
 * Detects if a username is likely a bot based on common patterns
 */
export function isBot (username: string): boolean {
  if (!username) return false

  const lowerUsername = username.toLowerCase()

  // Common bot patterns
  const botPatterns = [
    /\[bot\]$/i, // GitHub bot convention: "dependabot[bot]"
    /-bot$/i, // Ends with -bot
    /^bot-/i, // Starts with bot-
    /^dependabot/i,
    /^renovate/i,
    /^github-actions/i,
    /^codecov/i,
    /^coveralls/i,
    /^snyk/i,
    /^greenkeeper/i,
    /^imgbot/i,
    /^stale/i,
    /^netlify/i,
    /^vercel/i,
    /^allcontributors/i,
    /^pre-commit-ci/i,
    /^prettier/i,
    /^eslint/i
  ]

  return botPatterns.some(pattern => pattern.test(lowerUsername))
}

function getOS () {
  const userAgent = window.navigator.userAgent
  let os = 'Unknown OS'

  if (userAgent.indexOf('Win') !== -1) os = 'Windows'
  else if (userAgent.indexOf('Mac') !== -1) os = 'MacOS'
  else if (userAgent.indexOf('Linux') !== -1) os = 'Linux'

  return os
}

function getModifier (modifier: string) {
  if (modifier === 'ctrl') {
    return getOS() === 'MacOS' ? '⌘' : 'Ctrl'
  }

  if (modifier === 'cmd') {
    return getOS() === 'MacOS' ? '⌘' : 'Cmd'
  }

  return modifier
}

export function osShortcut (modifier: string, key: string) {
  const modifierText = getModifier(modifier)
  return `${modifierText} + ${key.toUpperCase()}`
}

export function getTimeAgo (d: Date | null | string): string {
  if (!d) {
    return 'recently'
  }

  const date = d instanceof Date ? d : new Date(d)

  const now = DateTime.now()

  const t = DateTime.fromJSDate(date)

  const diffSeconds = now.toSeconds() - t.toSeconds()

  const hours = Math.floor(diffSeconds / 3600)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ago`
  }
  if (hours > 0) {
    return `${hours}h ago`
  }

  return 'recently'
}

export function isSelfHostedMode () {
  return import.meta.env.VITE_DEPLOYMENT_MODE === 'self_hosted'
}