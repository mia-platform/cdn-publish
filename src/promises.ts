type AsyncFunction<T> = () => Promise<T>

const createQueue = <T>(fns: AsyncFunction<T>[]) => {
  let promise: Promise<T> | undefined
  const executions: Promise<T>[] = []

  for (const fn of fns) {
    const pr = (promise ?? Promise.resolve()).then(() => fn())
    executions.push(pr)
    promise = pr
  }

  return {
    flush: () => Promise.all(executions),
  }
}

export { createQueue }
