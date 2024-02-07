import { defineConfig } from 'vite'
import { builtinModules } from 'module'

import pkg from './package.json'

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'build',
    minify: false,
    lib: {
      entry: ['src/index.ts'],
      formats: ['es'],
    },
    sourcemap: true,
    rollupOptions: {
      input: {
        index: 'src/index.ts'
      },
      external: [
        ...builtinModules,
        ...Object
          .keys(pkg.dependencies)
      ]
    }
  }
})
