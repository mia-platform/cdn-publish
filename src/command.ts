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
import { Command } from 'commander'

import deleteFn from './commands/delete.js'
import get from './commands/get.js'
import list from './commands/list.js'
import publish from './commands/publish.js'
import pullzone from './commands/pullzone.js'
import upload from './commands/upload.js'
import { absoluteResolve } from './glob.js'
import type { Logger } from './logger.js'
import type { Global } from './types'

export const createCommand = async (argv: string[], global: Global, logger: Logger) => {
  const config = { global, logger, workingDir: absoluteResolve('.') }

  const program = new Command()
  program.exitOverride()
  program
    .name('cdn')
    .description('A client for Mia\'s CDN storage API')
    .configureOutput({
      writeErr: (str) => logger.error(str),
    })

  program.command('publish')
    .description('Pushes a npm project to the CDN storage')
    .requiredOption('-k, --storage-access-key <string>', 'the key to access to edge storage API')
    .requiredOption('-s, --storage-zone-name <string>', 'which storage name to query')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://storage.bunnycdn.com')
    .option('-p, --project <string>', 'location of the package.json file')
    .option(
      '--scope <string>',
      'scope of the package, '
        + 'when not specified package.json `name` is parsed against /^@([^/]+)\\//',
    )
    .option(
      '--override-version [string]',
      'version that will postfix scope, if semver it won\'t allow to PUT twice '
        + 'the same scope / name / version. Useful to push `stable` or `latest` tags'
    )
    .option(
      '--checksum',
      'will publish computing the checksum of files and could potentially fail '
        + 'if the server disagrees with the checksum on its side'
    )
    .option(
      '-b, --batch-size <number>',
      'number of files to be uploaded concurrently',
      '40'
    )
    .action(publish.bind(config))

  program.command('upload')
    .description('Uploads a folder to the CDN storage')
    .requiredOption('-k, --storage-access-key <string>', 'the key to access to edge storage API')
    .requiredOption('-s, --storage-zone-name <string>', 'which storage name to query')
    .requiredOption('-d, --dest <string>', 'a directory to prepend to all pushed files')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://storage.bunnycdn.com')
    .option(
      '--checksum',
      'will publish computing the checksum of files and could potentially fail '
        + 'if the server disagrees with the checksum on its side'
    )
    .option(
      '-b, --batch-size <number>',
      'number of files to be uploaded concurrently',
      '40'
    )
    .argument(
      '[files...]',
      'list of file matchers, could be directories or files',
      []
    )
    .action(upload.bind(config))

  program.command('list')
    .description('Retrieves the content of a folder in the CDN storage')
    .requiredOption('-k, --storage-access-key <string>', 'the key to access to edge storage API')
    .requiredOption('-s, --storage-zone-name <string>', 'which storage name to query')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://storage.bunnycdn.com')
    .argument('<dir>')
    .action(list.bind(config))

  program.command('get')
    .description('Retrieves the content of a file in the CDN storage')
    .requiredOption('-k, --storage-access-key <string>', 'the key to access to edge storage API')
    .requiredOption('-s, --storage-zone-name <string>', 'which storage name to query')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://storage.bunnycdn.com')
    .argument('<file>')
    .action(get.bind(config))

  program.command('delete')
    .description('Retrieves the content of a folder in the CDN storage')
    .requiredOption('-k, --storage-access-key <string>', 'the key to access to edge storage API')
    .requiredOption('-s, --storage-zone-name <string>', 'which storage name to query')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://storage.bunnycdn.com')
    .option('--avoid-throwing', 'in case of failure does not fail with error code')
    .argument('<dir>')
    .action(deleteFn.bind(config))

  // Pullzone
  const pullzoneCmd = program.command('pullzone')
    .description('All pull zone related sub commands')

  pullzoneCmd.command('list')
    .description('Retrieves all the aviable pull zones')
    .requiredOption('-k, --access-key <string>', 'the key to access to bunny API')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://api.bunny.net')
    .option('-s, --search <string>', 'query string to filter the results')
    .action(pullzone.list.bind(config))

  pullzoneCmd.command('purge')
    .description('Purges all aviables pull zones')
    .requiredOption('-k, --access-key <string>', 'the key to access to bunny API')
    .option('-u, --base-url <string>', 'base url to make API calls to', 'https://api.bunny.net')
    .option('-z, --zone <string>', 'to purge only a specific zone id')
    .action(pullzone.purgeCache.bind(config))

  return program.parseAsync(argv, { from: 'node' })
}
