import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { describe, it } from 'mocha'

import { createCommand } from '../../src/command.js'
import { accessKey } from '../server.js'
import { buildCommandArguments, cliErrorRequiredOption, cliErrorUnknownOption } from '../utils.js'


use(chaiAsPromised)


describe('pullzone list', () => {
  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments(['pullzone', 'list']),
        global
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
    })

    it('-s, --search <string>', async () => {
      await expect(createCommand(
        buildCommandArguments(['pullzone', 'list', '-k', accessKey, '--searcht', 'test']),
        global
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--searcht', '--search'))
    })
  })
})

describe('pullzone purge', () => {
  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments(['pullzone', 'purge']),
        global
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
    })

    it('-z, --zone <string>', async () => {
      await expect(createCommand(
        buildCommandArguments(['pullzone', 'purge', '-k', accessKey, '--zonet', 'test']),
        global
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--zonet', '--zone'))
    })
  })
})


