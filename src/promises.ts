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
