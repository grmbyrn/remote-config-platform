import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

// firebase.js calls initializeApp() at import time and reads import.meta.env,
// so it must be mocked before api.js pulls it in.
const {mockGetIdToken} = vi.hoisted(() => ({mockGetIdToken: vi.fn()}))

vi.mock('@/firebase.js', () => ({
    auth: {currentUser: {getIdToken: mockGetIdToken}},
    getCurrentUser: vi.fn()
}))

const {apiFetch} = await import('@/api.js')

beforeEach(() => {
    mockGetIdToken.mockReset()
    mockGetIdToken.mockResolvedValue('fake-id-token')
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, status: 200, json: async () => ({})})))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

function lastCall(){
    return globalThis.fetch.mock.calls[0]
}

describe('apiFetch', () => {
    it('prefixes the path with the configured base URL', async () => {
        await apiFetch('/parameters')

        const [url] = lastCall()
        expect(url).toBe('http://api.test/parameters')
    })

    it('attaches a fresh Firebase ID token as a Bearer header', async () => {
        await apiFetch('/parameters')

        const [, options] = lastCall()
        expect(mockGetIdToken).toHaveBeenCalledOnce()
        expect(options.headers.Authorization).toBe('Bearer fake-id-token')
    })

    it('sends JSON content-type by default', async () => {
        await apiFetch('/parameters')

        const [, options] = lastCall()
        expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('passes through method and body', async () => {
        await apiFetch('/parameters', {method: 'POST', body: JSON.stringify({key: 'x'})})

        const [, options] = lastCall()
        expect(options.method).toBe('POST')
        expect(options.body).toBe('{"key":"x"}')
    })

    it('lets a caller override the default headers', async () => {
        await apiFetch('/parameters', {headers: {'Content-Type': 'text/plain', 'X-Custom': '1'}})

        const [, options] = lastCall()
        expect(options.headers['Content-Type']).toBe('text/plain')
        expect(options.headers['X-Custom']).toBe('1')
        expect(options.headers.Authorization).toBe('Bearer fake-id-token')
    })

    it('returns the raw Response — callers handle status themselves', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, status: 409, json: async () => ({error: 'Version conflict'})})))

        const res = await apiFetch('/parameters/x', {method: 'PUT'})

        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({error: 'Version conflict'})
    })

    it('requests a fresh token on every call', async () => {
        await apiFetch('/a')
        await apiFetch('/b')

        expect(mockGetIdToken).toHaveBeenCalledTimes(2)
    })

    // auth.currentUser is null when the session has expired or the user signed
    // out in another tab. apiFetch dereferences it unguarded — see note below.
    it('throws when there is no signed-in user', async () => {
        const {auth} = await import('@/firebase.js')
        auth.currentUser = null

        await expect(apiFetch('/parameters')).rejects.toThrow()

        auth.currentUser = {getIdToken: mockGetIdToken}
    })
})
