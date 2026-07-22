import {createHash, timingSafeEqual} from 'node:crypto'

function safeEqual(a,b) {
    const ha = createHash('sha256').update(a).digest()
    const hb = createHash('sha256').update(b).digest()
    return timingSafeEqual(ha, hb)
}

export function requireApiToken(req, res, next){
    const expected = process.env.API_TOKEN
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if(!token || !safeEqual(token, expected)){
        return res.status(401).json({error: 'Invalid or missing API token'})
    }

    next()
}