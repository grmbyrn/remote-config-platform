<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import { signInWithEmailAndPassword } from 'firebase/auth';
import {auth} from '../firebase'
import logoUrl from '../assets/codeway.png'

const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const year = new Date().getFullYear()

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
  <div class="signin">
    <img :src="logoUrl" alt="Codeway" class="logo">
    <h1>Please sign in</h1>
    <form @submit.prevent="handleSignIn">
      <div class="fields">
        <input type="email" v-model="email" placeholder="Email" autocomplete="username">
        <input type="password" v-model="password" placeholder="Password" autocomplete="current-password">
      </div>
      <button type="submit" class="btn-signin">
        Sign in
      </button>
    </form>
    <p v-if="error" class="form-error">{{ error }}</p>
    <p class="footer">Codeway © {{ year }}</p>
  </div>
</template>

<style scoped>
.signin {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo { width: 268px; margin-bottom: 24px; }

h1 {
  font-size: var(--text-xl);
  font-weight: 400;
  color: #37385c;
  margin-bottom: 19px;
}

.fields { width: 344px; }

.fields input {
  display: block;
  width: 100%;
  height: 51px;
  padding: 0 14px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text);
}

.fields input:first-child { border-radius: var(--radius-input) var(--radius-input) 0 0; }
.fields input:last-child  { border-radius: 0 0 var(--radius-input) var(--radius-input); margin-top: -1px; }

.fields input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  position: relative;
  z-index: 1;
}

.btn-signin {
  width: 344px;
  height: 52px;
  margin-top: 12px;
  border-radius: var(--radius-btn);
  background: var(--btn-primary);
  color: #fff;
  font-weight: 700;
}

.form-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(248, 80, 119, 0.12);
  border: 1px solid rgba(248, 80, 119, 0.4);
  border-radius: var(--radius-input);
  color: #ff8095;
  font-size: var(--text-sm);
}
.form-error::before { content: "⚠"; }

.footer {
  margin-top: 83px;
  color: var(--text-faint);
}
</style>