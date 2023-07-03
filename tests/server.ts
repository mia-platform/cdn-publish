import fs from 'fs/promises'
import path from 'path'

import { stub } from 'sinon'

import { createTmpDir } from './utils.js'

// ----------- 0.0.0/
const index = '<!DOCTYPE html><html></html>'
const indexHash = 'DC284EB4FBD61E7590A543C85622A91DDD8F8E2E20C58A14C3620D57394DBE1A'
const indexChecksum = '1623f1d081160d976dd6588373dd6e73e24af9a6ff056a653ebd0fba2f355bcd'
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

const storageAccessKey = process.env.CDN_STORAGE_ACCESS_KEY ?? 'secret'
const accessKey = process.env.CDN_ACCESS_KEY ?? 'secret'
const storageZoneName = process.env.CDN_STORAGE_ZONE_NAME ?? 'mia-platform-test'
const serverStorageBaseUrl = process.env.CDN_STORAGE_BASE_URL ?? 'http://server'
const serverApiBaseUrl = process.env.CDN_API_BASE_URL ?? 'http://server'

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

const stringifyUrl = (url: URL | RequestInfo) => (
  // eslint-disable-next-line no-nested-ternary
  url instanceof URL
    ? url.href
    : (
      url instanceof Request
        ? url.url
        : url
    )
)

const createServer = async () => {
  const tmpCtx = await createTmpDir({})

  const serverStub = stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
    const { method, headers } = config ?? {}

    const headersParse = headers as Record<string, string> | undefined
    const stringifiedUrl = stringifyUrl(url)
    const href = stringifiedUrl.match(/(?<href>\/__test\/.*)$/)?.groups?.href ?? undefined
    const res404 = new Promise<Response>((res) => res(new Response(JSON.stringify(response404), { headers: headers404, status: 404 })))
    const res401 = new Promise<Response>((res) => res(new Response(JSON.stringify(response401), { headers: headers401, status: 401 })))
    const getFile = async (filepath: string) => fs.readFile(path.join(tmpCtx.name, filepath), { encoding: 'utf-8' })
    const createDir = async (filepath: string) => fs.mkdir(path.join(tmpCtx.name, path.dirname(filepath)), { recursive: true })
    const writeFile = async (filepath: string, file: string) => fs.writeFile(path.join(tmpCtx.name, filepath), file)
    const isDir = async (filepath: string) => (await fs.lstat(path.join(tmpCtx.name, filepath))).isDirectory()
    const filepathExists = async (filepath: string) => {
      try {
        await fs.stat(path.join(tmpCtx.name, filepath))
        return true
      } catch {
        return false
      }
    }

    const deleteFilepath = async (filepath: string) => fs.rm(path.join(tmpCtx.name, filepath), { recursive: true })
    const readDir = async (filepath: string) => {
      try {
        const basePath = path.join(tmpCtx.name, filepath)
        return (await fs.readdir(basePath))
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

    if (headersParse?.AccessKey !== storageAccessKey) {
      return res401
    }

    // getters
    if (method === 'GET') {
      if (href.endsWith('/')) {
        const dirContent = await readDir(href)
        const json = JSON.stringify(dirContent)
        return new Promise((res) => res(new Response(json, { headers: headers200, status: 200 })))
      }

      if (headersParse.Accept === '*/*') {
        if (await filepathExists(href)) {
          const file = await getFile(href)
          return new Promise((res) => res(new Response(
            file,
            { headers: { ...headers200, 'Content-Type': 'text/plain' }, status: 200 }
          )))
        }
        return res404
      }
    }

    // delete
    if (method === 'DELETE') {
      if (await filepathExists(href)) {
        await deleteFilepath(href)
        return new Promise((res) => res(new Response(
          JSON.stringify(responseDelete200), { headers: headers200, status: 200 }
        )))
      }
      return res404
    }

    // put
    if (method === 'PUT') {
      const file = config?.body?.toString()
      if (!file) {
        return new Promise((res) => res(new Response(JSON.stringify(response400), { headers: headers400, status: 400 })))
      }
      await createDir(href)
      await writeFile(href, file)
      return new Promise((res) => res(new Response(JSON.stringify(response201), { headers: headers201, status: 201 })))
    }

    return res404
  })

  return async () => {
    serverStub.restore()
    await tmpCtx.cleanup()
  }
}

export {
  indexHash,
  storageAccessKey,
  accessKey,
  bunny,
  storageZoneName,
  serverStorageBaseUrl,
  serverApiBaseUrl,
  indexChecksum,
  index,
  createServer,
}
