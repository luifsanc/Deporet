export type NavBadge = 'pending' | 'topups';
export interface NavItem { path: string; label: string; icon: string; group: 'Principal' | 'Gestión' | 'Cuenta'; permission?: string; badge?: NavBadge; hint: string }

export const NAV: NavItem[] = [
  { path: 'inicio', label: 'Inicio', icon: 'grid', group: 'Principal', permission: 'transactions.read', hint: 'Resumen de tu cuenta' },
  { path: 'transferencias', label: 'Transferencias', icon: 'arrows', group: 'Principal', permission: 'transactions.create', hint: 'Enviar a una cuenta bancaria' },
  { path: 'giros-nacionales', label: 'Giros Nacionales', icon: 'send', group: 'Principal', permission: 'transactions.create', hint: 'Enviar y cobrar un giro nacional' },
  { path: 'recargas', label: 'Recargas', icon: 'wallet', group: 'Principal', permission: 'topups.read', badge: 'topups', hint: 'Acreditación por depósito' },
  { path: 'efectivo-movil', label: 'Efectivo Móvil', icon: 'phone', group: 'Principal', permission: 'topups.read', badge: 'topups', hint: 'Acreditar una orden de Banco Guayaquil' },
  { path: 'deuna', label: 'Deuna (QR)', icon: 'qr', group: 'Principal', permission: 'topups.read', badge: 'topups', hint: 'Acreditar un pago Deuna' },
  { path: 'equifax', label: 'Historial Crediticio', icon: 'chart', group: 'Principal', permission: 'credit.request', hint: 'Consulta de historial Equifax' },
  { path: 'movimientos', label: 'Movimientos', icon: 'history', group: 'Principal', permission: 'transactions.read', badge: 'pending', hint: 'Historial y constancias' },
  { path: 'revision', label: 'Revisión de operaciones', icon: 'shield', group: 'Gestión', permission: 'transactions.settle', badge: 'pending', hint: 'Aprobar o rechazar operaciones' },
  { path: 'usuarios', label: 'Clientes y usuarios', icon: 'users', group: 'Gestión', permission: 'users.read', hint: 'Accesos y carteras' },
  { path: 'roles', label: 'Roles y permisos', icon: 'key', group: 'Gestión', permission: 'roles.manage', hint: 'Permisos por rol' },
  { path: 'auditoria', label: 'Auditoría', icon: 'history', group: 'Gestión', permission: 'audit.read', hint: 'Registro de eventos' },
  { path: 'admin/config-equifax', label: 'Configuración / Panel Operativo', icon: 'settings', group: 'Gestión', permission: 'integrations.manage', hint: 'Equifax, QR y estado de la plataforma' },
  { path: 'perfil', label: 'Mi perfil', icon: 'user', group: 'Cuenta', permission: 'profile.edit', hint: 'Datos y contraseña' },
];
