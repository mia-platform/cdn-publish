import { setTimeout } from 'timers/promises'

import MysteryBoxError, { reject, Error, errorCatcher } from './error.js'

interface HttpClientConfig {
  baseURL?: string
  headers?: Record<string, string>
}

interface RequestConfig<D = unknown> extends Omit<RequestInit, 'method' | 'body'> {
  data?: D
}

interface ResponseConfig<T> extends Response {
  data: T
}

interface HttpClient {
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseConfig<T>>
  get<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseConfig<T>>
  put<T = unknown>(
    url: string, data?: Buffer, config?: RequestConfig<Buffer>
  ): Promise<ResponseConfig<T>>
}

const okHandler = (res: Response) =>
  (res.ok ? Promise.resolve(res) : reject(Error.ResponseNotOk, 'response not ok', res))

const contentTypeHandler = (res: Response) => {
  const ct = res.headers.get('content-type')?.split(';')[0].trim()
  switch (ct) {
  case 'application/json':
    return Promise.all([
      res.json().catch(errorCatcher(Error.BodyNotOk, 'response body not ok')),
      Promise.resolve(res),
    ])
  default:
    return Promise.all([
      res.text().catch(errorCatcher(Error.BodyNotOk, 'response body not ok')),
      Promise.resolve(res),
    ])
  }
}

const serializeInput = (data: unknown): BodyInit | null | undefined => {
  if (typeof data === 'undefined') {
    return
  }

  if (data instanceof Buffer) {
    return new Blob([data])
  }

  throw new MysteryBoxError(Error.BodyNotOk, 'cannot parse this type of body', undefined)
}

/**
 * creates a fetch wrapper with methods GET, PUT, and DELETE
 * @param {HttpClientConfig} clientConfig allows to preset the baseURL
 * and headers to include in each call
 * @returns {HttpClient} an instance of an HttpClient
 */
const createHttpClient = (clientConfig: HttpClientConfig): HttpClient => {
  async function clientFetch(url: string, method?: 'GET' | 'PUT' | 'DELETE', { data, ...config }: RequestConfig = {}, retries = 3, delay = 1000):
      Promise<Response> {
    return fetch(
      new URL(url, clientConfig.baseURL),
      {
        ...config,
        body: serializeInput(data),
        headers: {
          ...clientConfig.headers,
          ...config.headers,
        },
        method,
      }
    ).catch(async (err) => {
      if (retries <= 0) {
        return errorCatcher(Error.ResponseNotOk, 'response not ok')(err)
      }
      await setTimeout(delay)
      // eslint-disable-next-line no-plusplus, no-param-reassign
      return clientFetch(url, method, { data, ...config }, --retries, delay)
    })
  }

  return {
    async delete<T = unknown>(url: string, config: RequestConfig) {
      return clientFetch(url, 'DELETE', config)
        .then(okHandler)
        .then(contentTypeHandler)
        .then(([resData, res]) => Object.assign(res, { data: resData as T }))
    },
    async get<T = unknown>(url: string, config: RequestConfig) {
      return clientFetch(url, 'GET', config)
        .then(okHandler)
        .then(contentTypeHandler)
        .then(([resData, res]) => Object.assign(res, { data: resData as T }))
    },
    async put<T = unknown>(url: string, data?: Buffer, config?: RequestConfig<Buffer>) {
      return clientFetch(
        url,
        'PUT',
        {
          ...config,
          data,
        })
        .then(okHandler)
        .then(contentTypeHandler)
        .then(([resData, res]) => Object.assign(res, { data: resData as T }))
    },
  }
}

export { createHttpClient }
