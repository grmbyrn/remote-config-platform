<script setup>
import {ref, onMounted} from 'vue'
import {auth} from '../firebase.js'

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

async function loadParameters(){
  loading.value = true
  error.value = ''

  try {
    const token = await auth.currentUser.getIdToken()
    
    const res = await fetch('http://localhost:3000/parameters', {
      headers: {Authorization: `Bearer ${token}`}
    })

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
    const token = await auth.currentUser.getIdToken()

    const res = await fetch('http://localhost:3000/parameters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        key: newKey.value,
        value: newValue.value,
        type: 'string',
        description: newDescription.value
      })
    })

    if(res.status === 409){
      createError.value = `A parameter named "${newKey.value} already exists."`
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
}

function cancelEdit(){
  editingKey.value = null
  editError.value = ''
}

async function saveEdit(param){
  editError.value = ''

  try {
    const token = await auth.currentUser.getIdToken()

    const res = await fetch(`http://localhost:3000/parameters/${param.key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        value: editValue.value,
        expectedVersion: param.version
      })
    })

    if(res.status === 409){
      editError.value = 'This parameter was changed by someone else.'
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
  </div>
</template>

<style scoped>

</style>