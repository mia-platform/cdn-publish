import { expect } from 'chai'
import { describe, it } from 'mocha'

import { createCdnContext } from '../../src/cdn.js'
import MysteryBoxError from '../../src/error.js'

describe('get all files from glob tests', () => {
  it('should throw on incorrect url', () => {
    expect(() => createCdnContext('secret', {
      server: '/wrong/',
      storageZoneName: '/zone/',
    })).to.throw(MysteryBoxError, 'Invalid URL')
  })

  it('should throw on incorrect url and wrap zone', () => {
    expect(() => createCdnContext('secret', {
      server: '/wrong/',
      storageZoneName: '/zone',
    })).to.throw(MysteryBoxError, 'Invalid URL')
  })
})
