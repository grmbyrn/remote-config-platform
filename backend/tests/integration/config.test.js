import {describe, it, expect, beforeAll, beforeEach, vi} from 'vitest'
import request from 'supertest'
import {clearFirestore} from '../helpers/firestore.js'
import {db} from '../../services/firestore.js'
import {startConfigListener} from '../../services/config.js'
import {createApp} from '../../app.js'

const app = createApp()
const TOKEN = process.env.API_TOKEN

// The Firestore listener is module-level singleton state in services/config.js.
// Start it once for the file; fileParallelism:false keeps it out of other files.
beforeAll(async () => {
    await startConfigListener()
})

beforeEach(clearFirestore)

function get(query = ''){
    return request(app).get(`/config${query}`).set('Authorization', `Bearer ${TOKEN}`)
}

async function seed(key, data){
    await db.collection('parameters').doc(key).set({type: 'string', version: 1, ...data})
}

// /config reads an in-memory snapshot kept live by a Firestore listener, so it
// is eventually consistent. Never assert straight after a write — poll.
function waitForConfig(assertion){
    return vi.waitFor(assertion, {timeout: 5000, interval: 50})
}

describe('GET /config — authentication', () => {
    it.each([
        ['no Authorization header', undefined],
        ['an empty header',         ''],
        ['a wrong token',           'Bearer wrong-token'],
        ['a non-Bearer scheme',     `Basic ${TOKEN}`],
    ])('returns 401 with %s', async (_label, authorization) => {
        const req = request(app).get('/config')
        if(authorization !== undefined) req.set('Authorization', authorization)

        const res = await req

        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Invalid or missing API token')
    })

    it('accepts the configured API token', async () => {
        const res = await get()

        expect(res.status).toBe(200)
    })
})

describe('GET /config — serving', () => {
    it('serves an empty object when there are no parameters', async () => {
        await waitForConfig(async () => {
            const res = await get()
            expect(res.body).toEqual({})
        })
    })

    it('serves default values keyed by parameter key', async () => {
        await seed('latestVersion', {value: '2.1'})
        await seed('minVersion', {value: '1.0'})

        await waitForConfig(async () => {
            const res = await get()
            expect(res.body).toEqual({latestVersion: '2.1', minVersion: '1.0'})
        })
    })

    // The in-memory config holds only value + countryOverrides; everything else
    // stays server-side. A mobile client must never see descriptions or versions.
    it('exposes only values — no type, description, version or suggestions', async () => {
        await seed('latestVersion', {
            value: '2.1',
            description: 'internal note',
            version: 7,
            suggestions: {TR: {value: 'x', status: 'pending'}}
        })

        await waitForConfig(async () => {
            const res = await get()
            expect(res.body).toEqual({latestVersion: '2.1'})
        })
    })

    it('preserves non-string types', async () => {
        await seed('aNumber',  {type: 'number',  value: 42})
        await seed('aBoolean', {type: 'boolean', value: false})

        await waitForConfig(async () => {
            const res = await get()
            expect(res.body.aNumber).toBe(42)
            expect(res.body.aBoolean).toBe(false)
        })
    })

    it('reflects a deletion', async () => {
        await seed('latestVersion', {value: '2.1'})
        await waitForConfig(async () => {
            expect((await get()).body).toHaveProperty('latestVersion')
        })

        await db.collection('parameters').doc('latestVersion').delete()

        await waitForConfig(async () => {
            expect((await get()).body).not.toHaveProperty('latestVersion')
        })
    })

    it('reflects an updated value', async () => {
        await seed('latestVersion', {value: '2.1'})
        await waitForConfig(async () => {
            expect((await get()).body.latestVersion).toBe('2.1')
        })

        await db.collection('parameters').doc('latestVersion').update({value: '3.0'})

        await waitForConfig(async () => {
            expect((await get()).body.latestVersion).toBe('3.0')
        })
    })
})

describe('GET /config — country resolution', () => {
    beforeEach(async () => {
        await seed('latestVersion', {
            value: '2.1',
            countryOverrides: {
                TR: {value: '2.0-tr'},
                US: {value: '2.5-us'}
            }
        })
        await waitForConfig(async () => {
            expect((await get()).body).toHaveProperty('latestVersion')
        })
    })

    it('serves the default when no country is given', async () => {
        const res = await get()

        expect(res.body.latestVersion).toBe('2.1')
    })

    it('serves the override for a country that has one', async () => {
        expect((await get('?country=TR')).body.latestVersion).toBe('2.0-tr')
        expect((await get('?country=US')).body.latestVersion).toBe('2.5-us')
    })

    it('normalizes a lowercase country code', async () => {
        const res = await get('?country=tr')

        expect(res.body.latestVersion).toBe('2.0-tr')
    })

    it('falls back to the default for a country with no override', async () => {
        const res = await get('?country=DE')

        expect(res.body.latestVersion).toBe('2.1')
    })

    it.each([
        ['three letters', 'TUR'],
        ['one letter',    'T'],
        ['digits',        'T1'],
        ['empty',         ''],
    ])('falls back to the default for an invalid country code with %s', async (_label, country) => {
        const res = await get(`?country=${country}`)

        expect(res.status).toBe(200)
        expect(res.body.latestVersion).toBe('2.1')
    })

    it('resolves each parameter independently', async () => {
        await seed('minVersion', {value: '1.0'})
        await waitForConfig(async () => {
            expect((await get()).body).toHaveProperty('minVersion')
        })

        const res = await get('?country=TR')

        expect(res.body).toEqual({latestVersion: '2.0-tr', minVersion: '1.0'})
    })

    // Pairs with the resolveValue falsy tests in tests/unit/country.test.js.
    it('serves a falsy override rather than the default', async () => {
        await seed('featureFlag', {
            type: 'boolean',
            value: true,
            countryOverrides: {TR: {value: false}}
        })
        await waitForConfig(async () => {
            expect((await get()).body).toHaveProperty('featureFlag')
        })

        expect((await get('?country=TR')).body.featureFlag).toBe(false)
        expect((await get()).body.featureFlag).toBe(true)
    })
})
