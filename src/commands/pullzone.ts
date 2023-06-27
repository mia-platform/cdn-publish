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
import type { FailedPurgeCache, PullZonePurgeCacheResponse } from '../clients/bunny-api.js'
import { creatBunnyApiClient } from '../clients/bunny-api.js'
import type { Config } from '../types'

interface PullzoneOptions {
  accessKey: string
  baseUrl: string
}

interface OptionsList extends PullzoneOptions{
  search?: string
}

async function list(this: Config, opts: OptionsList) {
  const { logger } = this
  const { accessKey, baseUrl: server, search } = opts
  const cdn = createCdnContext(accessKey, {
    server,
    storageZoneName: '',
  })

  const client = creatBunnyApiClient(cdn, logger)

  return client.pullZone.list(search)
    .then((zoneList) => {
      logger.table(zoneList.map(({ Id, Name }) => ({ id: Id, name: Name })))
    })
}

interface OptionsPurgeCache extends PullzoneOptions {
  zone?: number
}

async function purgeCache(this: Config, opts: OptionsPurgeCache) {
  const { logger } = this
  const { accessKey, baseUrl: server, zone } = opts
  const cdn = createCdnContext(accessKey, {
    server,
    storageZoneName: '',
  })

  const client = creatBunnyApiClient(cdn, logger)
  const idZones = zone ? [zone] : (await client.pullZone.list()).map(({ Id }) => Id)


  return Promise.allSettled(idZones.map((id) => client.pullZone.purgeCache(id)))
    .then((responses) => {
      logger.table(responses
        .map((res) => {
          if (res.status === 'rejected') {
            const { id, status } = (res.reason as FailedPurgeCache).response
            return { id, status }
          }
          const { id, status } = res.value as PullZonePurgeCacheResponse
          return { id, status }
        })
        .map(({ id, status }) => ({ idZone: id, purged: `${status === 204 ? 'Ok' : 'Error'} (${status})` }))
      )
    })
}

export type { Config }
export default { list, purgeCache }
