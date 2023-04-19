import type { ReadStream } from 'fs'

import type { AxiosInstance } from 'axios'
import axios, { AxiosError } from 'axios'

import type { CDN } from './cdn'
import { endsWithSlash } from './cdn.js'
import type { CaughtError } from './error.js'
import { errorCatcher, reject, Error } from './error.js'
import type { Logger } from './logger'
import { RetryPromise, createQueue } from './promises.js'
import type { FileContext, LoadingContext, RelPath } from './types'

type HttpClient = AxiosInstance

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

interface PutFileContext {
  absolutePath: `/${string}`
  pathname: `./${string}`
  response: unknown
}

interface BunnyClient {
  /**
   * returns the content of a remote directory on the CDN
   * @param scope a relative path which must start with `./`
   * and a trailing slash will be automatically added to enforce
   * it to be a folder
   * @returns a list of metadata describing files. When there is
   * no directory it returns an empty list without failing
   */
  list: (scope: RelPath) => Promise<FileMeta[]>
  /**
   * puts files to remote storage location using `scope` as folder
   * selector, in the format ` organization / library / version (optional)`
   * when version is semver compliant it refuses to put twice in the same
   * place. Due to the API endpoints the requests must be chunked in batches
   * where the default batch is 25 items strong
   * @see {@link https://docs.bunny.net/reference/edge-storage-api-limits}
   * @param scope relative path which must start with `./`
   * @param pathnames relative path segments which must start with `./`
   * and the latest identifies the file itself
   * @param isSemver flag to avoid double push logic on semver folders
   * @returns
   */
  put: (scope: RelPath, pathnames: [LoadingContext, ...LoadingContext[]], isSemver?: boolean | undefined) => Promise<void>
}

const successfulPut = {
  HttpCode: 201,
  Message: 'File uploaded.',
}

// const failedPut = {
//   HttpCode: 400,
//   Message: 'Unable to upload file.',
// }

// const unauthorized = {
//   HttpCode: 401,
//   Message: 'Unauthorized',
// }

const splitInChunks = (contexts: LoadingContext[], maxChunkSize = 25) => {
  if (contexts.length <= maxChunkSize) {
    return [contexts]
  }

  return contexts.reduce<LoadingContext[][]>(
    (chunks, item, index) => {
      const batchNumber = Math.floor(index / maxChunkSize)
      const batchIndex = index % maxChunkSize

      if ((chunks[batchNumber] as (LoadingContext[] | undefined)) === undefined) {
        const newBatch: LoadingContext[] = []
        newBatch[batchIndex] = item
        chunks[batchNumber] = newBatch
      } else {
        chunks[batchNumber][batchIndex] = item
      }

      return chunks
    },
    []
  )
}

const collectFulfilled = (arr: {fulfilled: PutFileContext[]}[]) =>
  arr.reduce<PutFileContext[]>((fulfilled, batch) => {
    fulfilled.push(...batch.fulfilled)
    return fulfilled
  }, [])

const collectRejections = (arr: {rejected: CaughtError[]}[]) =>
  arr.reduce<CaughtError[]>((errors, batch) => {
    errors.push(...batch.rejected)
    return errors
  }, [])

const createClient = (cdn: CDN, logger: Logger, retries?: number): BunnyClient => {
  // todo
  const { baseURL: { href: baseURL } } = cdn
  const httpClient: HttpClient = axios.create({
    baseURL,
    headers: {
      AccessKey: cdn.accessKey,
    },
  })

  const list = async (scope: RelPath) =>
    httpClient.get<FileMeta[]>(cdn.buildUrl(endsWithSlash(scope)).href)
      .then(({ data }) => data)

  const isEmptyFolder = async (scope: RelPath) => {
    const items = await list(scope)
    // client.get(folder)
    return items.length === 0
  }

  const putRequest = async (url: URL, fileContext: FileContext) => {
    let data: Buffer | ReadStream
    const headers: Record<string, string> = {}
    if ('checksum' in fileContext) {
      data = fileContext.buffer
      headers.Checksum = fileContext.checksum.toUpperCase()
    } else {
      data = fileContext
    }

    return new RetryPromise(
      async () =>
        httpClient.put<typeof successfulPut>(
          url.href,
          data,
          {
            headers: {
              'Content-Type': 'application/octet-stream',
              ...headers,
            },
            onUploadProgress(progressEvent) {
              console.log(url.pathname, progressEvent.progress, progressEvent.estimated)
            },
          }
        ),
      retries
    ).catch(e => { console.log(e); return Promise.reject(e) })
  }

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

    const putFile = async (ctx: LoadingContext) => {
      const url = cdn.buildUrl(scope, ctx.pathname)
      return ctx.loader()
        .then((buf) => putRequest(url, buf))
        .then((value) => ({
          response: value,
          ...ctx,
        }))
        .catch((e) => { console.error(e); return Promise.reject(e) })
        .catch(errorCatcher(Error.UnableToUploadFile, ctx.pathname))
    }

    const putChunk = (chunk: LoadingContext[]) =>
      () => Promise.allSettled(
        chunk.map(putFile)
      ).then((results) => {
          interface ReducedSettler {
            fulfilled: PutFileContext[]
            rejected: CaughtError[]
          }

          return results.reduce<ReducedSettler>((all, result) => {
            result.status === 'fulfilled'
              ? all.fulfilled.push(result.value)
              : all.rejected.push(result.reason as CaughtError)
            return all
          }, { fulfilled: [], rejected: [] })
      })

    const chunks = splitInChunks(pathnames)
    return createQueue(chunks.map(putChunk)).flush()
      .then((settler) => {
        const fulfilled = collectFulfilled(settler)
        const errors = collectRejections(settler)

        logger.table(
          fulfilled.map(({ pathname }) => ({ file: pathname, status: 'OK' }))
        )

        if (errors.length !== 0) {
          console.table(
            errors.map(({ message }) => ({ file: message, status: 'KO' }))
          )

          return reject(
            Error.UnableToUploadFile,
            `Some files for ${scope} could not be uploaded`,
            errors
          )
        }
      })
  }

  return {
    list,
    put,
  }
}

export type { HttpClient }
export { createClient, AxiosError as HttpError }
