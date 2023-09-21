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
import { exit } from 'process'

import { CommanderError } from 'commander'

import { createCommand } from './command.js'
import MysteryBoxError from './error.js'
import logger from './logger.js'

createCommand(process.argv, globalThis, logger)
  .then(() => {
    logger.info('😁, all good!')
    return exit(0)
  })
  .catch(async (err) => {
    if (err instanceof MysteryBoxError && err.cause instanceof Response) {
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
    } else if (err instanceof CommanderError) {
      return exit(1)
    } else {
      logger.error(`Unhandled error: ${err instanceof TypeError ? err.message : err}`)
    }

    return exit(1)
  })
