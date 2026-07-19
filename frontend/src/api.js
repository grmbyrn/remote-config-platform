import {auth} from './firebase.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function apiFetch(path, options = {}) {
    const token = await auth.currentUser.getIdToken()

    return fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    })
}