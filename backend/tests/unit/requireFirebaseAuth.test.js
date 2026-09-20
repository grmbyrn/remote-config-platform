import {describe, it, expect, vi, beforeEach} from 'vitest'

// vi.mock is hoisted above imports, so the spy must be created in a hoisted
// block — a plain `const` declared below would not exist yet when it runs.
const {mockVerifyIdToken} = vi.hoisted(() => ({mockVerifyIdToken: vi.fn()}))

vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({verifyIdToken: mockVerifyIdToken})
}))

const {requireFirebaseAuth} = await import('../../middleware/requireFirebaseAuth.js')

function mockReq(authorization){
    return {headers: authorization === undefined ? {} : {authorization}}
}

function mockRes(){
    const res = {}
    res.status = vi.fn(() => res)
    res.json = vi.fn(() => res)
    return res
}

beforeEach(() => {
    mockVerifyIdToken.mockReset()
})

describe('requireFirebaseAuth', () => {
    describe('header shape', () => {
        it.each([
            ['a missing header',      undefined],
            ['an empty header',       ''],
            ['a non-Bearer scheme',   'Basic abc'],
            ['a lowercase scheme',    'bearer abc'],
            ['no space after Bearer', 'Bearerabc'],
            ['an empty token',        'Bearer '],
        ])('rejects %s with 401 before calling Firebase', async (_label, authorization) => {
            const res = mockRes()
            const next = vi.fn()

            await requireFirebaseAuth(mockReq(authorization), res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({error: 'Missing or malformed Authorization header'})
            expect(next).not.toHaveBeenCalled()
            expect(mockVerifyIdToken).not.toHaveBeenCalled()
        })
    })

    describe('token verification', () => {
        it('attaches the decoded token to req.user and calls next()', async () => {
            const decoded = {uid: 'abc123', email: 'tester@example.com'}
            mockVerifyIdToken.mockResolvedValue(decoded)

            const req = mockReq('Bearer good-token')
            const res = mockRes()
            const next = vi.fn()

            await requireFirebaseAuth(req, res, next)

            expect(mockVerifyIdToken).toHaveBeenCalledWith('good-token')
            expect(req.user).toEqual(decoded)
            expect(next).toHaveBeenCalledOnce()
            expect(res.status).not.toHaveBeenCalled()
        })

        it('rejects a token Firebase refuses with 401', async () => {
            mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'))

            const res = mockRes()
            const next = vi.fn()

            await requireFirebaseAuth(mockReq('Bearer expired-token'), res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.json).toHaveBeenCalledWith({error: 'Invalid or expired token'})
            expect(next).not.toHaveBeenCalled()
        })

        // req.user.email is the sole source of `updatedBy` on every write — a
        // client can never supply its own identity. This pins that.
        it('takes identity only from the verified token', async () => {
            mockVerifyIdToken.mockResolvedValue({email: 'real@example.com'})

            const req = {...mockReq('Bearer good-token'), user: {email: 'attacker@example.com'}}
            await requireFirebaseAuth(req, mockRes(), vi.fn())

            expect(req.user.email).toBe('real@example.com')
        })
    })
})
