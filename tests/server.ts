/* eslint-disable no-sync */

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

// 204
const headers204 = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/text',
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

const storageAccessKey = 'secret'
const accessKey = 'secret'
const storageZoneName = 'mia-platform-test'
const serverBaseUrl = 'http://server'

const baseFile = {
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
}

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


  mock.method(global, 'fetch', async (url: URL | RequestInfo, config: RequestInit = { }) => {
    const stringifiedUrl = stringifyUrl(url)
    const href = stringifiedUrl.match(/(?<href>\/__test\/.*)$/)?.groups?.href ?? undefined
    const { method = 'GET' } = config
    const res404 = new Response(JSON.stringify(response404), { headers: headers404, status: 404 })
    const res401 = new Response(JSON.stringify(response401), { headers: headers401, status: 401 })
    const headers = config.headers as Record<string, string> | undefined
    const getFile = (filepath: string) => fs.readFileSync(path.join(tmpCtx.name, filepath))
    const createDir = (filepath: string) => fs.mkdirSync(path.join(tmpCtx.name, path.dirname(filepath)), { recursive: true })
    const writeFile = (filepath: string, file: string) => fs.writeFileSync(path.join(tmpCtx.name, filepath), file)
    const isDir = (filepath: string) => fs.lstatSync(path.join(tmpCtx.name, filepath)).isDirectory()
    const filepathExists = (filepath: string) => fs.existsSync(path.join(tmpCtx.name, filepath))
    const deleteFilepath = (filepath: string) => fs.rmSync(path.join(tmpCtx.name, filepath), { recursive: true })
    const readDir = (filepath: string) => {
      try {
        const basePath = path.join(tmpCtx.name, filepath)
        return fs.readdirSync(basePath)
          .map(file => ({ ...baseFile,
            IsDirectory: isDir(path.join(filepath, file)),
            ObjectName: file,
            Path: path.join(filepath, file),
          }))
      } catch (err) {
        return []
      }
    }

    if (href === undefined) {
      return res404
    }

    if (headers?.AccessKey !== storageAccessKey) {
      return res401
    }

    // getters
    if (method === 'GET') {
      if (href.endsWith('/')) {
        const dirContent = readDir(href)
        const json = JSON.stringify(dirContent)
        return new Response(json, { headers: headers200, status: 200 })
      }

      if (headers.Accept === '*/*') {
        if (filepathExists(href)) {
          return new Response(
            getFile(href),
            { headers: { ...headers200, 'Content-Type': 'text/plain' }, status: 200 }
          )
        }
        return res404
      }
    }

    // delete
    if (method === 'DELETE') {
      if (filepathExists(href)) {
        deleteFilepath(href)
        return new Response(
          JSON.stringify(responseDelete200), { headers: headers200, status: 200 }
        )
      }
      return res404
    }

    // put
    if (method === 'PUT') {
      const file = config.body?.toString()
      if (!file) {
        return new Response(JSON.stringify(response400), { headers: headers400, status: 400 })
      }
      createDir(href)
      writeFile(href, file)
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
  headers204,
  headers400,
  headers401,
  headers404,
  response201,
  response400,
  response401,
  response404,
  responseDelete200,
}
export {
  createServer,
  indexHash,
  storageAccessKey,
  accessKey,
  bunny,
  storageZoneName,
  serverBaseUrl,
}
