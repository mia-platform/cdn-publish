import { createBunnyClient } from './bunny-client.js'
import { createCdnContext } from './cdn.js'
import type { Config } from './types'

interface Options {
  accessKey: string
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
  const { accessKey } = opts
  const cdn = createCdnContext(accessKey, {})

  const client = createBunnyClient(cdn, logger)

  const filelist = await client.list(normalize(dir))
  logger.table(filelist.map(({ Path, ObjectName, IsDirectory }) => ({ dir: Path, file: ObjectName, type: IsDirectory ? 'd' : 'f' })))

  return filelist
}

export type { Config }
export default list
