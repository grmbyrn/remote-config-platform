import {describe, it, expect, vi, beforeEach} from 'vitest'

const {mockGetCurrentUser} = vi.hoisted(() => ({mockGetCurrentUser: vi.fn()}))

vi.mock('../../firebase.js', () => ({
    auth: {currentUser: null},
    getCurrentUser: mockGetCurrentUser
}))

const {authGuard} = await import('../index.js')

const PARAMETERS = {name: 'parameters', meta: {requiresAuth: true}}
const SIGNIN = {name: 'signin', meta: {}}
const USER = {email: 'tester@example.com'}

beforeEach(() => {
    mockGetCurrentUser.mockReset()
})

describe('authGuard', () => {
    it('redirects an anonymous visitor away from a protected route', async () => {
        mockGetCurrentUser.mockResolvedValue(null)

        expect(await authGuard(PARAMETERS)).toEqual({name: 'signin'})
    })

    it('lets a signed-in user through to a protected route', async () => {
        mockGetCurrentUser.mockResolvedValue(USER)

        expect(await authGuard(PARAMETERS)).toBeUndefined()
    })

    it('bounces a signed-in user away from signin', async () => {
        mockGetCurrentUser.mockResolvedValue(USER)

        expect(await authGuard(SIGNIN)).toEqual({name: 'parameters'})
    })

    it('lets an anonymous visitor reach signin', async () => {
        mockGetCurrentUser.mockResolvedValue(null)

        expect(await authGuard(SIGNIN)).toBeUndefined()
    })

    it('resolves the auth state on every call', async () => {
        mockGetCurrentUser.mockResolvedValue(USER)

        await authGuard(PARAMETERS)
        await authGuard(SIGNIN)

        expect(mockGetCurrentUser).toHaveBeenCalledTimes(2)
    })
})
