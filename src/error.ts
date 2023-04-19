import type { HttpError } from './http-client'

enum Error {
  ReadFile,
  JSONParseString,
  NoPackageJsonFiles,
  NoPackageJsonNameScope,
  InvalidURL,
  NothingToDo,
  OutOfScopeFile,
  PutOnNonEmptyFolder,
  UnableToUploadFile
}

interface CaughtError {
  cause?: unknown
  error: Error
  message: string
}

interface UnableToUploadFile extends CaughtError {
  cause: HttpError | UnableToUploadFile[]
}

class MysteryBoxError extends TypeError implements CaughtError {
  error: Error

  constructor(error: Error, message?: string, options?: ErrorOptions) {
    super(message, options)
    this.error = error
  }
}

const reject = (error: Error, message?: string, cause?: unknown) =>
  Promise.reject(new MysteryBoxError(error, message, { cause }))

const errorCatcher = (error: Error, message?: string) =>
  (cause?: unknown) => Promise.reject(new MysteryBoxError(error, message, { cause }))

const thrower = (error: Error, message?: string) =>
  (cause: unknown) => { throw new MysteryBoxError(error, message, { cause }) }

export type { CaughtError, UnableToUploadFile }
export { Error, reject, thrower, errorCatcher }
export default MysteryBoxError
