<script setup>
import {ref, onMounted, computed} from 'vue'
import { apiFetch } from '../api.js'
import TypedValueInput from '../components/TypedValueInput.vue'

const parameters = ref([])
const loading = ref(false)
const error = ref('')
const newKey = ref('')
const newValue = ref('')
const newDescription = ref('')
const createError = ref('')
const editingKey = ref(null)
const editValue = ref('')
const editError = ref('')
const conflict = ref(null)
const missing = ref(false)
const newType = ref('string')
const newValueValid = ref(true)
const formKey = ref(0)
const sortAsc = ref(true)
const overrideError = ref('')
const overridesFor = ref(null)
const overrideCountry = ref('')
const overrideValue = ref('')
const overrideValueValid = ref(true)
const overrideKey = ref(0)
const suggestCountries = ref('')
const generating = ref(false)
const suggestError = ref('')
const editingSuggestion = ref(null)
const suggestionValue = ref('')
const suggestionValueValid = ref(true)
const suggestionKey = ref(0)

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const sortedParameters = computed(() => 
  [...parameters.value].sort((a, b) => {
    const cmp = new Date(a.createdAt) - new Date(b.createdAt)
    return sortAsc.value ? cmp : -cmp
  }))

function toggleSort(){ sortAsc.value = !sortAsc.value}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d).replace(',', '')
}

async function loadParameters(){
  loading.value = true
  error.value = ''

  try {
    const res = await apiFetch('/parameters')

    if(!res.ok){
      throw new Error(`Request failed: ${res.status}`)
    }

    parameters.value = await res.json()
  } catch (err) {
    console.error('Failed to load parameters:', err)
    error.value = 'Could not load parameters'
  } finally {
    loading.value = false
  }
}

async function addParameters(){
  createError.value = ''

  if(!newKey.value || !newValueValid.value){
    createError.value = 'Key and value are required.'
    return
  }

  try {
    const res = await apiFetch('/parameters', {
      method: "POST",
      body: JSON.stringify({key: newKey.value, value: newValue.value, type: newType.value, description: newDescription.value})
    })

    if(res.status === 409){
      createError.value = `A parameter named "${newKey.value}" already exists.`
      return
    }

    if(!res.ok){
      throw new Error(`Request failed: ${res.status}`)
    }

    newKey.value = ''
    newValue.value = ''
    newDescription.value = ''
    newType.value = 'string'
    formKey.value++
    await loadParameters()
  } catch (err) {
    console.error('Failed to create parameter:', err)
    createError.value = 'Could not create parameter.'
  }
}

function startEdit(param){
  editingKey.value = param.key
  editValue.value = param.value
  editError.value = ''
  conflict.value = null
  missing.value = false
}

function cancelEdit(){
  editingKey.value = null
  editError.value = ''
  conflict.value = null
  missing.value = false
}

async function saveEdit(param){
  editError.value = ''
  conflict.value = null
  missing.value = false

  try {
    const res = await apiFetch(`/parameters/${param.key}`, {
      method: 'PUT',
      body: JSON.stringify({value: editValue.value, expectedVersion: param.version})
    })

    if(res.status === 409){
      const body = await res.json()

      param.value = body.current.value
      param.version = body.current.version
      param.updatedBy = body.current.updatedBy
      param.updatedAt = body.current.updatedAt

      conflict.value = {param, current: body.current, retry: () => saveEdit(param), attempted: editValue.value}
      return
    }

    if(res.status === 404){
      missing.value = true
      return
    }

    if(!res.ok){
      throw new Error(`Request failed: ${res.status}`)
    }

    editingKey.value = null
    await loadParameters()
  } catch (err) {
    console.error('Failed to update parameter:', err)
    editError.value = 'Could not update parameter.'
  }
}

function useTheirs(){
  conflict.value = null
  editingKey.value = null
}

async function refreshAfterDelete(){
  missing.value = false
  editingKey.value = null
  await loadParameters()
}

async function saveOverride(param, country, value){
  overrideError.value = ''
  conflict.value = null
  missing.value = false

  try {
    const res = await apiFetch(`/parameters/${param.key}/overrides/${country}`, {
      method: 'PUT',
      body: JSON.stringify({value, expectedVersion: param.version})
    })

    if(res.status === 409){
      const body = await res.json()
      param.value = body.current.value
      param.version = body.current.version
      param.updatedBy = body.current.updatedBy
      param.updatedAt = body.current.updatedAt
      conflict.value = {param, current: body.current, retry: () => saveOverride(param, country, value), attempted: value}
      return
    }

    if(res.status === 404){ missing.value = true; return }
    if(!res.ok) throw new Error(`Request failed: ${res.status}`)

    await loadParameters()
    overridesFor.value = parameters.value.find(p => p.key === param.key) ?? null
    overrideCountry.value = ''
    overrideValue.value = ''
    overrideKey.value++
  } catch (err) {
    console.error('Failed to set override:', err)
    overrideError.value = 'Could not save override'
  }
}

async function removeOverride(param, country){
  overrideError.value = ''
  conflict.value = null
  missing.value = false

  try {
    const res = await apiFetch(`/parameters/${param.key}/overrides/${country}`, {
      method: 'DELETE',
      body: JSON.stringify({expectedVersion: param.version})
    })

    if(res.status === 409){
      const body = await res.json()
      param.value = body.current.value
      param.version = body.current.version
      param.updatedBy = body.current.updatedBy
      param.updatedAt = body.current.updatedAt
      conflict.value = {param, current: body.current, retry: () => removeOverride(param, country)}
      return
    }

    if(res.status === 404){missing.value = true; return}
    if(!res.ok) throw new Error(`Request failed: ${res.status}`)

    await loadParameters()
    overridesFor.value = parameters.value.find(p => p.key === param.key) ?? null
  } catch (err) {
    console.error('Failed to remove override:', err)
    overrideError.value = 'Could not remove override.'
  }
}

function openOverrides(param){
  overridesFor.value = param
  overrideCountry.value = ''
  overrideValue.value = ''
  overrideValueValid.value = true
  overrideError.value = ''
  conflict.value = null
  missing.value = false
  overrideKey.value++
}

function closeOverrides(){
  overridesFor.value = null
  overrideError.value = ''
}

function editOverride(country, entry){
  overrideCountry.value = country
  overrideValue.value = entry.value
  overrideKey.value++
}

function startEditSuggestion(country, entry){
  editingSuggestion.value = country
  suggestionValue.value = entry.value
  suggestionKey.value++
}

function cancelEditSuggestion() { editingSuggestion.value = null }

async function submitOverride(){
  if(!overrideCountry.value || !overrideValueValid.value){
    overrideError.value = 'Country and a valid value are required'
    return
  }
  await saveOverride(overridesFor.value, overrideCountry.value, overrideValue.value)
}

async function generateSuggestions(param){
  suggestError.value = ''
  const countries = suggestCountries.value
    .split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
  if(!countries.length){
    suggestError.value = 'Enter at least one country code.'
    return
  }
  generating.value = true
  try {
    const res = await apiFetch(`/parameters/${param.key}/suggestions`, {
      method: 'POST',
      body: JSON.stringify({countries})
    })
    if(res.status === 502){suggestError.value = 'Suggestion generation failed. Try again'; return}
    if(!res.ok) throw new Error(`Request failed: ${res.status}`)
    suggestCountries.value = ''
    await loadParameters()
    overridesFor.value = parameters.value.find(p => p.key === param.key) ?? null
  } catch (err) {
    console.error('Failed to generate suggestions:', err)
    suggestError.value = 'Could not generate suggestions.'
  } finally {
    generating.value = false
  }
}

async function approveSuggestion(param, country, value){
  suggestError.value = ''
  conflict.value = null
  missing.value = false
  try {
    const body = value === undefined
      ? {expectedVersion: param.version}
      : {value, expectedVersion: param.version}
    const res = await apiFetch(`/parameters/${param.key}/suggestions/${country}/approve`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    if(res.status === 409){
      const b = await res.json()
      param.value = b.current.value
      param.version = b.current.version
      param.updatedBy = b.current.updatedBy
      param.updatedAt = b.current.updatedAt
      conflict.value = {param, current: b.current, retry: () => approveSuggestion(param, country, value), attempted: value ?? '(suggested)'}
      return
    }
    if(res.status === 404) {
      await loadParameters()
      const fresh = parameters.value.find(p => p.key === param.key) ?? null
      if(fresh){
        overridesFor.value = fresh
        editingSuggestion.value = null
      } else {
        missing.value = true
      }
      return
    }

    if(!res.ok) throw new Error(`Request failed: ${res.status}`)
    editingSuggestion.value = null
    await loadParameters()
    overridesFor.value = parameters.value.find(p => p.key === param.key) ?? null
  } catch (err) {
    console.error('Failed to approve suggestion:', err)
    suggestError.value = 'Could not approve suggestion.'    
  }
}

async function rejectSuggestion(param, country){
  suggestError.value = ''
  try {
    const res = await apiFetch(`/parameters/${param.key}/suggestions/${country}`, {method: 'DELETE'})
    if(!res.ok) throw new Error(`Request failed: ${res.status}`)
    await loadParameters()
    overridesFor.value = parameters.value.find(p => p.key === param.key) ?? null
  } catch (err) {
    console.error('Failed to reject suggestion:', err)
    suggestError.value = 'Could not reject suggestion.'
  }
}

onMounted(loadParameters)
</script>

<template>
  <div class="page">
    <p v-if="loading"> Loading...</p>
    <p v-else-if="error">{{ error }}</p>

    <table v-if="!loading && !error" class="table">
      <thead>
        <tr>
          <th>Parameter Key</th>
          <th>Value</th>
          <th>Description</th>
          <th @click="toggleSort" style="cursor: pointer;">
            Create Date {{ sortAsc ? '↓' : '↑' }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="param in sortedParameters" :key="param.key">
          <td>{{ param.key }}</td>
          <td>
            <input type="text" v-if="editingKey === param.key" v-model="editValue" class="field" />
            <span v-else>{{ param.value }}</span>
          </td>
          <td>{{ param.description }}</td>
          <td>{{ formatDate(param.createdAt) }}</td>
          <td>
            <template v-if="editingKey === param.key">
              <button @click="saveEdit(param)" class="btn btn-edit">Save</button>
              <button @click="cancelEdit" class="btn btn-override">Cancel</button>
            </template>
            <template v-else>
              <button @click="startEdit(param)" class="btn btn-edit">Edit</button>
              <button @click="openOverrides(param)" class="btn btn-override">Override</button>
            </template>
          </td>
        </tr>
        <tr>
          <td>
            <input type="text" class="field" v-model="newKey" placeholder="New Parameter">
          </td>
          <td>
            <div class="value-cell">
              <select v-model="newType" class="field field-type">
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="json">json</option>
              </select>
              <TypedValueInput
                :key="formKey"
                :type="newType"
                v-model="newValue"
                @update:valid="newValueValid = $event"
              />
            </div>
          </td>
          <td>
            <input type="text" class="field" v-model="newDescription" placeholder="New Description">
          </td>
          <td></td>
          <td>
            <button @click="addParameters" class="btn btn-add">ADD</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="createError">{{ createError }}</p>
    <p v-if="editError">{{ editError }}</p>

    <div v-if="conflict" class="backdrop backdrop-top">
      <div class="dialog">
        <h3>"{{ conflict.param.key }}" was changed</h3>
        <p>
          {{ conflict.current.updatedBy || 'Someone else' }} saved a new value
          <span v-if="conflict.current.updatedAt">at {{ conflict.current.updatedAt }}</span>
        </p>
        <p>Their value: {{ conflict.current.value }}</p>
        <p>Your value: {{ conflict.attempted }}</p>
        <button @click="conflict.retry()" class="btn btn-add">Re-apply mine</button>
        <button @click="useTheirs" class="btn btn-override">Use theirs</button>
      </div>
    </div>

    <div v-if="missing" class="backdrop backdrop-top">
      <div class="dialog">
        <h3>Parameter deleted</h3>
        <p>This parameter was deleted by someone else.</p>
        <button @click="refreshAfterDelete" class="btn btn-add">Refresh list</button>
      </div>
    </div>
  </div>

  <div v-if="overridesFor" class="backdrop">
    <div class="dialog">
      <h3>Country overrides - {{ overridesFor.key }}</h3>
      <p>Default value: {{ overridesFor.value }}</p>

      <div v-if="overridesFor.countryOverrides && Object.keys(overridesFor.countryOverrides).length">
        <div v-for="(entry, country) in overridesFor.countryOverrides" :key="country" class="override-row">
          <span>{{ country }} → {{ entry.value }}</span>
          <button @click="editOverride(country, entry)" class="btn btn-edit">Edit</button>
          <button @click="removeOverride(overridesFor, country)" class="btn btn-delete">Remove</button>
        </div>
      </div>
      <p v-else>No overrides yet.</p>

      <input v-model="overrideCountry" placeholder="Country (e.g: TR)" maxlength="2" class="field" type="text">
      <TypedValueInput
        :key="overrideKey"
        :type="overridesFor.type"
        v-model="overrideValue"
        @update:valid="overrideValueValid = $event"
      />
      <button @click="submitOverride" class="btn btn-add">Save override</button>

      <p v-if="overrideError">{{ overrideError }}</p>

      <h4>AI suggestions</h4>
      <div v-if="overridesFor.suggestions && Object.keys(overridesFor.suggestions).length">
        <template v-for="(entry, country) in overridesFor.suggestions" :key="country">
          <div v-if="entry.status === 'pending'" class="override-row">
            <template v-if="editingSuggestion === country">
              <span>{{country}} (default: {{ overridesFor.value }})</span>
              <TypedValueInput
                :key="suggestionKey"
                :type="overridesFor.type"
                v-model="suggestionValue"
                @update:valid="suggestionValueValid = $event"
              />
              <button @click="approveSuggestion(overridesFor, country, suggestionValue)" class="btn btn-add" :disabled="!suggestionValueValid">Approve edit</button>
              <button @click="cancelEditSuggestion" class="btn btn-override">Cancel</button>
            </template>
            <template v-else>
              <span>{{ country }}: {{ entry.value }} (default: {{ overridesFor.value }})</span>
              <button @click="approveSuggestion(overridesFor, country)" class="btn btn-add">Approve</button>
              <button @click="startEditSuggestion(country, entry)" class="btn btn-edit">Edit</button>
              <button @click="rejectSuggestion(overridesFor, country)" class="btn btn-delete">Reject</button>
            </template>
          </div>
        </template>
      </div>
      <p v-else>No suggestions yet.</p>

      <input type="text" v-model="suggestCountries" placeholder="Countries (e.g: DE, FR)" class="field">
      <button @click="generateSuggestions(overridesFor)" class="btn btn-add" :disabled="generating">
        {{ generating ? 'Generating...' : 'Generate Suggestions' }}
      </button>
      <p v-if="suggestError">{{ suggestError }}</p>

      <button @click="closeOverrides" class="btn btn-override">Close</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: var(--space-7) var(--gutter);
}

.table{
  width: 100%;
  max-width: 1828px;
  border-collapse: collapse;
}

th{
  text-align: left;
}

.btn {
  height: var(--btn-height);
  padding: 0 18px;
  border-radius: 4px;
  color: #fff;
  font-size: var(--text-base);
  font-weight: 700;
  transition: filter var(--transition);
}

.btn:hover { filter: brightness(1.08); }

.btn-edit   { background: var(--btn-edit); }
.btn-delete { background: var(--btn-delete); }
.btn-add    { background: var(--btn-add); }

.btn-override {
  background: transparent;
  border: 1px solid var(--input-border);
  color: var(--text-muted);
  font-weight: 600;
}
.btn-override:hover {
  border-color: var(--input-border-focus);
  color: var(--text);
  filter: none;
}

.override-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.override-row span { margin-right: auto; }

.dialog .field { margin-bottom: var(--space-3); }

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  z-index: 10;
}

.backdrop-top { z-index: 20; }

.dialog {
  background: #1e2235;
  color: #fff;
  padding: 24px;
  border-radius: 8px;
  max-width: 480px;
}

.dialog > button { margin-top: var(--space-3); }
.dialog > button + button { margin-left: var(--space-2); }

.value-cell {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.field-type { width: auto; flex: 0 0 auto; }   /* select stays compact */
.value-cell .typed-input { flex: 1; }           /* value input fills the rest */

/* let the create row breathe like the design */
td { padding: var(--space-2) var(--space-3) var(--space-2) 0; }
</style>