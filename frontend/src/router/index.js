import { createRouter, createWebHistory } from 'vue-router'
import ParametersView from '../views/ParametersView.vue'
import SignInView from '../views/SignInView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'parameters',
      component: ParametersView
    },
    {
      path: '/signin',
      name: 'signin',
      component: SignInView
    },
  ],
})

export default router
