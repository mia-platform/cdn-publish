type AsyncFunction<T> = () => Promise<T>

class RetryPromise<T> extends Promise<T> {
  private __retries: number

  private readonly __promise: Promise<T>
  private readonly __maxRetries: number

  constructor(callback: AsyncFunction<T>, maxRetries = 2) {
    let __resolve: ((value: T) => void) | undefined
    let __reject: ((reason?: unknown) => void) | undefined

    super((resolve, reject) => {
      __resolve = resolve
      __reject = reject
    })

    this.__retries = 0
    this.__maxRetries = maxRetries

    this.__promise = this.__execute(callback)
    this.__promise
      .then((val) => __resolve?.(val))
      .catch((reason) => __reject?.(reason))
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2> {
    return this.__promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult> {
    return this.__promise.catch(onrejected)
  }

  private async __execute(fn: AsyncFunction<T>): Promise<T> {
    return fn()
      .catch((reason) => {
        this.__retries += 1

        if (this.__retries < this.__maxRetries) {
          return Promise.resolve(this.__execute(fn))
        }

        return Promise.reject(reason)
      })
  }
}

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

// const createRetry = <T>(callback: AsyncFunction<T>, maxRetries = 2) => {
//   const queue = Promise.resolve()
//   let retries = 0
//   let done = false

//   const
//   queue.then(() =>
//     callback()
//       .then()
//       .catch()
//   ).finally(() => {
//     retries += 1
//     if(retries < maxRetries) {

//     }
//   })

//   while (retries < maxRetries || !done) {
//     callback()
//       .then((val) => {
//         done = true
//         return val
//       })
//       .catch((err) => {
//         if (retries < maxRetries) {

//         }
//       })
//       .finally(() => {
//         retries += 1
//       })
//   }
// }


export { RetryPromise, createQueue }
