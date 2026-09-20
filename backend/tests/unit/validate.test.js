import {describe, it, expect} from 'vitest'
import {
    isValidValue,
    assertValidValue,
    isValidKey,
    isValidType,
    isValidDescription,
    VALID_TYPES
} from '../../lib/validate.js'

describe('isValidValue', () => {
    describe('string', () => {
        it('accepts a non-empty string', () => {
            expect(isValidValue('string', 'hello')).toBe(true)
        })

        it('rejects empty and whitespace-only strings', () => {
            expect(isValidValue('string', '')).toBe(false)
            expect(isValidValue('string', '   ')).toBe(false)
            expect(isValidValue('string', '\n\t')).toBe(false)
        })

        it('rejects non-strings', () => {
            expect(isValidValue('string', 42)).toBe(false)
            expect(isValidValue('string', null)).toBe(false)
        })
    })

    describe('number', () => {
        it('accepts finite numbers including zero and negatives', () => {
            expect(isValidValue('number', 42)).toBe(true)
            expect(isValidValue('number', 0)).toBe(true)
            expect(isValidValue('number', -1.5)).toBe(true)
        })

        it('rejects NaN and Infinity', () => {
            expect(isValidValue('number', NaN)).toBe(false)
            expect(isValidValue('number', Infinity)).toBe(false)
            expect(isValidValue('number', -Infinity)).toBe(false)
        })

        it('rejects a numeric string', () => {
            expect(isValidValue('number', '42')).toBe(false)
        })
    })

    describe('boolean', () => {
        it('accepts both true and false', () => {
            expect(isValidValue('boolean', true)).toBe(true)
            expect(isValidValue('boolean', false)).toBe(true)
        })

        it('rejects truthy/falsy non-booleans', () => {
            expect(isValidValue('boolean', 'true')).toBe(false)
            expect(isValidValue('boolean', 1)).toBe(false)
            expect(isValidValue('boolean', 0)).toBe(false)
        })
    })

    describe('json', () => {
        it('accepts a JSON-encoded string', () => {
            expect(isValidValue('json', '{"a":1}')).toBe(true)
            expect(isValidValue('json', '[1,2,3]')).toBe(true)
        })

        it('rejects a parsed object — it must be the encoded string', () => {
            expect(isValidValue('json', {a: 1})).toBe(false)
        })

        it('rejects malformed JSON', () => {
            expect(isValidValue('json', '{oops}')).toBe(false)
            expect(isValidValue('json', '')).toBe(false)
        })
    })

    it('rejects an unknown type', () => {
        expect(isValidValue('date', 'anything')).toBe(false)
        expect(isValidValue(undefined, 'anything')).toBe(false)
    })
})

describe('assertValidValue', () => {
    it('does not throw on a valid value', () => {
        expect(() => assertValidValue('number', 42)).not.toThrow()
    })

    it('reports an empty string as empty, not as a type mismatch', () => {
        expect(() => assertValidValue('string', '')).toThrow('Value cannot be empty')
        expect(() => assertValidValue('string', '   ')).toThrow('Value cannot be empty')
    })

    it('reports a non-string under type string as a type mismatch', () => {
        expect(() => assertValidValue('string', 42)).toThrow("does not match type 'string'")
    })

    it('reports other type mismatches with the type name', () => {
        expect(() => assertValidValue('number', 'x')).toThrow("does not match type 'number'")
        expect(() => assertValidValue('json', '{oops}')).toThrow("does not match type 'json'")
    })

    it('tags the error with INVALID_VALUE so controllers can map it to a 400', () => {
        expect(() => assertValidValue('number', 'x')).toThrowError(
            expect.objectContaining({code: 'INVALID_VALUE'})
        )
    })
})

describe('isValidKey', () => {
    it('accepts a single letter and the allowed punctuation', () => {
        expect(isValidKey('a')).toBe(true)
        expect(isValidKey('latestVersion')).toBe(true)
        expect(isValidKey('a.b_c-d')).toBe(true)
    })

    it('accepts exactly 100 characters but not 101', () => {
        expect(isValidKey('a'.repeat(100))).toBe(true)
        expect(isValidKey('a'.repeat(101))).toBe(false)
    })

    it('requires the first character to be a letter', () => {
        expect(isValidKey('1bad')).toBe(false)
        expect(isValidKey('_bad')).toBe(false)
        expect(isValidKey('.bad')).toBe(false)
    })

    it('rejects empty, spaces and non-strings', () => {
        expect(isValidKey('')).toBe(false)
        expect(isValidKey('has space')).toBe(false)
        expect(isValidKey('has/slash')).toBe(false)
        expect(isValidKey(123)).toBe(false)
        expect(isValidKey(null)).toBe(false)
        expect(isValidKey(undefined)).toBe(false)
    })
})

describe('isValidType', () => {
    it('accepts every declared type', () => {
        for(const type of VALID_TYPES){
            expect(isValidType(type)).toBe(true)
        }
    })

    it('rejects unknown types and is case-sensitive', () => {
        expect(isValidType('date')).toBe(false)
        expect(isValidType('String')).toBe(false)
        expect(isValidType(undefined)).toBe(false)
    })
})

describe('isValidDescription', () => {
    it('accepts an empty string and exactly 500 characters', () => {
        expect(isValidDescription('')).toBe(true)
        expect(isValidDescription('x'.repeat(500))).toBe(true)
    })

    it('rejects 501 characters', () => {
        expect(isValidDescription('x'.repeat(501))).toBe(false)
    })

    it('rejects non-strings', () => {
        expect(isValidDescription(123)).toBe(false)
        expect(isValidDescription(null)).toBe(false)
        expect(isValidDescription(undefined)).toBe(false)
    })
})
