import { createCdnContext } from '../cdn.js'
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


  return Promise.all(idZones.map((id) => client.pullZone.purgeCache(id)))
    .then((responses) => {
      logger.table(responses
        .map(({ id, status }) => ({ idZone: id, purged: `${status === 204 ? 'Ok' : 'Error'} (${status})` }))
      )
    })
}

export type { Config }
export default { list, purgeCache }
