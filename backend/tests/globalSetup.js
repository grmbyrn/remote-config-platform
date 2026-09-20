// Runs once in the main Vitest process before any test file. Note: setupFiles
// do NOT apply here, so env vars from tests/setup.js are not available yet.
export async function setup(){
    const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
    const url = `http://${host}/emulator/v1/projects/demo-config-panel/databases/(default)/documents`

    const deadline = Date.now() + 60000
    let lastError

    while(Date.now() < deadline){
        try {
            const res = await fetch(url, {method: 'DELETE'})
            if(res.ok) return          // emulator is up and responsive
            lastError = `status ${res.status}`
        } catch (err) {
            lastError = err.message
        }
        await new Promise(r => setTimeout(r, 250))
    }

    throw new Error(`Firestore emulator not reachable at ${host}: ${lastError}`)
}
