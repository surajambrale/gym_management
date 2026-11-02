
import { Routes } from '@angular/router';

import { Register } from './pages/auth/register/register';
import { Login } from './pages/auth/login/login';

export const routes: Routes = [

  {
    path: 'register',
    component: Register
  },

  {
    path: 'login',
    component: Login
  },

  // Dashboard is rendered inside the App shell
  {
    path: 'dashboard',
    pathMatch: 'full',
    children: []
  },

  // Members is rendered inside the App shell
  {
    path: 'members',
    pathMatch: 'full',
    children: []
  },

  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];
