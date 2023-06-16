import { createCdnContext } from '../cdn.js'
import { createBunnyEdgeStorageClient } from '../clients/bunny-edge-storage.js'
import type { Config } from '../types'

interface Options {
  baseUrl: string
  storageAccessKey: string
  storageZoneName: string
}

const normalize = (input: string): `./${string}/` => {
  let output = input
  if (input.startsWith('/')) {
    output = `.${input}`
  } else if (!input.startsWith('./')) {
    output = `./${input}`
  }

  return output.replace(/\/?$/, '/') as `./${string}/`
}

async function list(this: Config, dir: string, opts: Options) {
  const { logger } = this
  const { storageAccessKey, baseUrl: server, storageZoneName } = opts
  const cdn = createCdnContext(storageAccessKey, {
    server,
    storageZoneName,
  })

  const client = createBunnyEdgeStorageClient(cdn, logger)

  return client.list(normalize(dir))
    .then((filelist) => {
      logger.table(filelist.map(({ Path, ObjectName, IsDirectory }) => ({ dir: Path, file: ObjectName, type: IsDirectory ? 'd' : 'f' })))
    })
}

export type { Config }
export default list
