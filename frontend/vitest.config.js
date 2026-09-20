import {fileURLToPath} from 'node:url'
import {mergeConfig, defineConfig, configDefaults} from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            exclude: [...configDefaults.exclude, 'e2e/**'],
            root: fileURLToPath(new URL('./', import.meta.url)),
            // frontend/.env is gitignored, so VITE_API_BASE_URL is undefined in
            // CI and the api.spec.js URL assertion would compare "undefined/..."
            // against itself. Pin it so the test means the same thing everywhere.
            env: {
                VITE_API_BASE_URL: 'http://api.test'
            }
        }
    })
)
