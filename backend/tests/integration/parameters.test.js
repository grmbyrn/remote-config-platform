import {describe, it, expect, beforeEach, vi} from 'vitest'
import request from 'supertest'
import {clearFirestore} from '../helpers/firestore.js'

// Replace Firebase auth with a stub that injects a known identity. Minting real
// ID tokens would test Google's code, not ours — the middleware itself is
// covered properly in tests/unit/requireFirebaseAuth.test.js.
vi.mock('../../middleware/requireFirebaseAuth.js', () => ({
    requireFirebaseAuth: (req, res, next) => {
        req.user = {email: 'tester@example.com'}
        next()
    }
}))

// Dynamic import so app.js (and the router that binds the middleware at import
// time) is evaluated AFTER the mock above is registered.
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

beforeEach(clearFirestore)

describe('POST /parameters', () => {
    it('creates a parameter at version 1', async () => {
        const res = await request(app).post('/parameters').send(valid)

        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({
            key: 'latestVersion',
            value: '2.1',
            type: 'string',
            description: 'Latest version of the app.',
            version: 1
        })
    })

    it('persists the parameter so it comes back from GET', async () => {
        await create()

        const res = await request(app).get('/parameters')

        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0]).toMatchObject({key: 'latestVersion', value: '2.1', version: 1})
        expect(res.body[0].createdAt).toEqual(expect.any(String))
    })

    it('accepts each valid type', async () => {
        const cases = [
            {key: 'aString',  type: 'string',  value: 'hello'},
            {key: 'aNumber',  type: 'number',  value: 42},
            {key: 'aBoolean', type: 'boolean', value: false},
            {key: 'aJson',    type: 'json',    value: '{"a":1}'}
        ]

        for(const body of cases){
            const res = await request(app).post('/parameters').send(body)
            expect(res.status, `${body.type} should be accepted`).toBe(201)
            expect(res.body.value).toEqual(body.value)
        }
    })

    it('rejects a duplicate key with 409', async () => {
        await request(app).post('/parameters').send(valid)

        const res = await request(app).post('/parameters').send(valid)

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/already exists/)
    })

    // Regression test for the rejectSuggestion.status bug: this path returned an
    // opaque 500 because the handler called .status() on an imported service fn.
    it('rejects an invalid key with 400, not 500', async () => {
        const res = await request(app).post('/parameters').send({...valid, key: '1bad'})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/key must be/)
    })

    it('rejects an unknown type with 400', async () => {
        const res = await request(app).post('/parameters').send({...valid, type: 'date'})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/type must be one of/)
    })

    it.each([
        ['a numeric string under type number', {type: 'number',  value: '42'}],
        ['a string under type boolean',        {type: 'boolean', value: 'true'}],
        ['malformed JSON under type json',     {type: 'json',    value: '{oops}'}],
    ])('rejects %s with 400', async (_label, override) => {
        const res = await request(app).post('/parameters').send({...valid, ...override})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/does not match type/)
    })

    it('rejects an empty string value with a specific message', async () => {
        const res = await request(app).post('/parameters').send({...valid, value: '   '})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('Value cannot be empty')
    })

    it('rejects a description over 500 characters with 400', async () => {
        const res = await request(app).post('/parameters').send({...valid, description: 'x'.repeat(501)})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/at most 500 characters/)
    })

    it('accepts exactly 500 characters', async () => {
        const res = await request(app).post('/parameters').send({...valid, description: 'x'.repeat(500)})

        expect(res.status).toBe(201)
    })

    // Regression test for the create-without-description 500. Firestore rejects
    // undefined field values unless db.settings({ignoreUndefinedProperties:true})
    // is set — which it is, in services/firestore.js. Removing that line breaks this.
    it('creates a parameter with no description at all', async () => {
        const {description, ...noDescription} = valid

        const res = await request(app).post('/parameters').send(noDescription)

        expect(res.status).toBe(201)
        expect(res.body).not.toHaveProperty('description')

        const list = await request(app).get('/parameters')
        expect(list.body[0]).not.toHaveProperty('description')
    })
})

describe('PUT /parameters/:key', () => {
    it('updates the value, bumps the version, and records who did it', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion')
            .send({value: '3.0', expectedVersion: 1})

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({
            key: 'latestVersion',
            value: '3.0',
            version: 2,
            updatedBy: 'tester@example.com'
        })
        expect(res.body.updatedAt).toEqual(expect.any(String))
    })

    it('persists the update', async () => {
        await create()
        await request(app).put('/parameters/latestVersion').send({value: '3.0', expectedVersion: 1})

        const list = await request(app).get('/parameters')

        expect(list.body[0]).toMatchObject({value: '3.0', version: 2})
    })

    it('increments the version on each successive update', async () => {
        await create()

        const second = await request(app).put('/parameters/latestVersion').send({value: 'b', expectedVersion: 1})
        const third  = await request(app).put('/parameters/latestVersion').send({value: 'c', expectedVersion: 2})

        expect(second.body.version).toBe(2)
        expect(third.body.version).toBe(3)
    })

    // The core of the optimistic-locking story: a stale write is refused, and the
    // 409 carries the current state so the client can show a real diff and retry.
    it('refuses a stale write with 409 and returns the current state', async () => {
        await create()
        await request(app).put('/parameters/latestVersion').send({value: 'winner', expectedVersion: 1})

        const stale = await request(app)
            .put('/parameters/latestVersion')
            .send({value: 'loser', expectedVersion: 1})

        expect(stale.status).toBe(409)
        expect(stale.body.error).toBe('Version conflict')
        expect(stale.body.current).toMatchObject({
            value: 'winner',
            version: 2,
            updatedBy: 'tester@example.com'
        })
    })

    it('leaves the stored value untouched after a rejected write', async () => {
        await create()
        await request(app).put('/parameters/latestVersion').send({value: 'winner', expectedVersion: 1})
        await request(app).put('/parameters/latestVersion').send({value: 'loser', expectedVersion: 1})

        const list = await request(app).get('/parameters')

        expect(list.body[0].value).toBe('winner')
        expect(list.body[0].version).toBe(2)
    })

    it('returns 404 for a key that does not exist', async () => {
        const res = await request(app)
            .put('/parameters/nope')
            .send({value: 'x', expectedVersion: 1})

        expect(res.status).toBe(404)
        expect(res.body.error).toMatch(/not found/i)
    })

    it.each([
        ['value is missing',           {expectedVersion: 1}],
        ['expectedVersion is missing', {value: 'x'}],
    ])('returns 400 when %s', async (_label, body) => {
        await create()

        const res = await request(app).put('/parameters/latestVersion').send(body)

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('value and expectedVersion are required')
    })

    it.each([
        ['a non-numeric string', 'abc'],
        ['a fractional number',  1.5],
    ])('returns 400 when expectedVersion is %s', async (_label, expectedVersion) => {
        await create()

        const res = await request(app).put('/parameters/latestVersion').send({value: 'x', expectedVersion})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('expectedVersion must be an integer')
    })

    // Number('1') === 1, so a stringified version is coerced rather than rejected.
    // That's deliberate — form inputs and query params arrive as strings.
    it('accepts a stringified expectedVersion', async () => {
        await create()

        const res = await request(app).put('/parameters/latestVersion').send({value: 'x', expectedVersion: '1'})

        expect(res.status).toBe(200)
        expect(res.body.version).toBe(2)
    })

    // The type is read from the STORED document, never from the request body.
    it('validates the new value against the stored type', async () => {
        await create({key: 'aNumber', type: 'number', value: 1})

        const res = await request(app).put('/parameters/aNumber').send({value: 'not-a-number', expectedVersion: 1})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/does not match type 'number'/)
    })

    it('ignores a type sent in the body — type is immutable after creation', async () => {
        await create()

        const res = await request(app)
            .put('/parameters/latestVersion')
            .send({value: '3.0', expectedVersion: 1, type: 'number'})

        expect(res.status).toBe(200)
        expect(res.body.type).toBe('string')
    })

    describe('description', () => {
        it('updates when supplied', async () => {
            await create()

            const res = await request(app)
                .put('/parameters/latestVersion')
                .send({value: '3.0', description: 'Updated text', expectedVersion: 1})

            expect(res.status).toBe(200)
            expect(res.body.description).toBe('Updated text')
        })

        it('is preserved when omitted, not wiped', async () => {
            await create()

            const res = await request(app)
                .put('/parameters/latestVersion')
                .send({value: '3.0', expectedVersion: 1})

            expect(res.body.description).toBe('Latest version of the app.')
        })

        it('can be edited alone, and still bumps the version', async () => {
            await create()

            const res = await request(app)
                .put('/parameters/latestVersion')
                .send({value: '2.1', description: 'Just the description', expectedVersion: 1})

            expect(res.status).toBe(200)
            expect(res.body.description).toBe('Just the description')
            expect(res.body.version).toBe(2)
        })

        it('rejects one over 500 characters with 400', async () => {
            await create()

            const res = await request(app)
                .put('/parameters/latestVersion')
                .send({value: '3.0', description: 'x'.repeat(501), expectedVersion: 1})

            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/at most 500 characters/)
        })
    })
})
describe('DELETE /parameters/:key', () => {
    it('deletes an existing parameter with 204 and no body', async () => {
        await create()

        const res = await request(app).delete('/parameters/latestVersion')

        expect(res.status).toBe(204)
        expect(res.text).toBe('')
    })

    it('actually removes it', async () => {
        await create()
        await request(app).delete('/parameters/latestVersion')

        const list = await request(app).get('/parameters')

        expect(list.body).toHaveLength(0)
    })

    it('returns 404 for a key that does not exist', async () => {
        const res = await request(app).delete('/parameters/nope')

        expect(res.status).toBe(404)
        expect(res.body.error).toMatch(/not found/i)
    })

    it('returns 404 on a second delete', async () => {
        await create()
        await request(app).delete('/parameters/latestVersion')

        const res = await request(app).delete('/parameters/latestVersion')

        expect(res.status).toBe(404)
    })

    // DELETE takes no expectedVersion — a documented tradeoff, not an oversight.
    // If you add version-checking later (roadmap stretch item), this flips to 409.
    it('does not require a version', async () => {
        await create()
        await request(app).put('/parameters/latestVersion').send({value: 'x', expectedVersion: 1})

        const res = await request(app).delete('/parameters/latestVersion')

        expect(res.status).toBe(204)
    })
})
