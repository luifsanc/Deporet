import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirect, permissionGuard } from './core/guards';

const page = (path: string, title: string, load: Routes[number]['loadComponent'], permission?: string, data: Record<string, unknown> = {}) =>
  ({ path, title: `${title} · DepoRet`, loadComponent: load, canActivate: [permissionGuard], data: { permission, ...data } });

export const routes: Routes = [
  { path: 'login', title: 'Ingresar · DepoRet', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
      page('inicio', 'Inicio', () => import('./pages/dashboard').then(m => m.DashboardPage), 'transactions.read'),
      page('movimientos', 'Movimientos', () => import('./pages/payments').then(m => m.PaymentsPage), 'transactions.read', { review: false }),
      page('revision', 'Revisión de operaciones', () => import('./pages/payments').then(m => m.PaymentsPage), 'transactions.settle', { review: true }),
      page('transferencias', 'Transferencias', () => import('./pages/transaction-page').then(m => m.TransactionPage), 'transactions.create', { kind: 'transferencia', allowedRoles: ['Cliente'] }),
      page('giros-nacionales', 'Giros nacionales', () => import('./pages/transaction-page').then(m => m.TransactionPage), 'transactions.create', { kind: 'giro', allowedRoles: ['Cliente'] }),
      page('recargas', 'Recargas', () => import('./pages/topups').then(m => m.TopupsPage), 'topups.read', { module: 'RecargaSaldo' }),
      page('efectivo-movil', 'Efectivo Móvil', () => import('./pages/topups').then(m => m.TopupsPage), 'topups.read', { module: 'EfectivoMovil' }),
      page('deuna', 'Deuna (QR)', () => import('./pages/topups').then(m => m.TopupsPage), 'topups.read', { module: 'Deuna' }),
      page('equifax', 'Historial crediticio', () => import('./pages/credit').then(m => m.CreditPage), 'credit.request', { allowedRoles: ['Cliente'] }),
      page('usuarios', 'Clientes y usuarios', () => import('./pages/users').then(m => m.UsersPage), 'users.read'),
      page('roles', 'Roles y permisos', () => import('./pages/roles').then(m => m.RolesPage), 'roles.manage'),
      page('auditoria', 'Auditoría', () => import('./pages/audit').then(m => m.AuditPage), 'audit.read'),
      page('admin/config-equifax', 'Configuración Equifax', () => import('./pages/settings').then(m => m.SettingsPage), 'integrations.manage'),
      page('perfil', 'Mi perfil', () => import('./pages/profile').then(m => m.ProfilePage), 'profile.edit'),
      { path: 'operaciones', redirectTo: 'transferencias', pathMatch: 'full' },
      { path: 'credito', redirectTo: 'equifax', pathMatch: 'full' },
      { path: 'configuracion', redirectTo: 'admin/config-equifax', pathMatch: 'full' },
      page('ayuda', 'Centro de ayuda', () => import('./pages/help').then(m => m.HelpPage)),
    ],
  },
  { path: '**', redirectTo: '' },
];
