import { defineStore } from 'pinia';
import api from '../api';

export const useAuth = defineStore('auth', {
  state: () => ({ token: localStorage.getItem('tv_token') || '', user: JSON.parse(localStorage.getItem('tv_user') || 'null') }),
  actions: {
    async login(username, password) {
      const { data } = await api.post('/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('tv_token', data.token);
      localStorage.setItem('tv_user', JSON.stringify(data.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('tv_token');
      localStorage.removeItem('tv_user');
    },
  },
});
