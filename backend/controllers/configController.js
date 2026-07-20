import { normalizeCountry, resolveValue } from '../lib/country.js'
import {getConfig} from '../services/config.js'

export function getConfigHandler(req, res){
    const country = normalizeCountry(req.query.country)
    const config = getConfig()
    const out = {}
    for(const [key, param] of Object.entries(config)){
        out[key] = resolveValue(param, country)
    }
    res.json(out)
}