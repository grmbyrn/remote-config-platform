<script setup>
import {ref, watch} from 'vue'

const props = defineProps({
    modelValue: {},
    type: {type: String, default: 'string'}
})

const emit = defineEmits(['update:modelValue', 'update:valid'])

const raw = ref('')

watch(() => props.type, () => {
    raw.value = props.type === 'boolean' ? false : ''
    emitValue()
})

function emitValue(){
    let value, valid = true
    switch(props.type){
        case 'number':
            value = Number(raw.value)
            valid = raw.value !== '' && Number.isFinite(value)
            break
        case 'boolean':
            value = !!raw.value
            break
        case 'json':
            value = raw.value
            try {JSON.parse(raw.value); valid = raw.value.trim() !== ''} catch {valid = false}
            break
        default:
            value = raw.value
    }
    emit('update:modelValue', value)
    emit('update:valid', valid)
}
</script>

<template>
    <input type="text" v-if="type === 'string'" v-model="raw" @input="emitValue" class="field" placeholder="New Value">
    <input type="number" v-if="type === 'number'" v-model="raw" @input="emitValue" class="field" placeholder="New Value">
    <input type="checkbox" v-if="type === 'boolean'" v-model="raw" @change="emitValue" placeholder="New Value">
    <textarea v-else-if="type === 'json'" v-model="raw" @input="emitValue" class="field" placeholder="New Value"></textarea>
</template>