import {describe, it, expect, vi} from 'vitest'
import {requireApiToken} from '../../middleware/requireApiToken.js'

// tests/setup.js sets this before any test file is imported.
const TOKEN = 'test-api-token'

function mockReq(authorization){
    return {headers: authorization === undefined ? {} : {authorization}}
}

function mockRes(){
    const res = {}
    res.status = vi.fn(() => res)   // chainable: res.status(401).json(...)
    res.json = vi.fn(() => res)
    return res
}

describe('requireApiToken', () => {
    it('sanity: setup.js supplied the expected token', () => {
        expect(process.env.API_TOKEN).toBe(TOKEN)
    })

    it('calls next() on a matching Bearer token', () => {
        const res = mockRes()
        const next = vi.fn()

        requireApiToken(mockReq(`Bearer ${TOKEN}`), res, next)

        expect(next).toHaveBeenCalledOnce()
        expect(res.status).not.toHaveBeenCalled()
    })

    it.each([
        ['a wrong token',              `Bearer wrong-token`],
        ['a much longer wrong token',  `Bearer ${'x'.repeat(500)}`],
        ['a much shorter wrong token', 'Bearer x'],
        ['a missing header',           undefined],
        ['an empty header',            ''],
        ['a non-Bearer scheme',        `Basic ${TOKEN}`],
        ['a lowercase scheme',         `bearer ${TOKEN}`],
        ['no space after Bearer',      `Bearer${TOKEN}`],
        ['an empty token',             'Bearer '],
        ['a trailing space',           `Bearer ${TOKEN} `],
    ])('rejects %s with 401', (_label, authorization) => {
        const res = mockRes()
        const next = vi.fn()

        requireApiToken(mockReq(authorization), res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({error: 'Invalid or missing API token'})
        expect(next).not.toHaveBeenCalled()
    })
})
