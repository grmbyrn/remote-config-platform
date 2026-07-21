<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { signOut } from 'firebase/auth';
import {auth} from '../firebase.js'
import logoUrl from '../assets/codeway.png'

const router = useRouter()
const menuOpen = ref(false)

async function handleLogout(){
    menuOpen.value = false
    try {
        await signOut(auth)
        router.push({name: 'signin'})
    } catch (err) {
        console.error('Logout failed:', err)
    }
}
</script>

<template>
    <header class="navbar">
        <img :src="logoUrl" alt="Codeway" class="navbar-logo">

        <div class="user-menu">
            <button class="user-btn" @click="menuOpen = !menuOpen" aria-label="Account menu">
                <svg class="user-icon" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"/>
                </svg>
                <svg class="caret" viewBox="0 0 10 6" fill="currentColor" width="10" height="6">
                <path d="M0 0l5 6 5-6z"/>
                </svg>
            </button>

            <template v-if="menuOpen">
                <div class="menu-backdrop" @click="menuOpen = false"></div>
                <div class="dropdown">
                    <button class="dropdown-item" @click="handleLogout">Log out</button>
                </div>
            </template>
        </div>
    </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--gutter);
}
.navbar-logo { height: 44px; width: auto; display: block; }

.user-menu { position: relative; }

.user-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: transparent;
  color: #fff;
  padding: var(--space-1);
  transition: color var(--transition);
}
.user-btn:hover { color: var(--text); }

/* invisible full-screen catcher: any outside click closes the menu */
.menu-backdrop { position: fixed; inset: 0; z-index: 30; }

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-2));
  min-width: 140px;
  background: #1e2235;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-card);
  padding: var(--space-1);
  z-index: 31;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  color: var(--text);
  border-radius: var(--radius-input);
  font-size: var(--text-base);
  transition: background var(--transition);
}
.dropdown-item:hover { background: rgba(255, 255, 255, 0.06); }
</style>