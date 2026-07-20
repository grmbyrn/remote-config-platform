export function normalizeCountry(raw){
    if(typeof raw !== 'string') return null
    const code = raw.trim().toUpperCase()
    return /^[A-Z]{2}$/.test(code) ? code : null
}

export function resolveValue(param, country){
    const override = country && param.countryOverrides?.[country]
    return override && 'value' in override ? override.value : param.value
}