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
import { join } from 'path'

import { createCdnContext } from '../cdn.js'
import { createBunnyEdgeStorageClient } from '../clients/bunny-edge-storage.js'
import type { Config } from '../types.js'
interface Options {
  avoidThrowing?: boolean
  baseUrl: string
  storageAccessKey: string
  storageZoneName: string
}

const normalize = (input: string): {dir: `./${string}/`; filename: `./${string}` | undefined} => {
  let output = input
  if (input.startsWith('/')) {
    output = `.${input}`
  } else if (!input.startsWith('./')) {
    output = `./${input}`
  }

  const groups = output.match(/^(?<dir>.*\/)(?<filename>[^/]+)?$/)?.groups ?? {}
  const dir = groups.dir as `./${string}/`
  let file = groups.filename as string | undefined
  if (file === '' || file === undefined) {
    file = undefined
  } else {
    file = `./${file}`
  }
  const filename = file as `./${string}` | undefined

  return { dir, filename }
}

async function deleteFn(this: Config, matcher: string, opts: Options) {
  const { logger } = this
  const {
    storageAccessKey,
    baseUrl: server,
    storageZoneName,
    avoidThrowing } = opts
  const cdn = createCdnContext(storageAccessKey, {
    server,
    storageZoneName,
  })

  const client = createBunnyEdgeStorageClient(cdn, logger)
  const { dir, filename } = normalize(matcher)

  return client.delete(dir, filename, avoidThrowing)
    .then(() => {
      logger.info(`Deleted: ./${join(dir, filename ?? './*')}`)
      logger.info(`Storage: ${cdn.baseURL.href}`)
    })
}

export type { Config }
export default deleteFn
