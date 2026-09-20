import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
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

// Stub the Anthropic call. MUST be called inside a test body, never in
// beforeEach — clearFirestore() uses fetch too, and would hit this stub.
function mockAnthropic(text, {model = 'claude-haiku-4-5', ok = true, status = 200} = {}){
    const fn = vi.fn(async () => ({
        ok,
        status,
        json: async () => ({model, content: [{type: 'text', text}]})
    }))
    vi.stubGlobal('fetch', fn)
    return fn
}

async function suggest(countries, key = 'latestVersion'){
    return request(app).post(`/parameters/${key}/suggestions`).send({countries})
}

beforeEach(async () => {
    await clearFirestore()          // real fetch — before any stubbing
    process.env.ANTHROPIC_API_KEY = 'test-key'
})

afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ANTHROPIC_API_KEY
})

describe('POST /parameters/:key/suggestions', () => {
    it.each([
        ['missing',      undefined],
        ['not an array', 'TR'],
        ['empty',        []],
    ])('returns 400 when countries is %s', async (_label, countries) => {
        await create()

        const res = await suggest(countries)

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('countries must be a non-empty array')
    })

    it('returns 404 for a parameter that does not exist', async () => {
        const res = await suggest(['TR'], 'nope')

        expect(res.status).toBe(404)
    })

    it('returns 500 when no API key is configured', async () => {
        delete process.env.ANTHROPIC_API_KEY
        await create()

        const res = await suggest(['TR'])

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('AI suggestions are not configured')
    })

    it('saves suggestions as pending, with model and timestamp', async () => {
        await create()
        mockAnthropic(JSON.stringify({TR: '2.0-tr', DE: '2.2-de'}))

        const res = await suggest(['TR', 'DE'])

        expect(res.status).toBe(200)
        expect(res.body.suggestions.TR).toMatchObject({value: '2.0-tr', status: 'pending', model: 'claude-haiku-4-5'})

        const param = await stored()
        expect(param.suggestions.TR).toMatchObject({value: '2.0-tr', status: 'pending'})
        expect(param.suggestions.DE.value).toBe('2.2-de')
        expect(param.suggestions.TR.generatedAt).toEqual(expect.any(String))
    })

    it('does not touch the value, overrides, or version', async () => {
        await create()
        mockAnthropic(JSON.stringify({TR: '2.0-tr'}))

        await suggest(['TR'])

        const param = await stored()
        expect(param.value).toBe('2.1')
        expect(param.version).toBe(1)
        expect(param.countryOverrides).toBeUndefined()
    })

    it('sends the parameter context to Anthropic', async () => {
        await create()
        const fetchMock = mockAnthropic(JSON.stringify({TR: 'x'}))

        await suggest(['TR', 'DE'])

        const [url, options] = fetchMock.mock.calls[0]
        expect(url).toBe('https://api.anthropic.com/v1/messages')
        expect(options.headers['x-api-key']).toBe('test-key')
        expect(options.headers['anthropic-version']).toBe('2023-06-01')

        const body = JSON.parse(options.body)
        expect(body.model).toBe('claude-haiku-4-5')

        const prompt = body.messages[0].content
        expect(prompt).toContain('Value type: string')
        expect(prompt).toContain('TR, DE')
        expect(prompt).toContain('Latest version of the app.')
    })

    // The indexOf('{') / lastIndexOf('}') salvage in services/suggestions.js.
    it.each([
        ['a code fence',   '```json\n{"TR":"2.0-tr"}\n```'],
        ['leading prose',  'Sure! Here you go: {"TR":"2.0-tr"}'],
        ['trailing prose', '{"TR":"2.0-tr"} — let me know if you need more.'],
    ])('extracts JSON wrapped in %s', async (_label, text) => {
        await create()
        mockAnthropic(text)

        const res = await suggest(['TR'])

        expect(res.status).toBe(200)
        expect(res.body.suggestions.TR.value).toBe('2.0-tr')
    })

    // Pins commit fe9238a: un-normalizable codes are dropped, not errored on.
    it('silently drops country codes it cannot normalize', async () => {
        await create()
        mockAnthropic(JSON.stringify({TR: 'ok-tr', TUR: 'bad', X: 'bad', 'T1': 'bad'}))

        const res = await suggest(['TR'])

        expect(res.status).toBe(200)
        expect(Object.keys(res.body.suggestions)).toEqual(['TR'])
    })

    it('lowercases from the model are normalized, not dropped', async () => {
        await create()
        mockAnthropic(JSON.stringify({tr: 'ok-tr'}))

        const res = await suggest(['TR'])

        expect(res.body.suggestions.TR.value).toBe('ok-tr')
    })

    it('drops values that do not match the parameter type', async () => {
        await create({key: 'aNumber', type: 'number', value: 1})
        mockAnthropic(JSON.stringify({TR: 5, DE: 'not-a-number'}), {})

        const res = await suggest(['TR', 'DE'], 'aNumber')

        expect(Object.keys(res.body.suggestions)).toEqual(['TR'])
        expect(res.body.suggestions.TR.value).toBe(5)
    })

    it('regenerating replaces an existing pending suggestion', async () => {
        await create()
        mockAnthropic(JSON.stringify({TR: 'first'}))
        await suggest(['TR'])

        vi.unstubAllGlobals()
        mockAnthropic(JSON.stringify({TR: 'second'}))
        await suggest(['TR'])

        const param = await stored()
        expect(param.suggestions.TR.value).toBe('second')
    })

    it.each([
        ['the request fails',        {text: '{}', opts: {ok: false, status: 500}}],
        ['the model returns prose',  {text: 'I cannot help with that.', opts: {}}],
        ['the model returns no text', {text: undefined, opts: {}}],
    ])('returns 502 when %s', async (_label, {text, opts}) => {
        await create()
        mockAnthropic(text, opts)

        const res = await suggest(['TR'])

        expect(res.status).toBe(502)
        expect(res.body.error).toBe('Suggestion generation failed')
    })

    it('returns an empty result when every suggestion is filtered out', async () => {
        await create()
        mockAnthropic(JSON.stringify({TUR: 'bad', XYZ: 'bad'}))

        const res = await suggest(['TR'])

        expect(res.status).toBe(200)
        expect(res.body.suggestions).toEqual({})

        // No partial write: the document is untouched, not left with an empty
        // suggestions map.
        const param = await stored()
        expect(param.suggestions).toBeUndefined()
        expect(param.version).toBe(1)
    })
})

describe('POST /parameters/:key/suggestions/:country/approve', () => {
    async function seed(body = {TR: '2.0-tr'}, key = 'latestVersion'){
        mockAnthropic(JSON.stringify(body))
        const res = await request(app).post(`/parameters/${key}/suggestions`).send({countries: Object.keys(body)})
        expect(res.status).toBe(200)
        vi.unstubAllGlobals()
    }

    it('writes the override, clears the suggestion, and bumps the version', async () => {
        await create()
        await seed()

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TR/approve')
            .send({expectedVersion: 1})

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({country: 'TR', value: '2.0-tr', version: 2})

        const param = await stored()
        expect(param.countryOverrides.TR).toMatchObject({value: '2.0-tr', updatedBy: 'tester@example.com'})
        expect(param.suggestions).not.toHaveProperty('TR')
    })

    it('approving one country leaves the others pending', async () => {
        await create()
        await seed({TR: 'tr', DE: 'de'})

        await request(app).post('/parameters/latestVersion/suggestions/TR/approve').send({expectedVersion: 1})

        const param = await stored()
        expect(param.suggestions).not.toHaveProperty('TR')
        expect(param.suggestions.DE.value).toBe('de')
        expect(param.countryOverrides).not.toHaveProperty('DE')
    })

    // The human-in-the-loop edit: approve with a corrected value.
    it('uses an explicit value in place of the suggested one', async () => {
        await create()
        await seed()

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TR/approve')
            .send({value: 'human-edited', expectedVersion: 1})

        expect(res.body.value).toBe('human-edited')

        const param = await stored()
        expect(param.countryOverrides.TR.value).toBe('human-edited')
    })

    it('validates an explicit value against the parameter type', async () => {
        await create({key: 'aNumber', type: 'number', value: 1})
        await seed({TR: 5}, 'aNumber')

        const res = await request(app)
            .post('/parameters/aNumber/suggestions/TR/approve')
            .send({value: 'not-a-number', expectedVersion: 1})

        expect(res.status).toBe(400)
    })

    it('returns 404 when there is no pending suggestion for that country', async () => {
        await create()
        await seed()

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/DE/approve')
            .send({expectedVersion: 1})

        expect(res.status).toBe(404)
        expect(res.body.error).toMatch(/No pending suggestion/)
    })

    it('returns 404 for a parameter that does not exist', async () => {
        const res = await request(app)
            .post('/parameters/nope/suggestions/TR/approve')
            .send({expectedVersion: 1})

        expect(res.status).toBe(404)
    })

    it('rejects an invalid country code with 400', async () => {
        await create()

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TUR/approve')
            .send({expectedVersion: 1})

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('country must be a two-letter code')
    })

    it('rejects a non-integer expectedVersion with 400', async () => {
        await create()

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TR/approve')
            .send({expectedVersion: 'abc'})

        expect(res.status).toBe(400)
    })

    it('refuses a stale approval with 409', async () => {
        await create()
        await seed()
        await request(app).put('/parameters/latestVersion').send({value: 'moved-on', expectedVersion: 1})

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TR/approve')
            .send({expectedVersion: 1})

        expect(res.status).toBe(409)
        expect(res.body.current).toMatchObject({version: 2})
    })

    it('cannot approve the same suggestion twice', async () => {
        await create()
        await seed()
        await request(app).post('/parameters/latestVersion/suggestions/TR/approve').send({expectedVersion: 1})

        const res = await request(app)
            .post('/parameters/latestVersion/suggestions/TR/approve')
            .send({expectedVersion: 2})

        expect(res.status).toBe(404)
    })
})

describe('DELETE /parameters/:key/suggestions/:country', () => {
    async function seed(body = {TR: '2.0-tr'}){
        mockAnthropic(JSON.stringify(body))
        await request(app).post('/parameters/latestVersion/suggestions').send({countries: Object.keys(body)})
        vi.unstubAllGlobals()
    }

    it('removes the suggestion without writing an override', async () => {
        await create()
        await seed()

        const res = await request(app).delete('/parameters/latestVersion/suggestions/TR')

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({key: 'latestVersion', country: 'TR'})

        const param = await stored()
        expect(param.suggestions).not.toHaveProperty('TR')
        expect(param.countryOverrides).toBeUndefined()
    })

    it('leaves other countries pending', async () => {
        await create()
        await seed({TR: 'tr', DE: 'de'})

        await request(app).delete('/parameters/latestVersion/suggestions/TR')

        const param = await stored()
        expect(param.suggestions).not.toHaveProperty('TR')
        expect(param.suggestions.DE.value).toBe('de')
    })

    it('does not bump the version — rejection is not an edit', async () => {
        await create()
        await seed()

        await request(app).delete('/parameters/latestVersion/suggestions/TR')

        const param = await stored()
        expect(param.version).toBe(1)
    })

    it('normalizes the country code', async () => {
        await create()
        await seed()

        const res = await request(app).delete('/parameters/latestVersion/suggestions/tr')

        expect(res.body.country).toBe('TR')
    })

    it('rejects an invalid country code with 400', async () => {
        await create()

        const res = await request(app).delete('/parameters/latestVersion/suggestions/TUR')

        expect(res.status).toBe(400)
    })

    it('returns 404 for a parameter that does not exist', async () => {
        const res = await request(app).delete('/parameters/nope/suggestions/TR')

        expect(res.status).toBe(404)
    })
})
