import { mock } from 'node:test'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import type { Context as MochaContext } from 'mocha'
import { before, describe, it, after } from 'mocha'

import { absoluteResolve } from '../../glob.js'
import list from '../../list.js'
import publish from '../../publish.js'


import { accessKey, createServer } from './../server.js'
import { createPackageJson, createResources, createTmpDir, loggerStub } from './../utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

use(chaiAsPromised)

describe('publish project no args', () => {
  const cliCconfig = { global, logger: loggerStub, workingDir: absoluteResolve('.') }

  before(async function (this: Context) {
    mock.restoreAll()
    this.cleanup = await createServer()
  })

  after(async function (this: Context) {
    return this.cleanup?.()
  })

  describe('without arguments', () => {
    it('should push empty senver package', async () => {
      const resource = 'index.html'
      const packageJson = 'package.json'
      const fakePackageName = '@__test/mystery-box'

      const files = ['index.html', 'package.json']
      const version = '0.0.1'
      const rawFiles = createResources([resource])
      const packageJsonFile = JSON.stringify(createPackageJson(fakePackageName, version, files))

      const tmpCtx = await createTmpDir({ ...rawFiles, [packageJson]: packageJsonFile })

      await expect(publish.bind(cliCconfig)([], {
        accessKey,
        project: absoluteResolve(tmpCtx.name, packageJson),
      })).to.be.fulfilled

      await expect(list.bind(cliCconfig)('./__test/mystery-box/0.0.1', {
        accessKey,
      })).to.eventually.be.fulfilled.and.to.have.length(2)

      await tmpCtx.cleanup()
    })
  })
})

