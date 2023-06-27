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
type AsyncFunction<T> = () => Promise<T>

const createQueue = <T>(fns: AsyncFunction<T>[], batchSize: number) => {
  let promise: Promise<T> | undefined
  const executions: Promise<T>[] = []

  for (let i = 0; i < fns.length; i += batchSize) {
    const pr = (promise ?? Promise.resolve())
      .then(async () => Promise.all(fns.slice(i, i + batchSize).map(fn => fn())) as Promise<Awaited<T>>)
    executions.push(pr)
    promise = pr
  }

  return {
    flush: () => Promise.all(executions).then((res) => res.flat()),
  }
}

export { createQueue }
