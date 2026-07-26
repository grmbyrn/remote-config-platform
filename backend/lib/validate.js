const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,99}$/
const MAX_DESCRIPTION = 500

export const VALID_TYPES = ['string', 'number', 'boolean', 'json']

export function isValidValue(type, value){
    switch(type){
        case 'string': return typeof value === 'string' && value.trim() !== ''
        case 'number': return typeof value === 'number' && Number.isFinite(value)
        case 'boolean': return typeof value === 'boolean'
        case 'json':
            if(typeof value !== 'string') return false
            try { JSON.parse(value); return true } catch { return false }
        default: return false
    }
}

export function assertValidValue(type, value){
    if(!isValidValue(type, value)){
        const err = new Error(
            type === 'string' && typeof value === 'string'
                ? 'Value cannot be empty'
                : `Value does not match type '${type}'`
        )
        err.code = 'INVALID_VALUE'
        throw err
    }
}

export function isValidKey(key){
    return typeof key === 'string' && KEY_PATTERN.test(key)
}

export function isValidType(type){
    return VALID_TYPES.includes(type)
}

export function isValidDescription(description){
    return typeof description === 'string' && description.length <= MAX_DESCRIPTION
}