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
