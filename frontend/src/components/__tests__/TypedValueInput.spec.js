import {describe, it, expect} from 'vitest'
import {mount} from '@vue/test-utils'
import TypedValueInput from '../TypedValueInput.vue'

function mountInput(props = {}){
    return mount(TypedValueInput, {
        props: {modelValue: undefined, type: 'string', ...props}
    })
}

// Each emit carries one argument; we almost always want the most recent.
function last(wrapper, event){
    const calls = wrapper.emitted(event)
    return calls ? calls[calls.length - 1][0] : undefined
}

function emits(wrapper){
    return {value: last(wrapper, 'update:modelValue'), valid: last(wrapper, 'update:valid')}
}

describe('TypedValueInput — rendering', () => {
    it.each([
        ['string',  'input[type="text"]'],
        ['number',  'input[type="number"]'],
        ['boolean', 'input[type="checkbox"]'],
        ['json',    'textarea'],
    ])('renders %s as %s', (type, selector) => {
        const wrapper = mountInput({type})

        expect(wrapper.find(selector).exists()).toBe(true)
    })

    // The v-if chain in the template is fragile (see 7e) — this pins the
    // invariant that exactly one field is shown, before touching it.
    it.each(['string', 'number', 'boolean', 'json'])('renders exactly one field for %s', (type) => {
        const wrapper = mountInput({type})

        expect(wrapper.findAll('input, textarea')).toHaveLength(1)
    })

    it('renders nothing for an unrecognised type', () => {
        const wrapper = mountInput({type: 'date'})

        expect(wrapper.findAll('input, textarea')).toHaveLength(0)
    })
})

describe('TypedValueInput — seeding on mount', () => {
    it('emits both events once on mount', () => {
        const wrapper = mountInput({modelValue: 'hello'})

        expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
        expect(wrapper.emitted('update:valid')).toHaveLength(1)
    })

    it('seeds a string value', () => {
        const wrapper = mountInput({modelValue: '2.1', type: 'string'})

        expect(emits(wrapper)).toEqual({value: '2.1', valid: true})
    })

    it('seeds a number value', () => {
        const wrapper = mountInput({modelValue: 42, type: 'number'})

        expect(emits(wrapper)).toEqual({value: 42, valid: true})
    })

    it('seeds zero as a valid number', () => {
        const wrapper = mountInput({modelValue: 0, type: 'number'})

        expect(emits(wrapper)).toEqual({value: 0, valid: true})
    })

    it.each([true, false])('seeds boolean %s', (modelValue) => {
        const wrapper = mountInput({modelValue, type: 'boolean'})

        expect(emits(wrapper)).toEqual({value: modelValue, valid: true})
    })

    it('seeds a json value', () => {
        const wrapper = mountInput({modelValue: '{"a":1}', type: 'json'})

        expect(emits(wrapper)).toEqual({value: '{"a":1}', valid: true})
    })

    it('treats null and undefined as empty', () => {
        expect(emits(mountInput({modelValue: null}))).toEqual({value: '', valid: false})
        expect(emits(mountInput({modelValue: undefined}))).toEqual({value: '', valid: false})
    })
})

describe('TypedValueInput — validity', () => {
    describe('string', () => {
        it.each([
            ['accepts a value',         'hello', true],
            ['rejects empty',           '',      false],
            ['rejects whitespace only', '   ',   false],
        ])('%s', async (_label, input, valid) => {
            const wrapper = mountInput({type: 'string'})
            await wrapper.find('input').setValue(input)

            expect(last(wrapper, 'update:valid')).toBe(valid)
        })
    })

    describe('number', () => {
        it('accepts a numeric string and emits it as a Number', async () => {
            const wrapper = mountInput({type: 'number'})
            await wrapper.find('input').setValue('42')

            expect(emits(wrapper)).toEqual({value: 42, valid: true})
        })

        it('accepts a negative and a decimal', async () => {
            const wrapper = mountInput({type: 'number'})

            await wrapper.find('input').setValue('-1.5')
            expect(emits(wrapper)).toEqual({value: -1.5, valid: true})
        })

        // An empty number input is invalid, but still emits 0 — Number('') is 0.
        // The parent must check `valid`, not truthiness of `value`.
        it('is invalid when empty, though it still emits 0', async () => {
            const wrapper = mountInput({type: 'number', modelValue: 5})
            await wrapper.find('input').setValue('')

            expect(emits(wrapper)).toEqual({value: 0, valid: false})
        })
    })

    describe('boolean', () => {
        it('is always valid', async () => {
            const wrapper = mountInput({type: 'boolean'})

            expect(last(wrapper, 'update:valid')).toBe(true)

            await wrapper.find('input').setValue(true)
            expect(emits(wrapper)).toEqual({value: true, valid: true})

            await wrapper.find('input').setValue(false)
            expect(emits(wrapper)).toEqual({value: false, valid: true})
        })
    })

    describe('json', () => {
        it.each([
            ['accepts an object',   '{"a":1}',  true],
            ['accepts an array',    '[1,2,3]',  true],
            ['accepts a bare null', 'null',     true],
            ['rejects malformed',   '{oops}',   false],
            ['rejects empty',       '',         false],
            ['rejects whitespace',  '   ',      false],
        ])('%s', async (_label, input, valid) => {
            const wrapper = mountInput({type: 'json'})
            await wrapper.find('textarea').setValue(input)

            expect(last(wrapper, 'update:valid')).toBe(valid)
        })

        it('emits the raw string, not the parsed object', async () => {
            const wrapper = mountInput({type: 'json'})
            await wrapper.find('textarea').setValue('{"a":1}')

            expect(last(wrapper, 'update:modelValue')).toBe('{"a":1}')
        })
    })
})

describe('TypedValueInput — changing type', () => {
    it('clears the field and re-emits when the type changes', async () => {
        const wrapper = mountInput({modelValue: 'hello', type: 'string'})
        expect(emits(wrapper)).toEqual({value: 'hello', valid: true})

        await wrapper.setProps({type: 'number'})

        expect(emits(wrapper)).toEqual({value: 0, valid: false})
        expect(wrapper.find('input[type="number"]').element.value).toBe('')
    })

    it('resets to false when switching to boolean', async () => {
        const wrapper = mountInput({modelValue: 'hello', type: 'string'})

        await wrapper.setProps({type: 'boolean'})

        expect(emits(wrapper)).toEqual({value: false, valid: true})
    })

    it('does not carry a stale value across a type change', async () => {
        const wrapper = mountInput({type: 'string'})
        await wrapper.find('input').setValue('hello')

        await wrapper.setProps({type: 'json'})

        expect(emits(wrapper)).toEqual({value: '', valid: false})
    })
})
