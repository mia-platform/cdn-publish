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
import { createCdnContext } from '../cdn.js'
import { createBunnyEdgeStorageClient } from '../clients/bunny-edge-storage.js'
import type { Config } from '../types.js'

interface Options {
  baseUrl: string
  storageAccessKey: string
  storageZoneName: string
}

const normalize = (input: string): `./${string}` => {
  let output = input
  if (input.startsWith('/')) {
    output = `.${input}`
  } else if (!input.startsWith('./')) {
    output = `./${input}`
  }

  return output.replace(/\/?$/, '') as `./${string}`
}

async function get(this: Config, file: string, opts: Options) {
  const { logger } = this
  const { storageAccessKey, baseUrl: server, storageZoneName } = opts
  const cdn = createCdnContext(storageAccessKey, {
    server,
    storageZoneName,
  })

  const client = createBunnyEdgeStorageClient(cdn, logger)

  return client.get(normalize(file))
    .then((fileContent) => {
      logger.log(fileContent)
    })
}

export type { Config }
export default get
