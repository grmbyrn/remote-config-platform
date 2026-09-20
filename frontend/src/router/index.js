import { createRouter, createWebHistory } from 'vue-router'
import ParametersView from '../views/ParametersView.vue'
import SignInView from '../views/SignInView.vue'
import { getCurrentUser } from '../firebase.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'parameters',
      component: ParametersView,
      meta: {requiresAuth: true}
    },
    {
      path: '/signin',
      name: 'signin',
      component: SignInView
    },
  ],
})

export async function authGuard(to){
  const user = await getCurrentUser()

  if(to.meta.requiresAuth && !user){
    return {name: 'signin'}
  }

  if(to.name === 'signin' && user){
    return {name: 'parameters'}
  }
}

router.beforeEach(authGuard)

export default router
