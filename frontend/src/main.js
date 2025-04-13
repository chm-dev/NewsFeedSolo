import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Admin from './Admin.vue';
import './index.css';

// Define routes
const routes = [
    { 
        path: '/', 
        component: App
    },
    { 
        path: '/admin', 
        component: Admin
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// Create app with router
const app = createApp({
    template: '<router-view></router-view>'
});

app.use(router);
app.mount('#app');
