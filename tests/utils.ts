import crypto from 'crypto'
import fs from 'fs/promises'
import { dirname, join } from 'path'

import type IPackageJson from '@ts-type/package-dts'
import logger from 'node-color-log'
import type { AffixOptions, Stats } from 'temp'
import temp from 'temp'

import type { CDN } from '../src/cdn'
import { createBunnyEdgeStorageClient } from '../src/clients/bunny-edge-storage'
import type { AbsPath, RelPath } from '../src/types'

import { CDN_TEST_FOLDER, PACKAGE_JSON_FILENAME, PACKAGE_TEST_NAMESPACE } from './consts'

interface Temp {
 cleanup: () => Promise<void | Stats>
 name: `/${string}`
}

export interface IntegrationCtx {
  createCdnPath: () => RelPath
  packageCtx: IPackageJson
  repositoryCtx: Temp
}

temp.track()

const createTmpDir = async (resources: Record<string, string | Buffer>, opts?: string | AffixOptions): Promise<Temp> => {
  const dirPath = await temp.mkdir(opts)
  await Promise.all(Object.entries(resources).map(async ([filepath, buffer]) => {
    const inputPath = join(dirPath, filepath)
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
  error: () => ({}),
  info: () => ({}),
  log: () => ({}),
  table: (_tabularData?: unknown, _properties?: string[]) => ({}),
})

const sha256 = (content: Buffer) => crypto
  .createHash('sha256')
  .update(content)
  .digest('hex')

const wait = (timeout = 1000) => async <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), timeout))

const createPackageJson = (name: string, version: string, files: string[]) => {
  return {
    files,
    name,
    version,
  }
}

// This is needed because are the first 2 arguments (entrypoint, script)
// Could be empty for testing purposes
const buildCommandArguments = (args: string[]) => ['', '', ...args]

const cliErrorUnknownOption = (wrongCmd: string, rightCmd: string) =>
  `error: unknown option '${wrongCmd}'\n(Did you mean ${rightCmd}?)`

const cliErrorRequiredOption = (cmd: string) => `error: required option '${cmd}' not specified`

const cliErrorMissingArgument = (cmd: string) => `error: option '${cmd}' argument missing`

const createE2EtestContext = () => {
  const testUUID = crypto.randomUUID()
  const rootTestPath: RelPath = `./${CDN_TEST_FOLDER}/${testUUID}`

  const createE2EtestPath = (path?: AbsPath): RelPath => `${rootTestPath}${path ?? ''}`
  const clearE2EtestDirectory = async (cdnCtx: CDN) => {
    const client = createBunnyEdgeStorageClient(cdnCtx, loggerStub)
    return client.delete(rootTestPath, undefined, true)
  }

  const createPackageCtx = async ({
    files = ['index.html', 'package.json'],
    packageName = `e2e-test`,
    resources = ['index.html'],
    version = '0.0.1',
  } = {}): Promise<IntegrationCtx> => {
    const safePackageName = `${PACKAGE_TEST_NAMESPACE}/${testUUID}/${packageName}`
    if (!safePackageName.startsWith(PACKAGE_TEST_NAMESPACE)) {
      throw new Error(`During tests only packages must be in ${PACKAGE_TEST_NAMESPACE}!`)
    }
    const packageJsonFile = JSON.stringify(
      createPackageJson(
        safePackageName,
        version,
        files
      )
    )

    const createdFiles = {
      ...createResources(resources),
      [PACKAGE_JSON_FILENAME]: packageJsonFile,
    }
    const repositoryCtx: Temp = await createTmpDir(createdFiles)

    const createCdnPath = (): RelPath => `./${safePackageName.slice(1)}/${version}`

    const packageCtx: IPackageJson = {
      files,
      packageName: safePackageName,
      resources,
      version,
    }

    return {
      createCdnPath,
      packageCtx,
      repositoryCtx,
    }
  }

  return {
    clearE2EtestDirectory,
    createE2EtestPath,
    createPackageCtx,
    uuid: testUUID,
  }
}


export type { Temp }
export {
  createTmpDir,
  createResources,
  noop,
  loggerStub,
  sha256,
  wait,
  createPackageJson,
  buildCommandArguments,
  cliErrorUnknownOption,
  cliErrorRequiredOption,
  cliErrorMissingArgument,
  createE2EtestContext,
}
