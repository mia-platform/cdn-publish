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