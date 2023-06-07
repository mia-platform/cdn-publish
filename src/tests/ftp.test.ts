import fs from 'fs'
import path from 'path'

import * as ftp from 'basic-ftp'
import { describe, it } from 'mocha'

import { createTmpDir } from './utils.js'

describe.skip('ftp tests', () => {
  it('e2e DONT USE', async function (this) {
    this.timeout(100_000)

    const packageJson = Buffer.from(JSON.stringify({ main: './dist/index.js', name: 'my-lib' }))
    const indexJs = Buffer.from('console.log("Hello")')
    const tmpCtx = await createTmpDir({ 'dist/index.js': indexJs, 'package.json': packageJson })

    const client = new ftp.Client()
    await client.access({
      host: 'storage.bunnycdn.com',
      password: process.env.STORAGE_ACCESS_KEY,
      secure: true,
      user: 'mia-platform-test',
    })
    await client.uploadFromDir(tmpCtx.name, 'backoffice/__test/ftp')
    await client.uploadFrom(fs.createReadStream(path.join(tmpCtx.name, 'dist/index.js')), 'backoffice/__test/ftp/files/dist/index.js')

    client.close()
    return tmpCtx.cleanup()
  })
})
