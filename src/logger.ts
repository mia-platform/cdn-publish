import nodeColorLogger from 'node-color-log'

const logger = Object.assign(nodeColorLogger, {
  table: (tabularData?: unknown, properties?: string[]) =>
    console.table(tabularData, properties),
})

type Logger = typeof logger

export type { Logger }
export default logger
