import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router'

import 'floating-vue/dist/style.css'

import { vTooltip } from 'floating-vue'


const app = createApp(App)
app.use(router)
app.directive('tooltip', vTooltip)

app.mount('#app')
