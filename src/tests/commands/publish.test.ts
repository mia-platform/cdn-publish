import { mock } from 'node:test'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import type { Context as MochaContext } from 'mocha'
import { beforeEach, describe, it, afterEach } from 'mocha'

import { createBunnyClient } from '../../bunny-client.js'
import { createCdnContext } from '../../cdn.js'
import { absoluteResolve } from '../../glob.js'
import publish from '../../publish.js'
import type { RelPath } from '../../types.js'
import { testPackagesNamespace } from '../consts.js'

import { accessKey, createServer } from './../server.js'
import type { Temp } from './../utils.js'
import { createPackageJson, createResources, createTmpDir, loggerStub } from './../utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

interface PackageCtx {
    files: string[]
    packageName: string
    resources: string[]
    version: string
}

use(chaiAsPromised)

const PACKAGE_JSON_FILENAME = 'package.json'

async function createTemporaryRepository({
  files = ['index.html', 'package.json'],
  packageName = `${testPackagesNamespace}/mystery-box`,
  resources = ['index.html'],
  version = '0.0.1',
} = {}) {
  if (!packageName.startsWith(testPackagesNamespace)) {
    throw new Error(`During tests only package in ${testPackagesNamespace} are supported`)
  }

  const packageJsonFile = JSON.stringify(
    createPackageJson(
      packageName,
      version,
      files
    )
  )

  const createdFiles = {
    ...createResources(resources),
    [PACKAGE_JSON_FILENAME]: packageJsonFile,
  }
  const repositoryCtx: Temp = await createTmpDir(createdFiles)

  const packageCtx: PackageCtx = {
    files,
    packageName,
    resources,
    version,
  }

  return {
    packageCtx,
    repositoryCtx,
  }
}

function createCdnPath(packageCtx: PackageCtx): RelPath {
  const { packageName, version } = packageCtx
  const packageNameWithoutAt = packageName.startsWith('@')
    ? packageName.slice(1)
    : packageName
  return `./${packageNameWithoutAt}/${version}`
}

describe('publish project', () => {
  const cliCconfig = { global, logger: loggerStub, workingDir: absoluteResolve('.') }
  const cdn = createCdnContext(accessKey, {})
  const client = createBunnyClient(cdn, loggerStub)

  beforeEach(async function (this: Context) {
    mock.restoreAll()
    this.cleanup = await createServer()
  })

  afterEach(async function (this: Context) {
    await this.cleanup?.()
  })

  describe('without arguments', () => {
    it('should push empty senver package', async () => {
      const { packageCtx, repositoryCtx } = await createTemporaryRepository()
      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath(packageCtx)
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()
    })

    it('should throw error if no files found package', async () => {
      const { repositoryCtx } = await createTemporaryRepository({ files: ['notExistingFile.js'] })

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.rejectedWith('No file selected to PUT')

      await repositoryCtx.cleanup()
    })

    it('should throw error if pushed server package it is already present', async () => {
      const { packageCtx, repositoryCtx } = await createTemporaryRepository()

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath(packageCtx)
      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.rejectedWith(`Folder ${cdnRepositoryPath} is not empty and scoped with semver versioning`)

      await repositoryCtx.cleanup()
    })
  })

  describe('with --override-version', () => {
    it('should push empty senver package', async () => {
      const { packageCtx, repositoryCtx } = await createTemporaryRepository()

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        overrideVersion: true,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath(packageCtx)
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()
    })

    it('should override a senver package', async () => {
      const version = '1.0.0'
      const { packageCtx, repositoryCtx } = await createTemporaryRepository({
        version,
      })

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        overrideVersion: true,
        project: absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath(packageCtx)
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()


      const newFiles = ['a.js', 'b.js', 'c.js']
      const { repositoryCtx: repositoryCtxUpdate } = await createTemporaryRepository({
        files: newFiles,
        resources: newFiles,
        version,
      })

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        overrideVersion: true,
        project: absoluteResolve(repositoryCtxUpdate.name, PACKAGE_JSON_FILENAME),
      })).to.be.eventually.fulfilled

      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(3)

      await repositoryCtxUpdate.cleanup()
    })
  })
})

