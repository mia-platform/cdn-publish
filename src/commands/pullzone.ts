import { createCdnContext } from '../cdn.js'
import { creatBunnyApiClient } from '../clients/bunny-api.js'
import type { Config } from '../types'

interface OptionsList {
  accessKey: string
  search: string
}

async function list(this: Config, opts: OptionsList) {
  const { logger } = this
  const { accessKey, search } = opts
  const cdn = createCdnContext(accessKey, {
    server: 'https://api.bunny.net/',
    storageZoneName: '',
  })

  const client = creatBunnyApiClient(cdn, logger)

  return client.pullZone.list(search)
    .then((zoneList) => {
      logger.table(zoneList.map(({ Id, Name }) => ({ id: Id, name: Name })))
    })
}

interface OptionsPurgeCache {
  accessKey: string
  zone: number
}

async function purgeCache(this: Config, opts: OptionsPurgeCache) {
  const { logger } = this
  const { accessKey, zone } = opts
  const cdn = createCdnContext(accessKey, {
    server: 'https://api.bunny.net/',
    storageZoneName: '',
  })

  const client = creatBunnyApiClient(cdn, logger)
  const idZones = zone ? [zone] : (await client.pullZone.list()).map(({ Id }) => Id)


  return Promise.all(idZones.map((id) => client.pullZone.purgeCache(id)))
    .then((statusCodes) => {
      const purgeResults = statusCodes.reduce<Record<string, number>>((counter, code) => {
        if (!counter[code]) { counter[code] = 0 }
        counter[code] += 1
        return counter
      }, {})
      logger.table(purgeResults)
    })
}

export type { Config }
export default { list, purgeCache }
