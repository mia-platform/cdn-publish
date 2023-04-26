/* eslint-disable no-sync */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-nested-ternary */
import fs from 'fs'
import { mock } from 'node:test'
import path from 'path'


import { createTmpDir } from './utils.js'

// ----------- __test/
const file0 = Buffer.from('file0.txt', 'binary')
const file1 = Buffer.from('file0.txt', 'binary')
// -------------------

// ----------- 0.0.0/
const index = Buffer.from('<!DOCTYPE html><html></html>', 'binary')
const indexHash = 'DC284EB4FBD61E7590A543C85622A91DDD8F8E2E20C58A14C3620D57394DBE1A'
// -------------------

// 200 put / delete
const headers200 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 200 delete
const responseDelete200 = {
  HttpCode: 200,
  Message: 'File deleted successfuly.',
}

// 201 put
const response201 = {
  HttpCode: 201,
  Message: 'File uploaded.',
}
const headers201 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 400
const response400 = ''
  + '<html>'
  + '<head><title>400 Bad Request</title></head>'
  + '<body>'
  + '<center><h1>400 Bad Request</h1></center>'
  + '<hr><center>nginx</center>'
  + '</body>'
  + '</html>'
const headers400 = {
  'access-control-allow-origin': '*',
  'content-type': 'text/html',
}

// 401
const response401 = {
  HttpCode: 401,
  Message: 'Unauthorized',
}
const headers401 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 404 get
const response404 = {
  HttpCode: 404,
  Message: 'Object Not Found',
}
const headers404 = headers200

const stringifyUrl = (url: URL | RequestInfo) => (
  url instanceof URL
    ? url.href
    : (
      url instanceof Request
        ? url.url
        : url
    )
)

const accessKey = 'secret'

const files = [
  {
    ArrayNumber: 0,
    Checksum: null,
    ContentType: '',
    DateCreated: '',
    Guid: '',
    IsDirectory: true,
    LastChanged: '',
    Length: 0,
    ObjectName: '',
    Path: '/__test/file0.txt',
    ReplicatedZones: null,
    ServerId: 0,
    StorageZoneId: 0,
    StorageZoneName: '',
    UserId: '',
  },
  {
    ArrayNumber: 0,
    Checksum: null,
    ContentType: '',
    DateCreated: '',
    Guid: '',
    IsDirectory: true,
    LastChanged: '',
    Length: 0,
    ObjectName: '',
    Path: '/__test/file1.txt',
    ReplicatedZones: null,
    ServerId: 0,
    StorageZoneId: 0,
    StorageZoneName: '',
    UserId: '',
  },
]

const tripleZero = [
  {
    ArrayNumber: 0,
    Checksum: null,
    ContentType: '',
    DateCreated: '',
    Guid: '',
    IsDirectory: true,
    LastChanged: '',
    Length: 0,
    ObjectName: '',
    Path: '/__test/0.0.0/index.html',
    ReplicatedZones: null,
    ServerId: 0,
    StorageZoneId: 0,
    StorageZoneName: '',
    UserId: '',
  },
]

const createServer = async () => {
  /**
   *  __test/
   *    file0.txt
   *    file1.txt
   *    0.0.0/
   *      index.html
   *    1.0.0/
   *      <empty>
   */
  const tmpCtx = await createTmpDir({
    '__test/0.0.0/index.html': index,
    '__test/file0.txt': file0,
    '__test/file1.txt': file1,
  })


  mock.method(global, 'fetch', async (url: URL | RequestInfo, config: RequestInit = {}) => {
    const stringifiedUrl = stringifyUrl(url)
    const href = stringifiedUrl.match(/(?<href>\/__test\/.*)$/)?.groups?.href ?? undefined
    const { method = 'GET' } = config
    const res404 = new Response(JSON.stringify(response404), { headers: headers404, status: 404 })
    const headers = config.headers as Record<string, string> | undefined
    const getFile = (filepath: string) => fs.readFileSync(path.join(tmpCtx.name, filepath))

    if (href === undefined) {
      return res404
    }

    // getters
    if (method === 'GET') {
      if (
        (
          href.match(/__test\/file(0|1)\.txt$/)
          || href.match(/__test\/0\.0\.0\/index\.html$/)
        )
         && headers?.AccessKey === accessKey
         && headers.Accept === '*/*'
      ) {
        return new Response(
          getFile(href),
          { headers: { ...headers200, 'Content-Type': 'text/plain' }, status: 200 }
        )
      }

      if (
        href.match(/__test(\/0\.0\.0|1\.0\.0)?\/$/)
         && headers?.AccessKey === accessKey
         && headers.Accept === '*/*'
      ) {
        const dirContent = href.endsWith('__test/')
          ? JSON.stringify(files)
          : (
            href.endsWith('__test/0.0.0/')
              ? JSON.stringify(tripleZero)
              : JSON.stringify([])
          )
        return new Response(dirContent, { headers: headers200, status: 200 })
      }

      if (href.endsWith('/')) {
        return new Response(JSON.stringify([]), { headers: headers200, status: 200 })
      }
    }

    // delete
    if (method === 'DELETE') {
      if (
        (
          href.match(/__test\/file(0|1)\.txt$/)
          || href.match(/__test\/0\.0\.0\/index\.html$/)
        )
         && headers?.AccessKey === accessKey
      ) {
        return new Response(
          JSON.stringify(responseDelete200), { headers: headers200, status: 200 }
        )
      }

      return res404
    }

    // put
    if (method === 'PUT') {
      return new Response(JSON.stringify(response201), { headers: headers201, status: 201 })
    }

    return res404
  })

  return async () => {
    mock.restoreAll()
    await tmpCtx.cleanup()
  }
}

const bunny = {
  headers200,
  headers201,
  headers400,
  headers401,
  headers404,
  response201,
  response400,
  response401,
  response404,
  responseDelete200,
}
export { createServer, indexHash, accessKey, bunny }
