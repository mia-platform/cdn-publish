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
/* eslint-disable valid-jsdoc */
import { statSync, lstatSync, readdirSync } from 'fs'
import path from 'path'

import { globSync } from 'glob'

import MysteryBoxError, { Error } from './error.js'
import type { AbsPath } from './types.js'


const absoluteJoin = (dir: AbsPath, file: string) =>
  path.join(dir, file) as AbsPath

const absoluteResolve = (dir: string, ...paths: string[]) =>
  path.resolve(dir, ...paths) as AbsPath

const absoluteWorkingDir = (file: string) => path.dirname(file) as AbsPath

const getAllFilesFromDir = (dirPath: AbsPath): Set<AbsPath> =>
  readdirSync(dirPath).reduce((arrayOfFiles, file) => {
    const filePath = absoluteJoin(dirPath, file)
    if (statSync(filePath).isDirectory()) {
      getAllFilesFromDir(filePath).forEach((pth) => arrayOfFiles.add(pth))
    } else {
      arrayOfFiles.add(filePath)
    }

    return arrayOfFiles
  }, new Set<AbsPath>())

const isOutOfScope = (workingDir: AbsPath, next: AbsPath) =>
  !absoluteResolve(workingDir, next).startsWith(workingDir)

/**
 * returns a set of absolute paths corresponding to files only
 * valid stats availible within the `workingDir` and matching one
 * of the provided `matchers`. If a path resolves to a file
 * out of scope (outside of the `workingDir`) a `MysteryBoxError`
 * is thrown
 * @param workingDir the base workingDir which serves to resolve
 * absolute paths and as guard to avoid `../` access
 * @param matchers a list of exact or glob matchers like
 * `package.json` or `dist/**`
 * @returns a set of absolute paths
 */
const getFiles = (workingDir: AbsPath, matchers: [string, ...string[]]) =>
  matchers.reduce<Set<AbsPath>>((allFiles, match) => {
    let iterator: IterableIterator<AbsPath>
    const absolutePath = absoluteResolve(workingDir, match)

    const stat = lstatSync(absolutePath, { throwIfNoEntry: false })
    if (stat?.isDirectory()) {
      iterator = getAllFilesFromDir(absolutePath)[Symbol.iterator]()
    } else {
      iterator = globSync(match, { cwd: workingDir, nodir: true, root: workingDir })
        .reduce((setOfFiles, next) => {
          const absoluteFile = absoluteResolve(workingDir, next)
          if (isOutOfScope(workingDir, absoluteFile)) {
            throw new MysteryBoxError(
              Error.OutOfScopeFile,
              `file: ${absoluteFile} is container in the current working dir ${workingDir}`
            )
          } else {
            setOfFiles.add(absoluteFile)
          }

          return setOfFiles
        }, new Set<AbsPath>())[Symbol.iterator]()
    }

    for (const file of iterator) {
      allFiles.add(file)
    }
    return allFiles
  }, new Set<AbsPath>())

export type { AbsPath }
export { getFiles, absoluteResolve, absoluteWorkingDir }

