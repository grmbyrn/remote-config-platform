<script setup>
import {ref, onMounted} from 'vue'
import { apiFetch } from '../api.js'

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

  if(!newKey.value || !newValue.value){
    createError.value = 'Key and value are required.'
    return
  }

  try {
    const res = await apiFetch('/parameters', {
      method: "POST",
      body: JSON.stringify({key: newKey.value, value: newValue.value, type: 'string', description: newDescription.value})
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

      conflict.value = {param, current: body.current}
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

onMounted(loadParameters)
</script>

<template>
  <div>
    <p v-if="loading"> Loading...</p>
    <p v-else-if="error">{{ error }}</p>

    <table v-if="!loading && !error">
      <thead>
        <tr>
          <th>Parameter Key</th>
          <th>Value</th>
          <th>Description</th>
          <th>Create Date</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="param in parameters" :key="param.key">
          <td>{{ param.key }}</td>
          <td>
            <input type="text" v-if="editingKey === param.key" v-model="editValue" />
            <span v-else>{{ param.value }}</span>
          </td>
          <td>{{ param.description }}</td>
          <td>{{ param.createdAt }}</td>
          <td>
            <template v-if="editingKey === param.key">
              <button @click="saveEdit(param)">Save</button>
              <button @click="cancelEdit">Cancel</button>
            </template>
            <button v-else @click="startEdit(param)">Edit</button>
          </td>
        </tr>
        <tr>
          <td>
            <input type="text" v-model="newKey" placeholder="New Parameter">
          </td>
          <td>
            <input type="text" v-model="newValue" placeholder="New Value">
          </td>
          <td>
            <input type="text" v-model="newDescription" placeholder="New Description">
          </td>
          <td></td>
          <td>
            <button @click="addParameters">ADD</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="createError">{{ createError }}</p>
    <p v-if="editError">{{ editError }}</p>

    <div v-if="conflict" class="backdrop">
      <div class="dialog">
        <h3>"{{ conflict.param.key }}" was changed</h3>
        <p>
          {{ conflict.current.updatedBy || 'Someone else' }} saved a new value
          <span v-if="conflict.current.updatedAt">at {{ conflict.current.updatedAt }}</span>
        </p>
        <p>Their value: {{ conflict.current.value }}</p>
        <p>Your value: {{ editValue }}</p>
        <button @click="saveEdit(conflict.param)">Re-apply mine</button>
        <button @click="useTheirs">Use theirs</button>
      </div>
    </div>

    <div v-if="missing" class="backdrop">
      <div class="dialog">
        <h3>Parameter deleted</h3>
        <p>This parameter was deleted by someone else.</p>
        <button @click="refreshAfterDelete">Refresh list</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
}

.dialog {
  background: #1e2235;
  color: #fff;
  padding: 24px;
  border-radius: 8px;
  max-width: 480px;
}
</style>