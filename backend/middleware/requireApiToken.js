export function requireApiToken(req, res, next){
    const expected = process.env.API_TOKEN
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null

    if(!token || token !== expected){
        return res.status(401).json({error: 'Invalid or missing API token'})
    }

    next()
}