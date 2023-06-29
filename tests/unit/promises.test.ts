import crypto from 'crypto'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'
import type { SinonSandbox } from 'sinon'
import { createSandbox } from 'sinon'
import sinonChai from 'sinon-chai'

import { createQueue } from '../../src/promises.js'

interface Context extends MochaContext {
  currentTest?: MochaContext['currentTest'] & {sandbox?: SinonSandbox}
  test?: MochaContext['test'] & {sandbox?: SinonSandbox}
}

use(chaiAsPromised)
use(sinonChai)

describe('create queue tests', () => {
  beforeEach(function (this: Context) {
    if (this.currentTest) {
      this.currentTest.sandbox = createSandbox()
    }
  })

  afterEach(function (this: Context) {
    this.currentTest?.sandbox?.restore()
  })

  it('should queue executions', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const { test: { sandbox } } = this
    let counter = 0
    const value1 = crypto.randomUUID()
    const value2 = crypto.randomUUID()
    const stub1 = sandbox.stub<[], Promise<string>>().callsFake(() => {
      expect(counter).to.equal(0)
      counter += 1
      return Promise.resolve(value1)
    })
    const stub2 = sandbox.stub<[], Promise<string>>().callsFake(() => {
      expect(counter).to.equal(1)
      return Promise.resolve(value2)
    })

    await expect(createQueue([stub1, stub2], 1).flush())
      .to.eventually.be.fulfilled
      .and.have.members([value1, value2])
    expect(stub1).to.be.calledOnce
    expect(stub2).to.be.calledOnce
  })
})
