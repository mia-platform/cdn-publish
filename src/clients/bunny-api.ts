import type { CDN } from '../cdn'
import type { Logger } from '../logger'

import { createHttpClient } from './http-client.js'

export interface PullZoneMeta {
  Id: number
  Name: string
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


  return {
    pullZone: {
      list,
    },
  }
}

export type { BunnyApiClient }
export { creatBunnyApiClient }
