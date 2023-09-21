/*!
  Copyright 2023 Mia srl

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import crypto from 'crypto'
import fs from 'fs'
import { basename } from 'path'

import { createCdnContext } from '../cdn.js'
import { createBunnyEdgeStorageClient } from '../clients/bunny-edge-storage.js'
import { Error, thrower } from '../error.js'
import { getFiles } from '../glob.js'
import type { AbsPath, Config, LoadingContext, RelPath } from '../types'

const sha256 = (content: Buffer) => crypto
  .createHash('sha256')
  .update(content)
  .digest('hex')

const isNotEmpty = <T extends string>(input: T[]): input is [T, ...T[]] =>
  typeof input[0] === 'string'

const makeLoader = (file: string, shouldCalcChecksum: boolean) => async () => {
  const buffer = await fs.promises.readFile(file)
  return shouldCalcChecksum
    ? {
      buffer,
      checksum: sha256(buffer),
    }
    : buffer
}

const getLoaders = (workingDir: AbsPath, files: Set<AbsPath>, shouldUseChecksum: boolean) => {
  const arrayOfFiles = Array.from(files.values())
  if (!isNotEmpty(arrayOfFiles)) {
    return thrower(Error.NothingToDo, 'No file selected to PUT')(undefined)
  }

  const mapper = (file: AbsPath): LoadingContext => ({
    absolutePath: file,
    loader: makeLoader(file, shouldUseChecksum),
    pathname: workingDir === '/' ? `./${basename(file)}` : `.${file.substring(workingDir.length)}` as RelPath,
  })

  const [first, ...rest] = arrayOfFiles
  return [
    mapper(first),
    ...rest.map(mapper),
  ] as [LoadingContext, ...LoadingContext[]]
}

interface Options {
  baseUrl: string
  batchSize: number
  checksum?: boolean
  dest: RelPath
  storageAccessKey: string
  storageZoneName: string
}

async function upload(this: Config, matchers: string[], opts: Options) {
  const { workingDir, logger } = this
  const {
    storageAccessKey,
    checksum: shouldUseChecksum = false,
    dest,
    baseUrl: server,
    storageZoneName,
    batchSize,
  } = opts
  const cdn = createCdnContext(storageAccessKey, {
    server,
    storageZoneName,
  })
  const client = createBunnyEdgeStorageClient(cdn, logger)
  const isSemver = false

  if (matchers.length <= 0) {
    thrower(
      Error.NoFiles,
      `There are no files/matcher in args`
    )(undefined)
  }

  const files = matchers.reduce((acc, matcher) => {
    getFiles(workingDir, [matcher], false)
      .forEach((file) => { acc.add(file) })

    return acc
  }, new Set<AbsPath>())

  const loadingContexts = getLoaders(workingDir, files, shouldUseChecksum)

  return client.put(
    dest,
    loadingContexts,
    isSemver,
    batchSize
  ).then(() => {
    logger.info(`Storage: ${cdn.baseURL.href}`)
    logger.info(`Path: ${dest}`)
  })
}

export type { Config }
export default upload
