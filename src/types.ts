import type { ReadStream } from 'fs'

import type { Logger } from './logger'

type RelPath = `./${string}`

type AbsPath = `/${string}`

type Global = Pick<typeof globalThis, 'encodeURIComponent'>

interface Config {
  global: Global
  logger: Logger
  workingDir: AbsPath
}

type FileContext = ReadStream | {buffer: Buffer; checksum: string}

interface LoadingContext {
  absolutePath: AbsPath
  loader: () => Promise<FileContext>
  pathname: RelPath
}

export type { AbsPath, Config, FileContext, Global, LoadingContext, RelPath }
