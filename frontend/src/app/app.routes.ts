import { Routes } from '@angular/router';
// import { MembershipPlans } from './pages/membership-plans/membership-plans';
import { Register } from './pages/auth/register/register';
import { Login } from './pages/auth/login/login';
import { Members } from './pages/members/members';
// import { Attendance } from './pages/attendance/attendance';

export const routes: Routes = [

  {
    path: 'register',
    component: Register
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'members',
    component: Members
  },

  // { path: 'attendance', 
  //   component: Attendance
  // },

  // {
  //   path: 'membership-plans',
  //   component: MembershipPlans
  // },

  {
    path: 'dashboard',
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