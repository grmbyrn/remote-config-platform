import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['tests/**/*.test.js'],
        setupFiles: ['./tests/setup.js'],
        // Integration tests all share one emulator database, so running test
        // FILES in parallel lets one file's clearFirestore() wipe another
        // file's fixtures mid-run. Serial files, nondeterminism gone.
        fileParallelism: false,
        // The Firestore emulator is a cold JVM on first contact — the first
        // clearFirestore() in whichever file runs first has been measured at
        // >10s, over Vitest's default hookTimeout.
        testTimeout: 30000,
        hookTimeout: 30000,
        coverage: {
            provider: 'v8',
            include: ['controllers/**', 'services/**', 'lib/**', 'middleware/**'],
            exclude: ['**/*.test.js']
        },
        globalSetup: ['./tests/globalSetup.js'],
    }
})
