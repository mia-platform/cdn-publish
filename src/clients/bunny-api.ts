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
import type { CDN } from '../cdn'
import MysteryBoxError from '../error.js'
import type { Logger } from '../logger'

import { createHttpClient } from './http-client.js'

export interface PullZoneMeta {
  Id: number
  Name: string
}

export interface PullZonePurgeCacheResponse {
  id:number
  status: number
}

export class FailedPurgeCache extends MysteryBoxError {
  response!: PullZonePurgeCacheResponse
}

interface BunnyApiClient {
  pullZone: {
    /**
     * returns the list of all aviable pull zones
     * @param search a query string used to filter the results
     * @returns a list of metadata describing pull zones. When there is
     * no pull zone it returns an empty list without failing
     */
    list(search?: string): Promise<PullZoneMeta[]>
    /**
     * purge a specific pullzone
     * @param id the pullzone id
     * @returns
     */
    purgeCache(id: number): Promise<PullZonePurgeCacheResponse | FailedPurgeCache>
  }
}

const creatBunnyApiClient = (cdn: CDN, _logger: Logger): BunnyApiClient => {
  const { baseURL: { href: baseURL } } = cdn
  const httpClient = createHttpClient({
    baseURL,
    headers: {
      AccessKey: cdn.accessKey,
    },
  })


  const list = async (search?: string) => {
    const queryParams = new URLSearchParams({})
    if (search) {
      queryParams.set('search', search)
    }

    return httpClient.get<PullZoneMeta[]>(
      `/pullzone?${queryParams.toString()}`,
      {
        headers: { Accept: 'application/json' },
      }
    )
      .then(({ data }) => data)
  }

  const purgeCache = async (id: number) => httpClient.post(
    `/pullzone/${id}/purgeCache`,
    undefined,
    {
      headers: { Accept: 'application/json' },
    }
  )
    .then(({ status }) => ({ id, status }))
    .catch((error: FailedPurgeCache) => {
      const { status } = error.cause as Response

      error.response = { id, status }

      return Promise.reject(error)
    })

  return {
    pullZone: {
      list,
      purgeCache,
    },
  }
}

export type { BunnyApiClient }
export { creatBunnyApiClient }
