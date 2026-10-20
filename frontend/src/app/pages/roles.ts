import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { RoleData, RoleView } from '../core/models';
import { Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Toasts } from '../ui/toast';

const LABELS: Record<string, string> = {
  'transactions.read': 'Ver operaciones', 'transactions.create': 'Emitir operaciones', 'transactions.settle': 'Liquidar operaciones',
  'topups.read': 'Ver recargas', 'topups.create': 'Solicitar recargas', 'topups.approve': 'Aprobar recargas',
  'users.read': 'Ver usuarios', 'users.create': 'Crear usuarios', 'users.manage': 'Gestionar accesos',
  'roles.manage': 'Gestionar roles', 'audit.read': 'Ver auditoría', 'integrations.manage': 'Configurar integraciones',
  'credit.request': 'Consultar Equifax', 'profile.edit': 'Editar perfil',
};

@Component({
  selector: 'dr-roles',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Acceso con propósito</p>
        <h1 class="page-title mt-2">Roles y permisos</h1>
        <p class="page-lead">Los permisos se guardan en la base de datos. Al editarlos se invalidan las sesiones del rol.</p>
      </div>
      <button type="button" class="btn btn-secondary" (click)="edit()"><dr-icon name="plus" /> Nuevo rol</button>
    </header>

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section class="card overflow-hidden h-fit" aria-labelledby="roles-title">
        <h2 id="roles-title" class="section-title px-5 pb-2 pt-5">Roles disponibles</h2>
        <ul class="p-2">
          @for (r of data()?.roles ?? []; track r.name) {
            <li><button type="button" class="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-ink-50" [class.bg-brand-50]="editing() === r.name" (click)="edit(r)">
              <span class="icon-tile size-9" [class.is-brand]="editing() === r.name"><dr-icon name="key" class="size-[1.125rem]" /></span>
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold text-ink-900">{{ r.displayName }}</span><span class="block text-xs text-ink-500">{{ baseLabel(r.baseRole) }} · {{ r.permissions.length }} permisos @if (r.system) { · sistema }</span></span>
              <dr-icon name="chevron-right" class="size-4 text-ink-300" />
            </button></li>
          }
        </ul>
      </section>

      <form [formGroup]="form" (ngSubmit)="save()" class="card card-pad" novalidate>
        <h2 class="section-title">{{ editing() ? 'Editar rol' : 'Crear rol' }}</h2>
        <div class="mt-5 grid gap-4 md:grid-cols-3">
          <dr-field label="Identificador" hint="Letras, números, guion o guion bajo.">
            <input drControl id="role-name" formControlName="name" maxlength="50" autocomplete="off" [readonly]="!!editing()" />
          </dr-field>
          <dr-field label="Nombre visible"><input drControl id="role-display" formControlName="displayName" maxlength="80" autocomplete="off" /></dr-field>
          <dr-field label="Perfil base" [showSuccess]="false">
            <select drControl id="role-base" formControlName="baseRole"><option value="Cliente">Cliente</option><option value="Ejecutivo">Operador</option><option value="Administrador">Administrador</option></select>
          </dr-field>
        </div>
        <h3 class="mt-6 text-sm font-semibold text-ink-900">Permisos permitidos para {{ base() }}</h3>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          @for (p of allowed(); track p) {
            <label class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition" [class]="selected().includes(p) ? 'border-brand-300 bg-brand-50/60' : 'border-ink-100 hover:border-ink-200'">
              <input type="checkbox" class="check mt-0" [checked]="selected().includes(p)" (change)="toggle(p, $any($event.target).checked)" />
              <span class="min-w-0"><span class="block text-sm font-medium text-ink-900">{{ label(p) }}</span><code class="text-ink-400">{{ p }}</code></span>
            </label>
          }
        </div>
        <div class="mt-6 flex justify-end">
          <button type="submit" class="btn btn-primary" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> } Guardar rol</button>
        </div>
      </form>
    </div>
  `,
})
export class RolesPage implements OnInit {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly toasts = inject(Toasts);
  protected readonly data = signal<RoleData | null>(null);
  protected readonly editing = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-z0-9ÁÉÍÓÚáéíóúÑñ_-]{2,49}$/)]],
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    baseRole: ['Cliente'],
  });
  protected readonly base = toSignal(this.form.controls.baseRole.valueChanges, { initialValue: 'Cliente' });
  protected readonly allowed = computed(() => this.data()?.allowedByBase[this.base()] ?? []);

  constructor() {
    this.form.controls.baseRole.valueChanges.subscribe(() => { if (!this.editing()) this.selected.set([]); });
  }

  async ngOnInit() {
    try { this.data.set(await this.api.get<RoleData>('/roles')); } catch (e) { this.toasts.error('No se pudieron cargar los roles', errorText(e)); }
  }

  protected label(code: string) { return LABELS[code] ?? code; }
  protected baseLabel(base: string) { return base === 'Ejecutivo' ? 'Operador' : base; }
  protected toggle(code: string, checked: boolean) { this.selected.update(list => (checked ? [...new Set([...list, code])] : list.filter(x => x !== code))); }

  protected edit(r?: RoleView) {
    this.editing.set(r?.name ?? '');
    this.form.reset({ name: r?.name ?? '', displayName: r?.displayName ?? '', baseRole: r?.baseRole ?? 'Cliente' });
    if (r) this.form.controls.baseRole.disable(); else this.form.controls.baseRole.enable();
    this.selected.set([...(r?.permissions ?? [])]);
  }

  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.put('/roles', { name: v.name, displayName: v.displayName, baseRole: v.baseRole, permissions: this.selected() });
      if (v.name === this.session.user()?.role) { this.session.logout('Permisos actualizados. Vuelve a ingresar.'); return; }
      this.data.set(await this.api.get<RoleData>('/roles'));
      this.toasts.success('Rol guardado', 'Las sesiones de este rol deberán ingresar de nuevo.');
    } catch (e) { this.toasts.error('No se pudo guardar el rol', errorText(e)); } finally { this.busy.set(false); }
  }
}
