import type { CDN } from '../cdn.js'
import { endsWithSlash } from '../cdn.js'
import { errorCatcher, reject, Error } from '../error.js'
import type { Logger } from '../logger.js'
import { createQueue } from '../promises.js'
import type { FileContext, LoadingContext, RelPath } from '../types.js'

import { createHttpClient } from './http-client.js'

interface FileMeta {
  ArrayNumber: number
  Checksum: string | null
  ContentType: string | ''
  DateCreated: string
  Guid: string
  IsDirectory: boolean
  LastChanged: string
  Length: number
  ObjectName: string
  Path: `/${string}/`
  ReplicatedZones: string | null
  ServerId: number
  StorageZoneId: number
  StorageZoneName: string
  UserId: string
}

interface BunnyEdgeStorageClient {
  /**
   * returns the content of a remote file on the CDN,
   * if there's a trailing slash it reverts to the `list` method
   * @param scope a relative path which must start with `./`
   * @param pathnames relative path segment which must start with `./`
   * and identifies the file itself
   * @returns
   */
  delete(scope: RelPath, pathname?: RelPath, avoidThrowing?: boolean): Promise<void>
  /**
   * returns the content of a remote file on the CDN,
   * if there's a trailing slash it reverts to the `list` method
   * @param scope a relative path which must start with `./`
   * @returns the file / directory content
   */
  get(scope: RelPath): Promise<unknown | FileMeta[]>
  /**
   * returns the content of a remote directory on the CDN
   * @param scope a relative path which must start with `./`
   * and a trailing slash will be automatically added to enforce
   * it to be a folder
   * @returns a list of metadata describing files. When there is
   * no directory it returns an empty list without failing
   */
  list(scope: RelPath): Promise<FileMeta[]>
  /**
   * puts files to remote storage location using `scope` as folder
   * selector, in the format ` organization / library / version (optional)`
   * when version is semver compliant it refuses to put twice in the same
   * place
   * @see {@link https://docs.bunny.net/reference/edge-storage-api-limits}
   * @param scope relative path which must start with `./`
   * @param pathnames relative path segments which must start with `./`
   * and the latest identifies the file itself
   * @param isSemver flag to avoid double push logic on semver folders
   * @returns
   */
  put(scope: RelPath, pathnames: [LoadingContext, ...LoadingContext[]], isSemver?: boolean | undefined): Promise<void>
}

const successfulPut = {
  HttpCode: 201,
  Message: 'File uploaded.',
}

const successfulDelete = {
  HttpCode: 200,
  Message: 'File deleted successfuly.',
}

const createBunnyEdgeStorageClient = (cdn: CDN, _logger: Logger): BunnyEdgeStorageClient => {
  const { baseURL: { href: baseURL } } = cdn
  const httpClient = createHttpClient({
    baseURL,
    headers: {
      AccessKey: cdn.accessKey,
    },
  })

  const deleteFn = async (scope: RelPath, pathname: RelPath = './', avoidThrowing = false) => {
    const url = cdn.buildUrl(scope, pathname)
    return httpClient.delete<typeof successfulDelete>(url.href)
      .then(() => { /* noop */ })
      .catch((err) => {
        if (avoidThrowing) {
          return
        }

        return Promise.reject(err)
      })
  }

  const list = async (scope: RelPath) =>
    httpClient.get<FileMeta[]>(
      cdn.buildUrl(endsWithSlash(scope)).href,
      {
        headers: { Accept: '*/*' },
      }
    )
      .then(({ data }) => data)

  const get = async (scope: RelPath) => {
    if (scope.endsWith('/')) {
      return list(scope)
    }

    return httpClient.get(
      cdn.buildUrl(scope).href,
      {
        headers: { Accept: '*/*' },
      }
    )
      .then(({ data }) => data)
      .catch((err) =>
        reject(Error.UnableToGetFile, 'unable to retrieve file', (err as TypeError).cause)
      )
  }

  const isEmptyFolder = async (scope: RelPath) => {
    const items = await list(scope)
    // client.get(folder)
    return items.length === 0
  }

  const putRequest = async (url: URL, fileContext: FileContext) => {
    let data = fileContext as Buffer
    const headers: Record<string, string> = {}

    if (!(fileContext instanceof Buffer)) {
      data = fileContext.buffer
      headers.Checksum = fileContext.checksum.toUpperCase()
    }

    return httpClient.put<typeof successfulPut>(
      url.href,
      data,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          ...headers,
        },
      }
    )
  }

  const restore = (scope: RelPath) => deleteFn(scope)
    .catch(errorCatcher(Error.UnableToDeleteFile, scope))

  const put = async (scope: RelPath, pathnames: [LoadingContext, ...LoadingContext[]], isSemver = false) => {
    // checks whether putting a semver folder
    let isOkToPut = true
    if (isSemver) {
      isOkToPut = await isEmptyFolder(scope)
    }

    // if it is already filled it throws
    if (!isOkToPut) {
      return reject(
        Error.PutOnNonEmptyFolder,
        `Folder ${scope} is not empty and scoped with semver versioning`,
        undefined
      )
    }

    const putFile = (ctx: LoadingContext) => {
      const url = cdn.buildUrl(scope, ctx.pathname)
      return async () => ctx.loader()
        .then((buf) => putRequest(url, buf))
        .then((value) => ({
          response: value,
          ...ctx,
        }))
        .catch(errorCatcher(Error.UnableToUploadFile, ctx.pathname))
    }

    return createQueue(pathnames.map(putFile)).flush()
      .catch(async (err) => {
        if (isSemver) {
          return restore(scope)
            .then(() => Promise.reject(err))
        }

        return Promise.reject(err)
      })
      .then(() => { /* noop */ })
  }

  return {
    delete: deleteFn,
    get,
    list,
    put,
  }
}

export type { BunnyEdgeStorageClient }
export { createBunnyEdgeStorageClient }
