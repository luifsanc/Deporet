import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorText } from '../core/api';
import { Session } from '../core/session';
import { Dialogs } from '../core/dialogs';
import { money, shortDateTime, todayLabel } from '../core/format';
import { Icon } from '../ui/icon';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

@Component({
  selector: 'dr-dashboard',
  imports: [RouterLink, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = session.dashboard();
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Tu día, bajo control</p>
        <h1 class="page-title mt-2">Hola, {{ firstName() }}<span class="text-brand-600">.</span></h1>
        <p class="page-lead">{{ session.isClient() ? 'Todo lo que necesitas para mover tu mundo.' : 'El pulso de la operación, en tiempo real.' }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="hidden items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[0.8125rem] capitalize text-ink-500 sm:inline-flex"><dr-icon name="calendar" class="size-4" />{{ today }}</span>
        @if (session.has('transactions.create')) {
          <a routerLink="/transferencias" class="btn btn-primary"><dr-icon name="plus" /> Nueva transferencia</a>
        }
      </div>
    </header>

    <section class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]" aria-label="Resumen de la cuenta">
      <article class="bg-brand-glow relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-lift)] md:col-span-2 xl:col-span-1">
        <div class="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border border-white/10" aria-hidden="true"></div>
        <div class="pointer-events-none absolute -right-4 -top-4 size-32 rounded-full border border-white/10" aria-hidden="true"></div>
        <div class="relative flex items-center justify-between">
          <span class="inline-flex items-center gap-2 text-sm text-navy-200"><dr-icon name="wallet" class="size-[1.125rem]" />{{ session.isClient() ? 'Saldo disponible' : 'Saldo total de clientes' }}</span>
          <button type="button" class="btn btn-icon size-9 text-navy-200 hover:bg-white/10! hover:text-white!" (click)="hidden.set(!hidden())" [attr.aria-label]="hidden() ? 'Mostrar saldo' : 'Ocultar saldo'">
            <dr-icon [name]="hidden() ? 'eye-off' : 'eye'" />
          </button>
        </div>
        @if (d) {
          <p class="num relative mt-4 text-[2.5rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl">{{ hidden() ? '••••••' : money(d.balance) }}<span class="ml-2 text-sm font-medium tracking-normal text-navy-300">USD</span></p>
          <div class="relative mt-6 flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-white/10 px-3 py-1.5 text-navy-100">Contable <span class="num font-semibold text-white">{{ hidden() ? '••••' : money(d.ledgerBalance) }}</span></span>
            <span class="rounded-full bg-white/10 px-3 py-1.5 text-navy-100">Reservado <span class="num font-semibold text-white">{{ hidden() ? '••••' : money(d.reserved) }}</span></span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-navy-100"><span class="size-1.5 rounded-full bg-emerald-400"></span>{{ session.mode() === 'Sandbox' ? 'Saldo de prueba' : 'Saldo verificado' }}</span>
          </div>
        } @else {
          <div class="skeleton mt-5 h-12 w-56 opacity-20"></div><div class="skeleton mt-6 h-7 w-72 opacity-20"></div>
        }
      </article>

      <article class="card card-pad">
        <div class="flex items-center justify-between"><span class="icon-tile is-brand"><dr-icon name="trend" /></span><span class="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Hoy</span></div>
        <p class="mt-4 text-sm text-ink-500">{{ session.isClient() ? 'Monto enviado' : 'Volumen liquidado' }}</p>
        @if (d) { <p class="num mt-1 text-3xl font-bold tracking-[-0.03em] text-ink-950">{{ money(d.todayVolume) }}</p> } @else { <div class="skeleton mt-2 h-9 w-36"></div> }
        <p class="mt-2 text-xs text-ink-400">Operaciones liquidadas · USD</p>
      </article>

      <article class="card card-pad">
        <div class="flex items-center justify-between"><span class="icon-tile is-navy"><dr-icon name="check-circle" /></span><span class="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Acumulado</span></div>
        <p class="mt-4 text-sm text-ink-500">Operaciones liquidadas</p>
        @if (d) {
          <p class="num mt-1 text-3xl font-bold tracking-[-0.03em] text-ink-950">{{ d.completed }}</p>
          <p class="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
            @if (d.pending) { <dr-status value="Procesando" [label]="d.pending + ' en proceso'" /> } @else { <span>Sin operaciones pendientes</span> }
          </p>
        } @else { <div class="skeleton mt-2 h-9 w-20"></div> }
      </article>
    </section>

    @if (session.isClient()) {
      <section class="mt-8" aria-labelledby="quick-title">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div><h2 id="quick-title" class="section-title">¿Qué hacemos hoy?</h2><p class="mt-1 text-sm text-ink-500">Accede a las operaciones habilitadas para tu cuenta.</p></div>
          <span class="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400 sm:block">Rápido · Simple · Cerca</span>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          @for (s of session.services(); track s.id) {
            <a [routerLink]="s.id === 'giro' ? '/giros-nacionales' : '/transferencias'" class="card card-interactive group flex min-h-36 flex-col items-start p-4 sm:p-5" [style.background]="s.id === 'transferencia' ? 'var(--color-brand-50)' : null" [class.border-brand-100]="s.id === 'transferencia'">
              <span class="icon-tile" [class.is-brand]="s.id === 'transferencia'"><dr-icon [name]="s.icon" /></span>
              <span class="mt-4 text-sm font-semibold text-ink-900">{{ s.name }}</span>
              <span class="mt-1 text-xs leading-relaxed text-ink-500">{{ s.description }}</span>
              <dr-icon name="arrow-up-right" class="mt-auto size-4 self-end text-ink-300 transition group-hover:text-brand-600" />
            </a>
          }
          <a routerLink="/equifax" class="card card-interactive group flex min-h-36 flex-col items-start p-4 sm:p-5">
            <span class="icon-tile is-navy"><dr-icon name="chart" /></span>
            <span class="mt-4 text-sm font-semibold text-ink-900">Consulta Equifax</span>
            <span class="mt-1 text-xs leading-relaxed text-ink-500">Tu score y reporte en PDF</span>
            <dr-icon name="arrow-up-right" class="mt-auto size-4 self-end text-ink-300 transition group-hover:text-brand-600" />
          </a>
          <a routerLink="/recargas" class="card card-interactive group flex min-h-36 flex-col items-start p-4 sm:p-5"><span class="icon-tile"><dr-icon name="wallet" /></span><span class="mt-4 text-sm font-semibold text-ink-900">Recarga saldo</span><span class="mt-1 text-xs text-ink-500">Acreditación bancaria gratuita</span><dr-icon name="arrow-up-right" class="mt-auto size-4 self-end text-ink-300" /></a>
          <a routerLink="/efectivo-movil" class="card card-interactive group flex min-h-36 flex-col items-start p-4 sm:p-5"><span class="icon-tile"><dr-icon name="phone" /></span><span class="mt-4 text-sm font-semibold text-ink-900">Efectivo Móvil</span><span class="mt-1 text-xs text-ink-500">Banco Guayaquil</span><dr-icon name="arrow-up-right" class="mt-auto size-4 self-end text-ink-300" /></a>
          <a routerLink="/deuna" class="card card-interactive group flex min-h-36 flex-col items-start p-4 sm:p-5"><span class="icon-tile"><dr-icon name="qr" /></span><span class="mt-4 text-sm font-semibold text-ink-900">Deuna</span><span class="mt-1 text-xs text-ink-500">Pago QR Banco Pichincha</span><dr-icon name="arrow-up-right" class="mt-auto size-4 self-end text-ink-300" /></a>
        </div>
      </section>
    } @else {
      <section class="card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span class="icon-tile is-brand size-12 rounded-2xl"><dr-icon name="shield" class="size-6" /></span>
        <div class="flex-1">
          <h2 class="section-title"><span class="num">{{ d?.pending ?? 0 }}</span> operaciones por revisar</h2>
          <p class="mt-1 text-sm text-ink-500">Verifica el detalle y registra tu decisión antes de liquidar.@if (session.has('topups.approve') && d?.pendingTopups) { También hay <strong class="num text-ink-800">{{ d?.pendingTopups }}</strong> recargas por validar. }</p>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (session.has('topups.approve')) { <a routerLink="/recargas" class="btn btn-secondary">Recargas</a> }
          <a routerLink="/revision" class="btn btn-primary">Ir a la bandeja <dr-icon name="arrow" /></a>
        </div>
      </section>
    }

    <div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section class="card overflow-hidden" aria-labelledby="recent-title">
        <div class="flex items-center justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
          <div><h2 id="recent-title" class="section-title">Últimos movimientos</h2><p class="mt-0.5 text-sm text-ink-500">Tu actividad, siempre a la vista.</p></div>
          <a routerLink="/movimientos" class="btn btn-link btn-sm">Ver todos <dr-icon name="arrow" /></a>
        </div>
        @if (!d) {
          <div class="space-y-3 px-6 pb-6">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-12"></div> }</div>
        } @else if (!d.recent.length) {
          <div class="flex flex-col items-center px-6 pb-12 pt-6 text-center">
            <span class="icon-tile size-12 rounded-2xl"><dr-icon name="arrows" class="size-6" /></span>
            <p class="mt-4 font-semibold text-ink-800">Tu próximo movimiento empieza aquí.</p>
            <p class="mt-1 text-sm text-ink-500">Cuando realices una operación aparecerá en este espacio.</p>
          </div>
        } @else {
          <div class="table-wrap hidden sm:block">
            <table class="table-modern">
              <thead><tr><th>Operación</th><th>Fecha</th><th class="text-right">Monto</th><th>Estado</th><th><span class="sr-only">Detalle</span></th></tr></thead>
              <tbody>
                @for (p of d.recent; track p.id) {
                  <tr class="cursor-pointer" (click)="dialogs.receipt.set(p)">
                    <td><div class="flex items-center gap-3"><span class="icon-tile size-9" [class.is-brand]="p.kind === 'transferencia'"><dr-icon [name]="session.serviceIcon(p.kind)" class="size-[1.125rem]" /></span>
                      <div class="min-w-0"><p class="truncate font-medium text-ink-900">{{ session.serviceName(p.kind) }}</p><p class="truncate text-xs text-ink-500">{{ p.recipient }}</p></div></div></td>
                    <td class="num whitespace-nowrap text-ink-500">{{ shortDateTime(p.createdAt) }}</td>
                    <td class="num whitespace-nowrap text-right font-semibold text-ink-900">{{ money(p.total) }}</td>
                    <td><dr-status [value]="p.status" /></td>
                    <td class="text-right"><button type="button" class="btn btn-icon size-8" aria-label="Ver constancia"><dr-icon name="chevron-right" class="size-4" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="sm:hidden">
            @for (p of d.recent; track p.id) {
              <li><button type="button" class="list-row w-full text-left" (click)="dialogs.receipt.set(p)">
                <span class="icon-tile size-10"><dr-icon [name]="session.serviceIcon(p.kind)" class="size-[1.125rem]" /></span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium text-ink-900">{{ p.recipient }}</span><span class="block text-xs text-ink-500">{{ session.serviceName(p.kind) }} · {{ shortDateTime(p.createdAt) }}</span></span>
                <span class="flex flex-col items-end gap-1"><span class="num text-sm font-semibold text-ink-900">{{ money(p.total) }}</span><dr-status [value]="p.status" /></span>
              </button></li>
            }
          </ul>
        }
      </section>

      <aside class="flex flex-col gap-4">
        <section class="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-navy-50 p-6">
          <div class="flex items-center justify-between"><span class="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-700">Tu salud financiera</span><dr-icon name="chart" class="size-5 text-brand-500" /></div>
          <h2 class="mt-3 text-xl font-bold leading-snug tracking-[-0.02em]">Conoce tu historia.<br />Planea lo que viene.</h2>
          <p class="mt-2 text-sm leading-relaxed text-ink-500">Tu score Equifax con reporte PDF listo para imprimir.</p>
          <div class="mt-5 flex h-16 items-end gap-1.5" aria-hidden="true">
            @for (h of bars; track $index) { <span class="flex-1 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400" [style.height.%]="h" [style.opacity]="0.35 + $index * 0.11"></span> }
          </div>
          @if (session.has('credit.request')) {
            <a routerLink="/credito" class="btn btn-dark btn-block mt-5">Consultar mi score <dr-icon name="arrow" /></a>
          } @else {
            <span class="badge badge-neutral mt-5">Disponible para clientes</span>
          }
        </section>
        <div class="card flex gap-3 p-5">
          <span class="icon-tile is-navy"><dr-icon name="shield" /></span>
          <div><p class="text-sm font-semibold text-ink-900">Claridad en cada movimiento</p><p class="mt-1 text-[0.8125rem] leading-relaxed text-ink-500">Revisa monto, comisión e IVA antes de confirmar. Cada decisión queda en auditoría.</p></div>
        </div>
      </aside>
    </div>

    <footer class="mt-10 flex flex-col gap-1 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:justify-between">
      <span>{{ session.mode() === 'Sandbox' ? 'Entorno de pruebas · operaciones simuladas' : 'Operaciones con liquidación manual' }}</span>
      <span>USD · Ecuador continental (UTC−5)</span>
    </footer>
  `,
})
export class DashboardPage implements OnInit {
  protected readonly session = inject(Session);
  protected readonly dialogs = inject(Dialogs);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly shortDateTime = shortDateTime;
  protected readonly today = todayLabel();
  protected readonly hidden = signal(false);
  protected readonly bars = [28, 44, 38, 62, 78, 100];
  protected readonly firstName = computed(() => this.session.user()?.name.split(' ')[0] ?? '');

  async ngOnInit() {
    try { await this.session.refresh(); } catch (e) { this.toasts.error('No se pudo actualizar el resumen', errorText(e)); }
  }

}
