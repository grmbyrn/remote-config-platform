<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import { signInWithEmailAndPassword } from 'firebase/auth';
import {auth} from '../firebase'

const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function handleSignIn() {
  error.value = ''
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    console.log('Signed in as:', auth.currentUser?.email)
    router.push('/')
  } catch (err) {
    console.error('Sign in failed:', err.code)
    error.value = "Invalid email or password"
  }
}
</script>

<template>
  <div>
    <h1>Sign in</h1>
    <form @submit.prevent="handleSignIn">
      <input type="email" v-model="email" placeholder="Email" autocomplete="username">
      <input type="password" v-model="password" placeholder="Password" autocomplete="current-password">
      <button type="submit">
        Sign In
      </button>
    </form>
    <p v-if="error">{{ error }}</p>
  </div>
</template>