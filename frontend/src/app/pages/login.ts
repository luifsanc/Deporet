import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { errorText } from '../core/api';
import { Session } from '../core/session';
import { Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { Logo } from '../ui/logo';

@Component({
  selector: 'dr-login',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <!-- Brand story -->
      <section class="bg-brand-glow relative overflow-hidden px-6 py-6 text-white sm:px-10 lg:flex lg:flex-col lg:px-16 lg:py-12">
        <div class="pointer-events-none absolute -right-40 bottom-[-12rem] hidden size-[34rem] rounded-full border border-white/10 lg:block" aria-hidden="true"></div>
        <div class="pointer-events-none absolute -right-24 bottom-[-6rem] hidden size-[24rem] rounded-full border-[48px] border-brand-500/10 lg:block" aria-hidden="true"></div>
        <dr-logo tone="light" [size]="38" class="relative" />
        <div class="relative my-auto hidden max-w-xl py-16 lg:block">
          <p class="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-navy-300">DEPÓSITOS Y RETIROS BANCARIOS</p>
          <h1 class="text-[clamp(2.75rem,4.6vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.045em] text-white">
            Tu dinero.<br />Tus planes.<br /><span class="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">Más cerca.</span>
          </h1>
          <p class="mt-5 brand-accent text-base font-semibold">Tu banco más cerca de ti.</p><p class="mt-6 max-w-md text-lg leading-relaxed text-navy-200">Transfiere, acredita saldo y consulta tu historial crediticio desde una sola plataforma.</p>
          <ul class="mt-10 grid max-w-lg grid-cols-3 gap-3">
            @for (f of features; track f.label) {
              <li class="card-glass border-white/10! bg-white/[0.06]! p-4">
                <dr-icon [name]="f.icon" class="size-5 text-brand-300" />
                <p class="mt-3 text-sm font-semibold text-white">{{ f.label }}</p>
                <p class="mt-0.5 text-xs text-navy-300">{{ f.text }}</p>
              </li>
            }
          </ul>
        </div>
        <p class="relative hidden items-center justify-between text-xs text-navy-300 lg:flex">
          <span>USD · Ecuador continental (UTC−5)</span><span>© {{ year }} DepoRet</span>
        </p>
      </section>

      <!-- Form -->
      <section class="flex items-start justify-center bg-white px-5 py-10 sm:px-10 lg:items-center">
        <div class="w-full max-w-[25rem]" style="animation: var(--animate-rise-in)">
          <span class="badge badge-neutral"><span class="badge-dot"></span> Acceso seguro · Ecuador</span>
          <h2 class="mt-6 text-[2rem] font-bold tracking-[-0.035em]">Qué bueno verte.</h2>
          <p class="mt-2 text-ink-500">Ingresa a tu espacio DepoRet.</p>

          @if (session.notice() || error()) {
            <div class="alert mt-6" [class]="error() ? 'alert-error' : 'alert-info'" role="alert">
              <dr-icon [name]="error() ? 'alert-circle' : 'info'" />{{ error() || session.notice() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-7 space-y-4" novalidate>
            <dr-field label="Correo electrónico" [showSuccess]="false">
              <input drControl id="login-email" type="email" formControlName="email" autocomplete="username" maxlength="254" autofocus />
            </dr-field>
            <dr-field label="Contraseña" [showSuccess]="false">
              <input drControl id="login-password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" maxlength="256" />
              <button trail type="button" class="btn btn-icon" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <dr-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
              </button>
            </dr-field>
            <button type="submit" class="btn btn-primary btn-lg btn-block mt-2" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> Ingresando… } @else { Ingresar a DepoRet <dr-icon name="arrow" /> }
            </button>
          </form>

          <div class="mt-8 flex gap-3 rounded-2xl border border-ink-100 bg-ink-25 p-4 text-[0.8125rem] leading-relaxed text-ink-500">
            <dr-icon name="lock" class="mt-0.5 size-[1.125rem] shrink-0 text-ink-400" />
            <p>Las transacciones se registran para validación bancaria; el saldo se acredita o liquida después de la aprobación operativa. Equifax inicia en Sandbox hasta que Administración active su conexión de producción. Tu sesión se mantiene solo en memoria.</p>
          </div>
          <p class="mt-10 flex justify-between text-xs text-ink-400 lg:hidden"><span>Tu dinero, más cerca.</span><span>© {{ year }} DepoRet</span></p>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage {
  /** Deep link to return to after signing in (from the auth guard). */
  readonly next = input('');
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(256)]],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly year = new Date().getFullYear();
  protected readonly features = [
    { icon: 'arrows', label: 'Transfiere', text: 'A cualquier banco' },
    { icon: 'wallet', label: 'Acredita', text: 'Recargas y Deuna' },
    { icon: 'chart', label: 'Conoce', text: 'Tu score Equifax' },
  ];

  protected async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.session.login(email.trim(), password);
      const next = this.next() ?? '';
      const target = next.replace(/^\//, '').split(/[/?#]/)[0];
      await this.router.navigateByUrl(target && this.session.canVisit(target) ? next : '/' + this.session.homePath());
    } catch (e) {
      this.error.set(errorText(e));
      this.form.controls.password.reset('');
    } finally {
      this.busy.set(false);
    }
  }
}
