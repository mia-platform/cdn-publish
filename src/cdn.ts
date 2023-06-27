/*!
  Copyright 2023 Mia srl

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import { Error, thrower } from './error.js'
import type { RelPath } from './types.js'

interface CDN {
  readonly accessKey: string
  readonly baseURL: URL
  readonly buildUrl: (scope: RelPath, ...filepath: RelPath[]) => URL
  readonly server: string
  readonly storageZoneName: string
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
    storageZoneName: '',
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
