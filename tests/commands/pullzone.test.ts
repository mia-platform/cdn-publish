import { mock } from 'node:test'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { beforeEach, describe, it } from 'mocha'

import type { PullZoneMeta } from '../../src/clients/bunny-api.js'
import { createCommand } from '../../src/command.js'
import { accessKey, bunny } from '../server.js'
import { buildCommandArguments, cliErrorMissingArgument, cliErrorRequiredOption, cliErrorUnknownOption, loggerStub } from '../utils.js'


use(chaiAsPromised)

const pullzoneMock: PullZoneMeta[] = [
  { Id: 1, Name: 'bar' },
  { Id: 2, Name: 'foo' },
]

describe('pullzone list', () => {
  const baseCommand = ['pullzone', 'list']
  const baseArgs = ['-k', accessKey]

  beforeEach(() => {
    mock.restoreAll()
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
    it('should purge all pull zones', async () => {
      let postApiCall = 0
      let getApiCall = 0
      mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
        if (method === 'GET') {
          expect(url.pathname).to.be.equal('/pullzone')
          expect(url.search).to.be.equal('')
          expect(method).to.be.equal('GET')
          getApiCall += 1
          return new Promise((res) =>
            res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
          )
        }

        if (method === 'POST') {
          postApiCall += 1
          const pullZoneId = postApiCall
          expect(url.pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(url.search).to.be.equal('')
          expect(method).to.be.equal('POST')
          return new Promise((res) =>
            res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
          )
        }
      })

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs]),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      expect(getApiCall).to.be.equal(1)
      expect(postApiCall).to.be.equal(2)
    })

    it('should not crash if one zone fails', async () => {
      let postApiCall = 0
      let getApiCall = 0
      mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
        if (method === 'GET') {
          expect(url.pathname).to.be.equal('/pullzone')
          expect(url.search).to.be.equal('')
          expect(method).to.be.equal('GET')
          getApiCall += 1
          return new Promise((res) =>
            res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
          )
        }

        if (method === 'POST') {
          postApiCall += 1
          const pullZoneId = postApiCall
          expect(url.pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(url.search).to.be.equal('')
          expect(method).to.be.equal('POST')
          const responseInit = pullZoneId === 1
            ? { headers: bunny.headers204, status: 204 }
            : { headers: bunny.headers401, status: 401 }
          return new Promise((res) =>
            res(new Response(undefined, responseInit))
          )
        }
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
    it('should purge only the specifed zone', async () => {
      const pullZoneId = '123'
      let apiCall = 0
      mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
        if (method === 'POST') {
          expect(url.pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
          expect(url.search).to.be.equal('')
          expect(method).to.be.equal('POST')
          apiCall += 1
          return new Promise((res) =>
            res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
          )
        }
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


