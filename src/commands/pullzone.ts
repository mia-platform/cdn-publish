import { createCdnContext } from '../cdn.js'
import { creatBunnyApiClient } from '../clients/bunny-api.js'
import type { Config } from '../types'

interface Options {
  accessKey: string
  search: string
}

async function list(this: Config, opts: Options) {
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

export type { Config }
export default list
