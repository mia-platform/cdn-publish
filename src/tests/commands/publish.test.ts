import { mock } from 'node:test'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import type { Context as MochaContext } from 'mocha'
import { before, beforeEach, describe, it, after, afterEach } from 'mocha'

import { absoluteResolve } from '../../glob.js'
import list from '../../list.js'
import publish from '../../publish.js'


import { accessKey, createServer } from './../server.js'
import type { Temp } from './../utils.js'
import { createPackageJson, createResources, createTmpDir, loggerStub } from './../utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

use(chaiAsPromised)

describe('publish project no args', () => {
  const cliCconfig = { global, logger: loggerStub, workingDir: absoluteResolve('.') }
  const PACKAGE_JSON_FILENAME = 'package.json'
  let tmpRepositoryCtx: Temp

  beforeEach(async function (this: Context) {
    mock.restoreAll()
    this.cleanup = await createServer()

    const resource = 'index.html'
    const fakePackageName = '@__test/mystery-box'

    const files = ['index.html', 'package.json']
    const version = '0.0.1'
    const rawFiles = createResources([resource])
    const packageJsonFile = JSON.stringify(createPackageJson(fakePackageName, version, files))
    tmpRepositoryCtx = await createTmpDir({ ...rawFiles, [PACKAGE_JSON_FILENAME]: packageJsonFile })
  })

  afterEach(async function (this: Context) {
    await this.cleanup?.()
    await tmpRepositoryCtx.cleanup()
  })

  describe('without arguments', () => {
    it('should push empty senver package', async () => {
      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(tmpRepositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.fulfilled

      await expect(list.bind(cliCconfig)('./__test/mystery-box/0.0.1', {
        accessKey,
      })).to.eventually.be.fulfilled.and.to.have.length(2)
    })
  })

  describe('--override-version', () => {
    it('should push empty senver package', async () => {
      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        overrideVersion: true,
        project: absoluteResolve(tmpRepositoryCtx.name, PACKAGE_JSON_FILENAME),
      })).to.be.fulfilled

      await expect(list.bind(cliCconfig)('./__test/mystery-box/0.0.1', {
        accessKey,
      })).to.eventually.be.fulfilled.and.to.have.length(2)
    })
  })
})

