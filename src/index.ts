import { exit } from 'process'

import { CommanderError } from 'commander'

import { createCommand } from './command.js'
import MysteryBoxError from './error.js'
import logger from './logger.js'

createCommand(process.argv, globalThis)
  .then(() => {
    logger.info('😁, all good!')
    return exit(0)
  })
  .catch(async (err) => {
    if (err instanceof CommanderError) {
      logger.error(err.message.replaceAll('\n', ' '))
    } else if (err instanceof MysteryBoxError && err.cause instanceof Response) {
      switch (err.cause.status) {
      case 401:
        logger.error('HTTP response returned UNAUTHORIZED. Either missing or wrong access key in option -k or --storage-access-key|--api-key')
        break
      default:
        await err.cause.text().then((text) => {
          logger.error(err, err.message, text)
        })
        break
      }
    } else {
      logger.error('Unhandled error', err instanceof TypeError ? err.message : err)
    }

    return exit(1)
  })
