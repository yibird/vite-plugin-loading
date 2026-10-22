import { createApp } from 'vue'
import { hideAppLoading } from 'virtual:app-loading'
import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')

hideAppLoading()
