/*!
  Copyright 2023 Mia srl

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
enum Error {
  ReadFile,
  ResponseNotOk,
  BodyNotOk,
  JSONParseString,
  NoFiles,
  NoPackageJsonFiles,
  NoPackageJsonNameScope,
  InvalidURL,
  NothingToDo,
  OutOfScopeFile,
  PutOnNonEmptyFolder,
  UnableToUploadFile,
  UnableToDeleteFile,
  UnableToGetFile,
}

interface CaughtError {
  cause?: unknown
  error: Error
  message: string
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

export type { CaughtError }
export { Error, reject, thrower, errorCatcher }
export default MysteryBoxError
