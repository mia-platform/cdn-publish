import crypto from 'crypto'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'
import type { SinonSandbox } from 'sinon'
import { createSandbox } from 'sinon'
import sinonChai from 'sinon-chai'

import { createQueue, RetryPromise } from '../promises'

interface Context extends MochaContext {
  currentTest?: MochaContext['currentTest'] & {sandbox?: SinonSandbox}
  test?: MochaContext['test'] & {sandbox?: SinonSandbox}
}

use(chaiAsPromised)
use(sinonChai)

describe('retries test', () => {
  beforeEach(function (this: Context) {
    if (this.currentTest) {
      this.currentTest.sandbox = createSandbox()
    }
  })

  afterEach(function (this: Context) {
    this.currentTest?.sandbox?.restore()
  })

  it('should succed at first attempt', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const { test: { sandbox } } = this
    const value = crypto.randomUUID()
    const stub = sandbox.stub<[], Promise<string>>()

    stub.onCall(0).resolves(value)

    await expect(new RetryPromise<string>(stub)).to.eventually.be.equal(value)
    expect(stub).to.be.calledOnce
  })

  it('should succed at second attempt', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const { test: { sandbox } } = this
    const value = crypto.randomUUID()
    const stub = sandbox.stub<[], Promise<string>>()

    stub.onCall(0).rejects('error')
    stub.onCall(1).resolves(value)

    await expect(new RetryPromise<string>(stub)).to.eventually.be.equal(value)
    expect(stub).to.be.calledTwice
  })

  it('should fail at third attempt', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const { test: { sandbox } } = this
    const value = crypto.randomUUID()
    const stub = sandbox.stub<[], Promise<string>>()

    stub.onCall(0).rejects('error')
    stub.onCall(1).rejects('error')
    stub.onCall(2).resolves(value)

    const promise = new RetryPromise<string>(stub)
    await expect(promise)
      .to.eventually.be.rejectedWith(Error)
    await expect(promise.catch(() => true)).to.eventually.fulfilled.and.be.true
    expect(stub).to.be.calledTwice
  })

  it('should fail after custom number of retries', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const { test: { sandbox } } = this
    const value = crypto.randomUUID()
    const stub = sandbox.stub<[], Promise<string>>()

    stub.onCall(0).rejects('error')
    stub.onCall(1).rejects('error')
    stub.onCall(2).rejects('error')
    stub.onCall(3).rejects('error')
    stub.onCall(4).resolves(value)

    await expect(new RetryPromise<string>(stub, 4))
      .to.eventually.be.rejectedWith(Error)
    expect(stub).to.have.callCount(4)
  })
})

describe('retries test', () => {
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

    await expect(createQueue([stub1, stub2]).flush())
      .to.eventually.be.fulfilled
      .and.have.members([value1, value2])
    expect(stub1).to.be.calledOnce
    expect(stub2).to.be.calledOnce
  })
})
