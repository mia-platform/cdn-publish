import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'

import { createCdnContext } from '../../../src/cdn.js'
import { createBunnyEdgeStorageClient } from '../../../src/clients/bunny-edge-storage.js'
import { createCommand } from '../../../src/command.js'
import { absoluteResolve } from '../../../src/glob.js'
import type { RelPath } from '../../../src/types.js'
import { PACKAGE_JSON_FILENAME } from '../../consts.js'
import { storageAccessKey, storageZoneName, serverStorageBaseUrl, createServer } from '../../server.js'
import { buildCommandArguments, cliErrorMissingArgument, cliErrorRequiredOption, cliErrorUnknownOption, createE2EtestContext, loggerStub } from '../../utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

use(chaiAsPromised)

describe('publish project', () => {
  const cdnCtx = createCdnContext(storageAccessKey, {
    server: serverStorageBaseUrl,
    storageZoneName,
  })
  const client = createBunnyEdgeStorageClient(cdnCtx, loggerStub)
  const baseCommand = ['publish']
  const baseArgs = ['-k', storageAccessKey, '-s', storageZoneName]
  const { createPackageCtx } = createE2EtestContext()

  beforeEach(async function (this: Context) {
    this.cleanup = await createServer()
  })

  afterEach(async function (this: Context) {
    await this.cleanup?.()
  })

  describe('should have those arguments', () => {
    it('-k, --storage-access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --storage-access-key <string>'))
    })

    it('-s, --storage-zone-name <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', storageAccessKey]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-s, --storage-zone-name <string>'))
    })

    it('-u, --base-url <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--base-urlt', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--base-urlt', '--base-url'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-u']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-u, --base-url <string>'))
    })

    it('-p, --project <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--projectt', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--projectt', '--project'))
    })

    it('--scope <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--scopee', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--scopee', '--scope'))
    })

    it('-b, --batch-size <number>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--batch-sizet', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--batch-sizet', '--batch-size'))
    })

    it('--override-version [string]', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--override-versionn']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--override-versionn', '--override-version'))
    })

    it('--checksum [string]', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--checksumm']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--checksumm', '--checksum'))
    })
  })

  describe('without arguments', () => {
    it('should push empty senver package', async () => {
      const { repositoryCtx, createCdnPath } = await createPackageCtx()
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath()
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()
    })

    it('should throw error if no files found package', async () => {
      const { repositoryCtx } = await createPackageCtx({ files: ['notExistingFile.js'] })
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith('No file selected to PUT')

      await repositoryCtx.cleanup()
    })

    it('should throw error if pushed server package it is already present', async () => {
      const { repositoryCtx, createCdnPath } = await createPackageCtx({ version: '2.0.0' })
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)
      const cdnRepositoryPath = createCdnPath()

      // Sometimes it happens that the cdn doesn't correctly clear the folder, it is a bunnyCdn bug
      await client.delete(cdnRepositoryPath, './package.json', true)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(`Folder ${cdnRepositoryPath} is not empty and scoped with semver versioning`)

      await repositoryCtx.cleanup()
    })
  })

  describe('with --override-version', () => {
    it('should push empty senver package', async () => {
      const { repositoryCtx, createCdnPath } = await createPackageCtx()
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath, '--override-version']),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath()
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()
    })

    it('should override a senver package', async () => {
      const version = '3.0.0'
      const { repositoryCtx, createCdnPath } = await createPackageCtx({ version })
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath, '--override-version']),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath()
      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()


      const newFiles = ['a.js', 'b.js', 'c.js']
      const { repositoryCtx: repositoryCtxUpdate } = await createPackageCtx({
        files: newFiles,
        resources: newFiles,
        version,
      })

      const projectPathUpdate = absoluteResolve(repositoryCtxUpdate.name, PACKAGE_JSON_FILENAME)
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPathUpdate, '--override-version']),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(3)

      await repositoryCtxUpdate.cleanup()
    })

    it('should push a custom senver tag', async () => {
      const { packageCtx, repositoryCtx, createCdnPath } = await createPackageCtx({ version: '4.0.0' })
      const projectPath = absoluteResolve(repositoryCtx.name, PACKAGE_JSON_FILENAME)
      const customVersion = 'latest'

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--project', projectPath, '--override-version', customVersion]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      const cdnRepositoryPath = createCdnPath()

      await expect(client.list(cdnRepositoryPath))
        .to.eventually.be.fulfilled.and.to.have.length(0)

      const cdnRepositoryPathCustomVer = cdnRepositoryPath.replace(packageCtx.version ?? '', customVersion) as RelPath
      await expect(client.list(cdnRepositoryPathCustomVer))
        .to.eventually.be.fulfilled.and.to.have.length(2)

      await repositoryCtx.cleanup()
    })
  })
})

