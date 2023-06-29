import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'
import type { SinonSandbox } from 'sinon'
import { createSandbox } from 'sinon'
import sinonChai from 'sinon-chai'

import type { PullZoneMeta } from '../../../src/clients/bunny-api.js'
import { createCommand } from '../../../src/command.js'
import { accessKey, bunny } from '../../server.js'
import { buildCommandArguments, cliErrorMissingArgument, cliErrorRequiredOption, cliErrorUnknownOption, loggerStub } from '../../utils.js'

interface Context extends MochaContext {
    currentTest?: MochaContext['currentTest'] & {sandbox?: SinonSandbox}
    test?: MochaContext['test'] & {sandbox?: SinonSandbox}
  }

use(chaiAsPromised)
use(sinonChai)

const pullzoneMock: PullZoneMeta[] = [
  { Id: 1, Name: 'bar' },
  { Id: 2, Name: 'foo' },
]

describe('pullzone list', () => {
  const baseCommand = ['pullzone', 'list']
  const baseArgs = ['-k', accessKey]

  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
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

    it('-s, --search <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--searcht', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--searcht', '--search'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-s']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-s, --search <string>'))
    })
  })
})

describe('pullzone purge', () => {
  const baseCommand = ['pullzone', 'purge']
  const baseArgs = ['-k', accessKey]

  beforeEach(function (this: Context) {
    if (this.currentTest) {
      this.currentTest.sandbox = createSandbox()
    }
  })

  afterEach(function (this: Context) {
    this.currentTest?.sandbox?.restore()
  })

  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
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

    it('-z, --zone <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--zonet', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--zonet', '--zone'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-z']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-z, --zone <string>'))
    })
  })

  describe('without arguments', () => {
    it('should purge all pull zones', async function (this: Context) {
      if (this.test?.sandbox === undefined) {
        throw new TypeError('Cannot find sandbox')
      }

      let postApiCall = 0
      let getApiCall = 0
      this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
        const { method } = config ?? {}
        const { pathname, search } = url as URL
        if (method === 'GET') {
          expect(pathname).to.be.equal('/pullzone')
          expect(search).to.be.equal('')
          expect(method).to.be.equal('GET')
          getApiCall += 1
          return new Promise((res) =>
            res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
          )
        }

        if (method === 'POST') {
          postApiCall += 1
          const pullZoneId = postApiCall
          expect(pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(search).to.be.equal('')
          expect(method).to.be.equal('POST')
          return new Promise((res) =>
            res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
          )
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
      })

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      expect(getApiCall).to.be.equal(1)
      expect(postApiCall).to.be.equal(2)
    })

    it('should not crash if one zone fails', async function (this: Context) {
      if (this.test?.sandbox === undefined) {
        throw new TypeError('Cannot find sandbox')
      }

      let postApiCall = 0
      let getApiCall = 0
      this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
        const { method } = config ?? {}
        const { pathname, search } = url as URL
        if (method === 'GET') {
          expect(pathname).to.be.equal('/pullzone')
          expect(search).to.be.equal('')
          expect(method).to.be.equal('GET')
          getApiCall += 1
          return new Promise((res) =>
            res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
          )
        }

        if (method === 'POST') {
          postApiCall += 1
          const pullZoneId = postApiCall
          expect(pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(search).to.be.equal('')
          expect(method).to.be.equal('POST')
          const responseInit = pullZoneId === 1
            ? { headers: bunny.headers204, status: 204 }
            : { headers: bunny.headers401, status: 401 }
          return new Promise((res) =>
            res(new Response(undefined, responseInit))
          )
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
      })

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      expect(getApiCall).to.be.equal(1)
      expect(postApiCall).to.be.equal(2)
    })
  })

  describe('with --zone', () => {
    it('should purge only the specifed zone', async function (this: Context) {
      if (this.test?.sandbox === undefined) {
        throw new TypeError('Cannot find sandbox')
      }

      const pullZoneId = '123'
      let apiCall = 0
      this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
        const { method } = config ?? {}
        const { pathname, search } = url as URL
        if (method === 'POST') {
          expect(pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(search).to.be.equal('')
          expect(method).to.be.equal('POST')
          apiCall += 1
          return new Promise((res) =>
            res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
          )
        }
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
      })

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-z', pullZoneId]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      expect(apiCall).to.be.equal(1)
    })
  })
})


