import {describe, it, expect, beforeEach, vi} from 'vitest'
import request from 'supertest'
import {clearFirestore} from '../helpers/firestore.js'

vi.mock('../../middleware/requireFirebaseAuth.js', () => ({
    requireFirebaseAuth: (req, res, next) => {
        req.user = {email: 'tester@example.com'}
        next()
    }
}))

const {createApp} = await import('../../app.js')
const app = createApp()

const valid = {
    key: 'latestVersion',
    value: '2.1',
    type: 'string',
    description: 'Latest version of the app.'
}

async function create(overrides = {}){
    const res = await request(app).post('/parameters').send({...valid, ...overrides})
    expect(res.status).toBe(201)
    return res.body
}

async function stored(key = 'latestVersion'){
    const list = await request(app).get('/parameters')
    return list.body.find(p => p.key === key)
}

beforeEach(clearFirestore)

describe('PUT /parameters/:key/overrides/:country', () => {
    it('sets an override and bumps the parent version', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/TR')
            .send({value: '2.0-tr', expectedVersion: 1})

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({
            key: 'latestVersion',
            country: 'TR',
            value: '2.0-tr',
            version: 2,
            updatedBy: 'tester@example.com'
        })
    })

    it('stores the override under the parameter, leaving the default intact', async () => {
        await create()
        await request(app).put('/parameters/latestVersion/overrides/TR').send({value: '2.0-tr', expectedVersion: 1})

        const param = await stored()

        expect(param.value).toBe('2.1')
        expect(param.countryOverrides.TR).toMatchObject({
            value: '2.0-tr',
            updatedBy: 'tester@example.com'
        })
        expect(param.countryOverrides.TR.updatedAt).toEqual(expect.any(String))
    })

    it('normalizes a lowercase country code to uppercase', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/tr')
            .send({value: '2.0-tr', expectedVersion: 1})

        expect(res.body.country).toBe('TR')

        const param = await stored()
        expect(param.countryOverrides).toHaveProperty('TR')
        expect(param.countryOverrides).not.toHaveProperty('tr')
    })

    it('holds several country overrides at once', async () => {
        await create()
        await request(app).put('/parameters/latestVersion/overrides/TR').send({value: 'tr', expectedVersion: 1})
        await request(app).put('/parameters/latestVersion/overrides/US').send({value: 'us', expectedVersion: 2})

        const param = await stored()

        expect(param.countryOverrides.TR.value).toBe('tr')
        expect(param.countryOverrides.US.value).toBe('us')
        expect(param.version).toBe(3)
    })

    it('overwrites an existing override for the same country', async () => {
        await create()
        await request(app).put('/parameters/latestVersion/overrides/TR').send({value: 'first', expectedVersion: 1})
        await request(app).put('/parameters/latestVersion/overrides/TR').send({value: 'second', expectedVersion: 2})

        const param = await stored()

        expect(param.countryOverrides.TR.value).toBe('second')
        expect(Object.keys(param.countryOverrides)).toEqual(['TR'])
    })

    // Pairs with the resolveValue falsy test in tests/unit/country.test.js:
    // a boolean flag turned off for one country must survive the round trip.
    it('stores a falsy override value', async () => {
        await create({key: 'featureFlag', type: 'boolean', value: true})

        const res = await request(app)
            .put('/parameters/featureFlag/overrides/TR')
            .send({value: false, expectedVersion: 1})

        expect(res.status).toBe(200)

        const param = await stored('featureFlag')
        expect(param.value).toBe(true)
        expect(param.countryOverrides.TR.value).toBe(false)
    })

    // The type comes from the stored parent document, not the request.
    it('validates the override value against the parent type', async () => {
        await create({key: 'aNumber', type: 'number', value: 1})

        const res = await request(app)
            .put('/parameters/aNumber/overrides/TR')
            .send({value: 'not-a-number', expectedVersion: 1})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/does not match type 'number'/)
    })

    it('rejects an empty string override on a string parameter', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/TR')
            .send({value: '   ', expectedVersion: 1})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('Value cannot be empty')
    })

    it('rejects a missing value', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/TR')
            .send({expectedVersion: 1})

        expect(res.status).toBe(400)
    })

    it.each([
        ['three letters', 'TUR'],
        ['one letter',    'T'],
        ['digits',        'T1'],
    ])('rejects a country code with %s', async (_label, country) => {
        await create()

        const res = await request(app)
            .put(`/parameters/latestVersion/overrides/${country}`)
            .send({value: 'x', expectedVersion: 1})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('country must be a two-letter code')
    })

    it('rejects a non-integer expectedVersion', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/TR')
            .send({value: 'x', expectedVersion: 'abc'})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('expectedVersion must be an integer')
    })

    it('refuses a stale write with 409 and returns the current state', async () => {
        await create()
        await request(app).put('/parameters/latestVersion').send({value: 'moved-on', expectedVersion: 1})

        const res = await request(app)
            .put('/parameters/latestVersion/overrides/TR')
            .send({value: 'x', expectedVersion: 1})

        expect(res.status).toBe(409)
        expect(res.body.error).toBe('Version conflict')
        expect(res.body.current).toMatchObject({value: 'moved-on', version: 2})
    })

    it('returns 404 for a parameter that does not exist', async () => {
        const res = await request(app)
            .put('/parameters/nope/overrides/TR')
            .send({value: 'x', expectedVersion: 1})

        expect(res.status).toBe(404)
    })
})

describe('DELETE /parameters/:key/overrides/:country', () => {
    async function withOverride(){
        await create()
        await request(app).put('/parameters/latestVersion/overrides/TR').send({value: '2.0-tr', expectedVersion: 1})
    }

    it('removes the override and bumps the version', async () => {
        await withOverride()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/TR')
            .send({expectedVersion: 2})

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({key: 'latestVersion', country: 'TR', version: 3})
    })

    // FieldValue.delete() removes the key entirely. A null or undefined left
    // behind would still be truthy-checked by resolveValue's `'value' in override`.
    it('removes the key entirely rather than nulling it', async () => {
        await withOverride()
        await request(app).delete('/parameters/latestVersion/overrides/TR').send({expectedVersion: 2})

        const param = await stored()

        expect(param.countryOverrides).not.toHaveProperty('TR')
        expect(param.value).toBe('2.1')
    })

    it('leaves other countries untouched', async () => {
        await withOverride()
        await request(app).put('/parameters/latestVersion/overrides/US').send({value: 'us', expectedVersion: 2})

        await request(app).delete('/parameters/latestVersion/overrides/TR').send({expectedVersion: 3})

        const param = await stored()
        expect(param.countryOverrides).not.toHaveProperty('TR')
        expect(param.countryOverrides.US.value).toBe('us')
    })

    it('normalizes the country code', async () => {
        await withOverride()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/tr')
            .send({expectedVersion: 2})

        expect(res.status).toBe(200)
        expect(res.body.country).toBe('TR')
    })

    it('rejects an invalid country code', async () => {
        await withOverride()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/TUR')
            .send({expectedVersion: 2})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('country must be a two-letter code')
    })

    it('rejects a non-integer expectedVersion', async () => {
        await withOverride()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/TR')
            .send({expectedVersion: 'abc'})

        expect(res.status).toBe(400)
    })

    it('refuses a stale delete with 409', async () => {
        await withOverride()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/TR')
            .send({expectedVersion: 1})

        expect(res.status).toBe(409)
        expect(res.body.current).toMatchObject({version: 2})
    })

    it('returns 404 for a parameter that does not exist', async () => {
        const res = await request(app)
            .delete('/parameters/nope/overrides/TR')
            .send({expectedVersion: 1})

        expect(res.status).toBe(404)
    })

    // FieldValue.delete() on an absent field is a no-op, so this succeeds and
    // still bumps the version. Documenting the behaviour, not endorsing it —
    // a 404 would arguably be more honest.
    it('succeeds when the override never existed', async () => {
        await create()

        const res = await request(app)
            .delete('/parameters/latestVersion/overrides/DE')
            .send({expectedVersion: 1})

        expect(res.status).toBe(200)
        expect(res.body.version).toBe(2)
    })
})
