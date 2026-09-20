import {describe, it, expect} from 'vitest'
import {normalizeCountry, resolveValue} from '../../lib/country.js'

describe('normalizeCountry', () => {
    it('uppercases a valid two-letter code', () => {
        expect(normalizeCountry('tr')).toBe('TR')
        expect(normalizeCountry('Tr')).toBe('TR')
        expect(normalizeCountry('TR')).toBe('TR')
    })

    it('trims surrounding whitespace', () => {
        expect(normalizeCountry('  tr  ')).toBe('TR')
    })

    it('rejects codes that are not exactly two letters', () => {
        expect(normalizeCountry('TUR')).toBeNull()
        expect(normalizeCountry('T')).toBeNull()
        expect(normalizeCountry('')).toBeNull()
        expect(normalizeCountry('   ')).toBeNull()
    })

    it('rejects codes containing non-letters', () => {
        expect(normalizeCountry('T1')).toBeNull()
        expect(normalizeCountry('t r')).toBeNull()
        expect(normalizeCountry('T-')).toBeNull()
    })

    it('rejects non-strings', () => {
        expect(normalizeCountry(null)).toBeNull()
        expect(normalizeCountry(undefined)).toBeNull()
        expect(normalizeCountry(42)).toBeNull()
        expect(normalizeCountry({})).toBeNull()
    })
})

describe('resolveValue', () => {
    const param = {
        value: 'default',
        countryOverrides: {
            TR: {value: 'turkish'},
            US: {value: 'american'}
        }
    }

    it('returns the default when no country is given', () => {
        expect(resolveValue(param, undefined)).toBe('default')
        expect(resolveValue(param, null)).toBe('default')
        expect(resolveValue(param, '')).toBe('default')
    })

    it('returns the override for a country that has one', () => {
        expect(resolveValue(param, 'TR')).toBe('turkish')
        expect(resolveValue(param, 'US')).toBe('american')
    })

    it('falls back to the default for a country with no override', () => {
        expect(resolveValue(param, 'DE')).toBe('default')
    })

    it('falls back to the default when the param has no overrides at all', () => {
        expect(resolveValue({value: 'default'}, 'TR')).toBe('default')
        expect(resolveValue({value: 'default', countryOverrides: {}}, 'TR')).toBe('default')
    })

    // The reason resolveValue tests `'value' in override` rather than truthiness.
    // A naive `override?.value || param.value` passes every other test in this
    // file and fails all three of these.
    it('returns falsy override values rather than falling through to the default', () => {
        expect(resolveValue({value: true, countryOverrides: {TR: {value: false}}}, 'TR')).toBe(false)
        expect(resolveValue({value: 10, countryOverrides: {TR: {value: 0}}}, 'TR')).toBe(0)
        expect(resolveValue({value: 'x', countryOverrides: {TR: {value: ''}}}, 'TR')).toBe('')
    })

    it('falls back to the default when the override object has no value key', () => {
        const stripped = {value: 'default', countryOverrides: {TR: {updatedBy: 'someone@example.com'}}}
        expect(resolveValue(stripped, 'TR')).toBe('default')
    })

    // resolveValue does NOT normalize — callers must do it first. configController
    // calls normalizeCountry() before this, and that ordering is load-bearing.
    it('is case-sensitive: an unnormalized code misses the override', () => {
        expect(resolveValue(param, 'tr')).toBe('default')
        expect(resolveValue(param, normalizeCountry('tr'))).toBe('turkish')
    })
})
