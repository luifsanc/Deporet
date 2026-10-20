import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Api } from './api';
import { Dashboard, Service, User } from './models';
import { NAV } from './nav';
import { Toasts } from '../ui/toast';

/** Authenticated session: user, permissions, catalog, dashboard and the realtime channel. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);

  readonly user = signal<User | null>(null);
  readonly mode = signal('Sandbox');
  readonly vatRate = signal(0);
  readonly live = signal(false);
  readonly services = signal<Service[]>([]);
  readonly banks = signal<string[]>([]);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly avatarUrl = signal('');
  /** Increments on every server push so pages can reload what they show. */
  readonly changes = signal(0);
  /** Message shown on the login screen after a logout (expiry, revocation, password change). */
  readonly notice = signal('');

  readonly isClient = computed(() => this.user()?.baseRole === 'Cliente');
  readonly isAdmin = computed(() => this.user()?.baseRole === 'Administrador');
  readonly nav = computed(() => (this.user() ? NAV.filter(i => (!i.permission || this.has(i.permission)) && ((i.path !== 'transferencias' && i.path !== 'giros-nacionales' && i.path !== 'equifax') || this.isClient())) : []));

  private connection?: HubConnection;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.api.unauthorized.subscribe(() => this.logout('Tu sesión terminó o fue revocada. Vuelve a ingresar.'));
  }

  has(permission: string) { return this.user()?.permissions.includes(permission) ?? false; }
  homePath() { return this.nav()[0]?.path ?? 'ayuda'; }
  canVisit(path: string) {
    const item = NAV.find(i => i.path === path);
    return !!item && (!item.permission || this.has(item.permission));
  }
  serviceName(kind: string) { return this.services().find(s => s.id === kind)?.name ?? kind; }
  serviceIcon(kind: string) { return this.services().find(s => s.id === kind)?.icon ?? 'arrows'; }

  async login(email: string, password: string) {
    const data = await this.api.post<{ token: string; expiresAt: string; user: User }>('/auth/login', { email, password });
    this.api.token = data.token;
    this.user.set(data.user);
    this.notice.set('');
    this.scheduleExpiry(data.expiresAt);
    await this.refresh();
    void this.startRealtime();
    void this.loadAvatar();
  }

  logout(message = '') {
    void this.connection?.stop();
    this.connection = undefined;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.live.set(false);
    if (this.avatarUrl()) URL.revokeObjectURL(this.avatarUrl());
    this.avatarUrl.set('');
    this.api.token = '';
    this.user.set(null);
    this.dashboard.set(null);
    this.toasts.clear();
    this.notice.set(message);
    void this.router.navigateByUrl('/login');
  }

  async refresh() {
    const catalog = await this.api.get<{ services: Service[]; banks: string[]; mode: string; vatRate: number }>('/catalog');
    this.services.set(catalog.services);
    this.banks.set(catalog.banks);
    this.mode.set(catalog.mode);
    this.vatRate.set(catalog.vatRate);
    if (this.has('transactions.read')) this.dashboard.set(await this.api.get<Dashboard>('/dashboard'));
  }

  async loadAvatar() {
    if (!this.user()?.hasAvatar) return;
    try {
      const blob = await this.api.blob('/profile/avatar');
      if (this.avatarUrl()) URL.revokeObjectURL(this.avatarUrl());
      this.avatarUrl.set(URL.createObjectURL(blob));
    } catch { /* the avatar is optional */ }
  }

  private scheduleExpiry(expiresAt: string) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (!(remaining > 0)) return;
    if (remaining > 120_000) {
      this.timers.push(setTimeout(() => this.toasts.info('Tu sesión vence en 2 minutos', 'Guarda lo que estés haciendo; deberás ingresar de nuevo.'), remaining - 120_000));
    }
    this.timers.push(setTimeout(() => this.logout('Tu sesión de 20 minutos terminó. Vuelve a ingresar.'), remaining));
  }

  private async startRealtime() {
    const connection = new HubConnectionBuilder()
      .withUrl('/api/events', { accessTokenFactory: () => this.api.token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build();
    connection.on('changed', async () => {
      this.changes.update(n => n + 1);
      try { await this.refresh(); } catch { /* surfaced by the next explicit action */ }
    });
    connection.onreconnecting(() => this.live.set(false));
    connection.onreconnected(() => { this.live.set(true); this.changes.update(n => n + 1); });
    connection.onclose(() => this.live.set(false));
    this.connection = connection;
    try { await connection.start(); this.live.set(this.connection === connection); } catch { this.live.set(false); }
  }
}
