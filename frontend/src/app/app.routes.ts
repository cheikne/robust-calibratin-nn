import { Routes } from '@angular/router';
import { DrawComponent } from './draw-component/draw-component';
import { DashboardComponent } from './dashboard-component/dashboard-component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }, 
  { path: 'dashboard', component: DashboardComponent },
  { path: 'draw', component: DrawComponent }
];
