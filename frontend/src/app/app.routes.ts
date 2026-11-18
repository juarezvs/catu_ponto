import { Routes } from '@angular/router';
import { authGuard, cadastrosGuard, chefiaGuard } from './core/guards/auth.guard';
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
        canActivate: [cadastrosGuard],
        loadComponent: () =>
          import('./features/cadastros/cadastro-crud-page.component').then(
            (m) => m.CadastroCrudPageComponent
          ),
      },
      {
        path: 'chefia/equipe',
        canActivate: [chefiaGuard],
        loadComponent: () =>
          import('./features/chefia/chefia-equipe.component').then(
            (m) => m.ChefiaEquipeComponent
          ),
      },
      {
        path: 'chefia/ferias',
        canActivate: [chefiaGuard],
        loadComponent: () =>
          import('./features/chefia/programacao-ferias-equipe.component').then(
            (m) => m.ProgramacaoFeriasEquipeComponent
          ),
      },
      {
        path: 'secao/:menuId',
        loadComponent: () =>
          import('./features/secao-hub/secao-cards-page.component').then(
            (m) => m.SecaoCardsPageComponent
          ),
      },
      {
        path: 'conformidade-135',
        loadComponent: () =>
          import('./features/compliance/portaria-compliance-panel.component').then(
            (m) => m.PortariaCompliancePanelComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
