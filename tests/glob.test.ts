import { expect } from 'chai'
import type { Context as MochaContext } from 'mocha'
import { afterEach, describe, it } from 'mocha'

import { getFiles } from '../src/glob.js'

import type { Temp } from './utils.js'
import { createResources, createTmpDir } from './utils.js'

describe('get all files from glob tests', () => {
  interface Context extends MochaContext {
    currentTest?: MochaContext['currentTest'] & {value?: Temp}
    test?: MochaContext['test'] & {value?: Temp}
  }
  type Test = [[string, ...string[]], string[], string[]]

  const getMessage = (test: Test) =>
    `given matchers: ${test[0].join(', ')},\n`
    + `\tshould find ${test[2].length === 0 ? 'no files' : test[2].join(',')}\n`
    + `\tamongst ${test[1].length === 0 ? 'no resources' : test[1].join(', ')}`
  const tests: Test[] = [
    [
      ['file.txt'], ['file.txt'], ['file.txt'],
    ],
    [
      ['./*.txt'], ['file.txt'], ['file.txt'],
    ],
    [
      ['*.txt', './*.txt', 'file.txt'], ['file.txt'], ['file.txt'],
    ],
    [
      ['dist', 'package.json'],
      ['package.json', 'tsconfig.json', 'dist/file1.json', 'dist/file2.js'],
      ['package.json', 'dist/file1.json', 'dist/file2.js'],
    ],
    [
      ['dist/*.json'],
      ['package.json', 'tsconfig.json', 'dist/file1.json', 'dist/file2.js'],
      ['dist/file1.json'],
    ],
  ]

  afterEach(function (this: Context) {
    return this.currentTest?.value?.cleanup()
  })

  tests.forEach((test) => {
    const message = getMessage(test)

    it(message, async function (this: Context) {
      const [matchers, resources, found] = test
      const tmpCtx = await createTmpDir(createResources(resources))

      expect(
        Array.from(
          getFiles(tmpCtx.name, matchers).values()
        ).map((pth) => pth.substring(tmpCtx.name.length + 1))
      ).to.have.members(found)

      if (this.currentTest) {
        this.currentTest.value = tmpCtx
      }
    })
  })
})
