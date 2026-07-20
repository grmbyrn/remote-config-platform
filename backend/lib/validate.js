export function isValidValue(type, value){
    switch(type){
        case 'string': return typeof value === 'string'
        case 'number': return typeof value === 'number' && Number.isFinite(value)
        case 'boolean': return typeof value === 'boolean'
        case 'json':
            if(typeof value !== 'string') return false
            try { JSON.parse(value); return true } catch { return false }
        default: return false
    }
}