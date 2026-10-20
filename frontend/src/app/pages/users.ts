import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { initials } from '../core/format';
import { RoleData, User } from '../core/models';
import { Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

type Draft = Pick<User, 'role' | 'active' | 'kycVerified' | 'assignedExecutiveId'>;

@Component({
  selector: 'dr-users',
  imports: [FormsModule, ReactiveFormsModule, Field, FieldControl, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Cada persona, el acceso correcto</p>
        <h1 class="page-title mt-2">{{ admin() ? 'Clientes y usuarios' : 'Mis clientes' }}</h1>
        <p class="page-lead">{{ admin() ? 'Administra roles, verificación de identidad, accesos y carteras.' : 'Crea clientes y consulta únicamente tu cartera asignada.' }}</p>
      </div>
      @if (session.has('users.create')) {
        <button type="button" class="btn" [class]="creating() ? 'btn-secondary' : 'btn-primary'" (click)="creating.set(!creating())">
          <dr-icon [name]="creating() ? 'close' : 'plus'" /> {{ creating() ? 'Cerrar formulario' : (admin() ? 'Crear usuario' : 'Crear cliente') }}
        </button>
      }
    </header>

    @if (creating()) {
      <form [formGroup]="form" (ngSubmit)="create()" class="card card-pad mt-6" style="animation: var(--animate-rise-in)" novalidate>
        <h2 class="section-title">Nuevo {{ admin() ? 'usuario' : 'cliente' }}</h2>
        <p class="mt-1 text-sm text-ink-500">Se crea con saldo cero e identidad pendiente de verificación.</p>
        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <dr-field label="Nombre completo"><input drControl id="new-name" formControlName="name" maxlength="100" autocomplete="off" /></dr-field>
          <dr-field label="Correo electrónico"><input drControl id="new-email" type="email" formControlName="email" maxlength="254" autocomplete="off" /></dr-field>
          <dr-field label="Contraseña inicial" hint="Mínimo 12 caracteres."><input drControl id="new-password" type="password" formControlName="password" autocomplete="new-password" maxlength="128" /></dr-field>
          @if (admin()) {
            <dr-field label="Rol" [showSuccess]="false">
              <select drControl id="new-role" formControlName="role">@for (r of roleData()?.roles ?? []; track r.name) { <option [value]="r.name">{{ r.displayName }}</option> }</select>
            </dr-field>
            <dr-field label="Operador asignado" [showSuccess]="false">
              <select drControl id="new-exec" formControlName="executive"><option value="">Sin asignar</option>@for (e of executives(); track e.id) { <option [value]="e.id">{{ e.name }}</option> }</select>
            </dr-field>
          }
        </div>
        <div class="mt-5 flex justify-end">
          <button type="submit" class="btn btn-primary" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> } Crear {{ admin() ? 'usuario' : 'cliente' }}</button>
        </div>
      </form>
    }

    <section class="card mt-6 overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:p-5">
        <div class="relative sm:w-80">
          <dr-icon name="search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input type="search" class="h-10! pl-9!" placeholder="Buscar por nombre o correo" [ngModel]="query()" (ngModelChange)="query.set($event)" aria-label="Buscar usuarios" />
        </div>
        <span class="text-sm text-ink-500 sm:ml-auto"><span class="num font-semibold text-ink-800">{{ filtered().length }}</span> de {{ users().length }} usuarios</span>
      </div>
      <div class="table-wrap">
        <table class="table-modern min-w-[56rem]">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Identidad</th><th>Operador asignado</th><th>Acceso</th>@if (admin()) { <th class="text-right">Acciones</th> }</tr></thead>
          <tbody>
            @for (u of filtered(); track u.id) {
              @let d = drafts()[u.id];
              @let editable = admin() && u.id !== session.user()?.id;
              <tr>
                <td><div class="flex items-center gap-3">
                  <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{{ initials(u.name) }}</span>
                  <div class="min-w-0"><p class="truncate font-medium text-ink-900">{{ u.name }}</p><p class="truncate text-xs text-ink-500">{{ u.email }}</p></div>
                </div></td>
                <td>
                  @if (editable) {
                    <select class="select-sm min-w-36" [(ngModel)]="d.role" [attr.aria-label]="'Rol de ' + u.name">@for (r of roleData()?.roles ?? []; track r.name) { <option [value]="r.name">{{ r.displayName }}</option> }</select>
                  } @else { <span class="badge badge-neutral">{{ u.roleLabel }}</span> }
                </td>
                <td>
                  @if (editable) {
                    <label class="flex items-center gap-2 text-[0.8125rem] text-ink-600"><input type="checkbox" class="switch" [(ngModel)]="d.kycVerified" />{{ d.kycVerified ? 'Verificada' : 'Pendiente' }}</label>
                  } @else { <dr-status [value]="u.kycVerified ? 'Verificada' : 'Pendiente'" /> }
                </td>
                <td>
                  @if (editable) {
                    <select class="select-sm min-w-40" [(ngModel)]="d.assignedExecutiveId" [attr.aria-label]="'Operador de ' + u.name"><option [ngValue]="null">Sin asignar</option>@for (e of executives(); track e.id) { <option [ngValue]="e.id">{{ e.name }}</option> }</select>
                  } @else { <span class="text-ink-600">{{ executiveName(u.assignedExecutiveId) }}</span> }
                </td>
                <td>
                  @if (editable) {
                    <label class="flex items-center gap-2 text-[0.8125rem] text-ink-600"><input type="checkbox" class="switch" [(ngModel)]="d.active" />{{ d.active ? 'Activo' : 'Inactivo' }}</label>
                  } @else { <dr-status [value]="u.active ? 'Activo' : 'Inactivo'" /> }
                </td>
                @if (admin()) {
                  <td class="text-right">
                    @if (editable) { <button type="button" class="btn btn-sm" [class]="changed(u) ? 'btn-dark' : 'btn-ghost'" [disabled]="busy() || !changed(u)" (click)="save(u)">Guardar</button> }
                    @else { <span class="text-xs text-ink-400">Tu cuenta</span> }
                  </td>
                }
              </tr>
            } @empty {
              <tr><td colspan="6" class="py-12 text-center text-sm text-ink-500">{{ loading() ? 'Cargando usuarios…' : 'No hay usuarios que coincidan.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class UsersPage implements OnInit {
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly initials = initials;

  protected readonly users = signal<User[]>([]);
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly roleData = signal<RoleData | null>(null);
  protected readonly query = signal('');
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly admin = this.session.isAdmin;
  protected readonly executives = computed(() => this.users().filter(u => u.baseRole === 'Ejecutivo' && u.active));
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.users().filter(u => u.name.toLowerCase().includes(q) || u.email.includes(q)) : this.users();
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    role: ['Cliente'],
    executive: [''],
  });

  async ngOnInit() {
    this.loading.set(true);
    try {
      if (this.session.has('roles.manage')) this.roleData.set(await this.api.get<RoleData>('/roles'));
      await this.reload();
    } catch (e) { this.toasts.error('No se pudieron cargar los usuarios', errorText(e)); } finally { this.loading.set(false); }
  }

  protected executiveName(id: string | null) { return id ? this.users().find(u => u.id === id)?.name ?? 'Asignado' : '—'; }
  protected changed(u: User) {
    const d = this.drafts()[u.id];
    return !!d && (d.role !== u.role || d.active !== u.active || d.kycVerified !== u.kycVerified || (d.assignedExecutiveId || null) !== (u.assignedExecutiveId || null));
  }

  private async reload() {
    const list = await this.api.get<User[]>('/users');
    this.users.set(list);
    this.drafts.set(Object.fromEntries(list.map(u => [u.id, { role: u.role, active: u.active, kycVerified: u.kycVerified, assignedExecutiveId: u.assignedExecutiveId }])));
  }

  protected async create() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.post('/users', { name: v.name.trim(), email: v.email.trim(), password: v.password, role: this.admin() ? v.role : 'Cliente', assignedExecutiveId: v.executive || null });
      this.toasts.success('Usuario creado', 'Saldo cero e identidad pendiente de verificación.');
      this.form.reset();
      this.creating.set(false);
      await this.reload();
    } catch (e) { this.toasts.error('No se pudo crear el usuario', errorText(e)); } finally { this.busy.set(false); }
  }

  protected async save(u: User) {
    const d = this.drafts()[u.id];
    this.busy.set(true);
    try {
      await this.api.patch('/users/' + u.id, { role: d.role, active: d.active, assignedExecutiveId: d.assignedExecutiveId || null, kycVerified: d.kycVerified });
      this.toasts.success('Usuario actualizado', 'Las sesiones anteriores de este usuario fueron invalidadas.');
      await this.reload();
    } catch (e) {
      this.toasts.error('No se pudo guardar', errorText(e));
      await this.reload();
    } finally { this.busy.set(false); }
  }
}
