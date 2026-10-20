import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { Api, errorText } from '../core/api';
import { Session } from '../core/session';
import { initials } from '../core/format';
import { User } from '../core/models';
import { DrValidators, Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Toasts } from '../ui/toast';

const differentFromCurrent = (control: AbstractControl): ValidationErrors | null =>
  control.value && control.value === control.parent?.get('currentPassword')?.value ? { same: 'Elige una contraseña diferente a la actual.' } : null;

@Component({
  selector: 'dr-profile',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let user = session.user()!;
    <header>
      <p class="eyebrow">Tu espacio personal</p>
      <h1 class="page-title mt-2">Mi perfil</h1>
      <p class="page-lead">Mantén tus datos y tu acceso actualizados.</p>
    </header>

    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <section class="card card-pad" aria-labelledby="profile-data-title">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <span class="relative inline-flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-2xl font-bold text-brand-700 ring-4 ring-white shadow-[var(--shadow-card)]">
            @if (session.avatarUrl()) { <img [src]="session.avatarUrl()" alt="Foto de perfil" class="size-full object-cover" /> } @else { {{ initials(user.name) }} }
          </span>
          <div class="text-center sm:text-left">
            <h2 id="profile-data-title" class="text-lg font-semibold">{{ user.name }}</h2>
            <p class="text-sm text-ink-500">{{ user.email }} · {{ user.roleLabel }}</p>
            <label class="btn btn-secondary btn-sm mt-3 cursor-pointer" [class.opacity-55]="busy()">
              @if (uploading()) { <span class="spinner"></span> } @else { <dr-icon name="upload" /> } Cambiar foto
              <input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp" [disabled]="busy()" (change)="upload($event)" />
            </label>
          </div>
        </div>
        <p class="mt-3 text-center text-xs text-ink-400 sm:text-left">JPG, PNG o WebP · hasta 2 MB. La imagen se valida y se vuelve a codificar para eliminar metadatos.</p>
        <div class="divider my-6"></div>
        <form [formGroup]="profile" (ngSubmit)="saveProfile()" class="space-y-4" novalidate>
          <dr-field label="Nombre"><input drControl id="profile-name" formControlName="name" maxlength="100" autocomplete="name" /></dr-field>
          <dr-field label="Teléfono" [optional]="true" hint="Formato internacional, por ejemplo +593991234567.">
            <input drControl id="profile-phone" type="tel" inputmode="tel" formControlName="phone" maxlength="16" autocomplete="tel" />
          </dr-field>
          <dr-field label="Correo electrónico" [showSuccess]="false"><input drControl id="profile-email" [value]="user.email" readonly /></dr-field>
          <button type="submit" class="btn btn-primary btn-block" [disabled]="busy() || profile.pristine">@if (busy() && !uploading()) { <span class="spinner"></span> } Guardar datos</button>
        </form>
      </section>

      <form [formGroup]="password" (ngSubmit)="changePassword()" class="card card-pad h-fit" novalidate aria-labelledby="password-title">
        <div class="flex items-center gap-3">
          <span class="icon-tile is-navy"><dr-icon name="lock" /></span>
          <div><h2 id="password-title" class="section-title">Cambiar contraseña</h2><p class="text-sm text-ink-500">Al guardar se cerrarán todas tus sesiones.</p></div>
        </div>
        <div class="mt-5 space-y-4">
          <dr-field label="Contraseña actual" [showSuccess]="false"><input drControl id="pwd-current" type="password" formControlName="currentPassword" autocomplete="current-password" maxlength="256" /></dr-field>
          <dr-field label="Nueva contraseña" [warning]="strength().warning" [successText]="strength().label">
            <input drControl id="pwd-new" type="password" formControlName="newPassword" autocomplete="new-password" maxlength="128" />
          </dr-field>
          <div class="grid grid-cols-4 gap-1.5" aria-hidden="true">
            @for (i of [0, 1, 2, 3]; track i) { <span class="h-1.5 rounded-full transition-colors" [class]="i < strength().score ? strength().color : 'bg-ink-100'"></span> }
          </div>
          <p class="text-xs text-ink-500">Usa al menos 12 caracteres. Combina mayúsculas, minúsculas, números y símbolos.</p>
        </div>
        <button type="submit" class="btn btn-dark btn-block mt-5" [disabled]="busy()">Actualizar contraseña</button>
      </form>
    </div>
  `,
})
export class ProfilePage implements OnInit {
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly initials = initials;
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);

  protected readonly profile = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    phone: ['', [DrValidators.phone()]],
  });
  protected readonly password = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128), differentFromCurrent]],
  });
  private readonly newPassword = toSignal(this.password.controls.newPassword.valueChanges.pipe(startWith('')), { initialValue: '' });
  protected readonly strength = computed(() => {
    const v = this.newPassword();
    const score = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length + (v.length >= 16 ? 1 : 0);
    const level = Math.min(4, v.length < 12 ? Math.min(score, 1) : score);
    return {
      score: v ? Math.max(1, level) : 0,
      color: level >= 4 ? 'bg-emerald-500' : level >= 3 ? 'bg-amber-400' : 'bg-rose-400',
      label: level >= 4 ? 'Contraseña robusta.' : 'Contraseña aceptable.',
      warning: v.length >= 12 && level < 3 ? 'Es válida, pero agrega números o símbolos para hacerla más segura.' : null,
    };
  });

  constructor() {
    this.password.controls.currentPassword.valueChanges.subscribe(() => this.password.controls.newPassword.updateValueAndValidity());
  }

  ngOnInit() {
    const u = this.session.user()!;
    this.profile.reset({ name: u.name, phone: u.phone ?? '' });
  }

  protected async saveProfile() {
    this.profile.markAllAsTouched();
    if (this.profile.invalid) return;
    this.busy.set(true);
    try {
      const v = this.profile.getRawValue();
      const updated = await this.api.patch<User>('/profile', { name: v.name.trim(), phone: v.phone.trim() });
      this.session.user.set(updated);
      this.profile.reset({ name: updated.name, phone: updated.phone ?? '' });
      this.toasts.success('Perfil actualizado');
    } catch (e) { this.toasts.error('No se pudo guardar', errorText(e)); } finally { this.busy.set(false); }
  }

  protected async changePassword() {
    this.password.markAllAsTouched();
    if (this.password.invalid) return;
    this.busy.set(true);
    try {
      await this.api.post('/profile/password', this.password.getRawValue());
      this.session.logout('Contraseña actualizada. Ingresa nuevamente con tu nueva contraseña.');
    } catch (e) { this.toasts.error('No se pudo cambiar la contraseña', errorText(e)); } finally { this.busy.set(false); }
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.toasts.error('Archivo no válido', 'Selecciona una imagen JPG, PNG o WebP de hasta 2 MB.');
      return;
    }
    this.busy.set(true);
    this.uploading.set(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await this.api.upload('/profile/avatar', form);
      this.session.user.update(u => (u ? { ...u, hasAvatar: true } : u));
      await this.session.loadAvatar();
      this.toasts.success('Foto actualizada', 'La imagen fue validada y optimizada.');
    } catch (e) { this.toasts.error('No se pudo guardar la imagen', errorText(e)); } finally { this.busy.set(false); this.uploading.set(false); }
  }
}
