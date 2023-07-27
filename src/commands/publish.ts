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

import type { IPackageJson } from '@ts-type/package-dts'
import semverRegex from 'semver-regex'

import { createCdnContext } from '../cdn.js'
import { createBunnyEdgeStorageClient } from '../clients/bunny-edge-storage.js'
import { Error, reject, thrower } from '../error.js'
import { absoluteResolve, getFiles, absoluteWorkingDir } from '../glob.js'
import type { AbsPath, Config, LoadingContext, RelPath } from '../types'

interface Options {
  baseUrl: string
  batchSize: number
  checksum?: boolean
  overrideVersion?: string | boolean
  project: string
  scope?: string
  storageAccessKey: string
  storageZoneName: string
}

interface PackageJsonContext {
  content: IPackageJson
  workingDir: AbsPath
}


const isNotEmpty = <T extends string>(input: T[]): input is [T, ...T[]] =>
  typeof input[0] === 'string'

const getPackageJson = async (workingDir: AbsPath, project: string) => {
  const path = absoluteResolve(workingDir, project)
  const textContent = await fs.promises.readFile(path, 'utf-8')
    .catch((err) => reject(Error.ReadFile, `Cannot read ${path}`, err))

  const packageJsonWorkingDir = absoluteWorkingDir(path)

  try {
    const content = JSON.parse(textContent) as IPackageJson
    return { content, path, workingDir: packageJsonWorkingDir } as PackageJsonContext
  } catch (err) {
    return reject(
      Error.JSONParseString,
      `Something went wrong while JSON-parsing ${path}`,
      err
    )
  }
}

const getDefaultPackageJson = (): PackageJsonContext => ({
  content: {
    name: '',
    version: '',

  },
  workingDir: '/',
})

const getMatchers = (ctx: PackageJsonContext) => {
  const { content: { files = [] } } = ctx
  if (!isNotEmpty(files)) {
    thrower(
      Error.NoPackageJsonFiles,
      `There are no files/matchers listed in the package.json file ${ctx.workingDir}`
    )(undefined)
  }

  return files as [string, ...string[]]
}

const getScope = (input: string | undefined, ctx: PackageJsonContext) => {
  if (input !== undefined) {
    return input.split('/')
      .filter(Boolean)
      .filter((seg) => !['.', '..'].includes(seg))
      .join('/')
  }

  const { content: { name } } = ctx
  const {
    scope, packageName,
  } = name?.match(/^@(?<scope>[^/]+)\/(?<packageName>.+)/)?.groups
    ?? { packageName: undefined, scope: undefined }
  const nameScope = scope && packageName && `${scope}/${packageName}`
  return nameScope
    ?? thrower(
      Error.NoPackageJsonNameScope,
      'No scope was matched in package.json `name` field or in --scope'
    )(undefined)
}

const getVersion = (input: string | boolean | undefined, ctx: PackageJsonContext) => {
  if (input !== undefined && typeof input === 'string') {
    return { isSemver: semverRegex().test(input), version: input }
  }

  const { content: { version } } = ctx
  if (version !== undefined) {
    return {
      isSemver: semverRegex().test(version),
      version,
    }
  }
}

const getPrefix = (scope: string, version: string | undefined): RelPath => {
  if (version === undefined) {
    return `./${scope}`
  }

  return `./${scope}/${version.split('/').filter(Boolean).join('/')}`
}

const sha256 = (content: Buffer) => crypto
  .createHash('sha256')
  .update(content)
  .digest('hex')


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

async function publish(this: Config, opts: Options) {
  const { workingDir, logger } = this
  const {
    storageAccessKey,
    checksum: shouldUseChecksum = false,
    project,
    scope: inputScope,
    overrideVersion,
    baseUrl: server,
    storageZoneName,
    batchSize,
  } = opts
  const cdn = createCdnContext(storageAccessKey, {
    server,
    storageZoneName,
  })

  const pkgContext = await getPackageJson(workingDir, project)
    .catch(() => getDefaultPackageJson())

  const allMatchers = getMatchers(pkgContext)
  const files = getFiles(pkgContext.workingDir, allMatchers)
  const loadingContexts = getLoaders(pkgContext.workingDir, files, shouldUseChecksum)
  const scope = getScope(inputScope, pkgContext)
  const { isSemver, version } = getVersion(overrideVersion, pkgContext) ?? {}

  const client = createBunnyEdgeStorageClient(cdn, logger)

  const rootDir = getPrefix(scope, version)

  if (overrideVersion !== undefined) {
    const filename = undefined
    const avoidThrowing = true
    await client.delete(rootDir, filename, avoidThrowing)
  }

  return client.put(
    rootDir,
    loadingContexts,
    isSemver,
    batchSize
  ).then(() => {
    const { name } = pkgContext.content
    logger.info(`Package: ${name ?? ''}:${version ?? ''}`)
    logger.info(`Storage: ${cdn.baseURL.href}`)
    logger.info(`Path: ${rootDir}`)
  })
}

export type { Config }
export default publish
