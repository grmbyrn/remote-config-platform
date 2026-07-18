import { getAuth } from 'firebase-admin/auth'

export async function requireFirebaseAuth(req, res, next) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer') ? header.slice(7) : null

    if(!token){
        return res.status(401).json({error: 'Missing or malformed Authorization header'})
    }

    try {
        const decoded = await getAuth().verifyIdToken(token)
        req.user = decoded
        next()
    } catch (error) {
        return res.status(401).json({error: 'Invalid or expired token'})
    }
}
