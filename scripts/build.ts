import path from 'path'
import url from 'url'

import esbuild from 'esbuild'

const workingDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')

esbuild.build({
  banner: {
    js: [
      '#!/usr/bin/env node',
      '/*!',
      '  Copyright 2023 Mia srl',
      '',
      '  Licensed under the Apache License, Version 2.0 (the "License");',
      '  you may not use this file except in compliance with the License.',
      '  You may obtain a copy of the License at',
      '',
      '      http://www.apache.org/licenses/LICENSE-2.0',
      '',
      '  Unless required by applicable law or agreed to in writing, software',
      '  distributed under the License is distributed on an "AS IS" BASIS,',
      '  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
      '  See the License for the specific language governing permissions and',
      '  limitations under the License.',
      '*/',
    ].join('\n'),
  },
  bundle: true,
  entryPoints: [path.resolve(workingDir, 'src/index.ts')],
  outfile: path.resolve(workingDir, 'dist/index.cjs'),
  platform: 'node',
})
  .then(() => console.info(' 👌 build is ok '))
  .catch(console.error)
