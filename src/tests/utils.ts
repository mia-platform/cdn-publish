import crypto from 'crypto'
import fs from 'fs/promises'
import path, { dirname } from 'path'

import logger from 'node-color-log'
import type { AffixOptions, Stats } from 'temp'
import temp from 'temp'

interface Temp {
 cleanup: () => Promise<void | Stats>
 name: `/${string}`
}

temp.track()

const createTmpDir = async (resources: Record<string, string | Buffer>, opts?: string | AffixOptions): Promise<Temp> => {
  const dirPath = await temp.mkdir(opts)
  await Promise.all(Object.entries(resources).map(async ([filepath, buffer]) => {
    const inputPath = path.join(dirPath, filepath)
    await fs.mkdir(dirname(inputPath), { recursive: true })
    await fs.writeFile(inputPath, buffer)
  }))

  return { cleanup: () => temp.cleanup(), name: dirPath as `/${string}` }
}

const createResources = (paths: string[]) =>
  paths.reduce<Record<string, string>>((obj, key) => {
    obj[key] = crypto.randomUUID()
    return obj
  }, {})

const noop = () => { /* noop */ }

const loggerStub = Object.assign(logger, {
  table: (tabularData?: unknown, properties?: string[]) =>
    console.table(tabularData, properties),
})

const sha256 = (content: Buffer) => crypto
  .createHash('sha256')
  .update(content)
  .digest('hex')

const wait = (timeout = 1000) => async <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), timeout))

export type { Temp }
export { createTmpDir, createResources, noop, loggerStub, sha256, wait }
