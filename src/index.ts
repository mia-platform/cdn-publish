import { Argument, Command } from 'commander'

import packageJson from '../package.json' assert {type: 'json'}

import { absoluteResolve } from './glob.js'
import logger from './logger.js'
import publish from './publish.js'
import type { Global } from './types'

const main = async (argv: string[], global: Global) => {
  const config = { global, logger, workingDir: absoluteResolve('.') }
  const { name, description, version } = packageJson

  const program = new Command()

  program
    .name(name)
    .description(description)
    .version(version)

  program.command('publish')
    .description('Pushes a folder to the CDN storage')
    .requiredOption('-k, --access-key <string>', 'the API access key')
    .option('-p, --project <string>', 'location of the package.json file', 'package.json')
    .option(
      '-s, --scope <string>',
      'scope of the package, '
        + 'when not specified package.json `name` is parsed against /^@([^/]+)\\//',
    )
    .option(
      '--override-version <string>',
      'version that will postfix scope, if semver it won\'t allow to PUT twice '
        + 'the same scope / name / version. Useful to push `stable` or `latest` tags'
    )
    .option(
      '--checksum',
      'will publish computing the checksum of files and could potentially fail '
        + 'if the server disagrees with the checksum on its side'
    )
    .argument(
      '[files...]',
      'list of file matchers, '
        + 'when no matcher is specified package.json `files` field act as fallback',
      []
    )
    .action(publish.bind(config))

  program.command('list')
    .description('Retrieves the content of a folder in the CDN storage')
    .requiredOption('-k, --access-key <string>', 'the API access key')
    .addArgument(new Argument('<dir>').argRequired())

  return program.parseAsync(argv, { from: 'node' })
}

main(process.argv, globalThis).catch(console.error)
