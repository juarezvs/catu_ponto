import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home-workspace.component').then(
            (m) => m.HomeWorkspaceComponent
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-servidor.component').then(
            (m) => m.DashboardServidorComponent
          ),
      },
      {
        path: 'espelho-ponto',
        loadComponent: () =>
          import('./features/espelho-ponto/espelho-ponto.component').then(
            (m) => m.EspelhoPontoComponent
          ),
      },
      {
        path: 'modulo/:slug',
        loadComponent: () =>
          import('./features/modulo-consulta/servidor-modulo-page.component').then(
            (m) => m.ServidorModuloPageComponent
          ),
      },
      {
        path: 'cadastros/:slug',
        loadComponent: () =>
          import('./features/cadastros/cadastro-crud-page.component').then(
            (m) => m.CadastroCrudPageComponent
          ),
      },
      {
        path: 'secao/:menuId',
        loadComponent: () =>
          import('./features/secao-hub/secao-cards-page.component').then(
            (m) => m.SecaoCardsPageComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
