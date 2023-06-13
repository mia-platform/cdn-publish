import { Error, thrower } from './error.js'
import type { RelPath } from './types.js'


interface CDN {
  readonly accessKey: string
  readonly baseURL: URL
  readonly buildUrl: (scope: RelPath, ...filepath: RelPath[]) => URL
  readonly server: string
  readonly storageZoneName: string
}

const defaultConfig = {
  server: 'https://storage.bunnycdn.com',
  storageZoneName: 'mia-platform-test',
}

function endsWithSlash(input: RelPath): `./${string}/`
function endsWithSlash(input: string): `${string}/`
function endsWithSlash(input: string): string {
  return (input.endsWith('/') ? input as `./${string}/` : `${input}/`)
}

const slashWrapper = (input: string) => {
  const output = input.startsWith('/') ? input : `/${input}`
  return output.endsWith('/') ? output : `${output}/`
}

const createCdnContext = (accessKey: string, options: Partial<Omit<CDN, 'url'>> = {}): CDN => {
  const config = {
    ...defaultConfig,
    ...options,
  }

  try {
    const baseURL = new URL(slashWrapper(config.storageZoneName), config.server)
    const { origin, pathname } = baseURL
    const buildSegment = (segment: RelPath, base: URL = baseURL) => new URL(segment, endsWithSlash(base.href))

    return {
      accessKey,
      baseURL,
      buildUrl: (scope, ...filepath) => {
        const first = buildSegment(scope)
        return filepath.reduce((url, nextSegment) => buildSegment(nextSegment, url), first)
      },
      server: origin,
      storageZoneName: pathname,
    }
  } catch (err) {
    return thrower(Error.InvalidURL, 'Invalid URL')(err)
  }
}

export type { CDN }
export { createCdnContext, endsWithSlash }
