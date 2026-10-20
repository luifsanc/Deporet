import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorText } from '../core/api';
import { dateTime, money } from '../core/format';
import { IntegrationSettings, PlatformSettings } from '../core/models';
import { Field, FieldControl } from '../ui/field';
import { Icon } from '../ui/icon';
import { StatusBadge } from '../ui/status';
import { Toasts } from '../ui/toast';

@Component({
  selector: 'dr-settings',
  imports: [ReactiveFormsModule, Field, FieldControl, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <p class="eyebrow">Las reglas de tu plataforma</p>
      <h1 class="page-title mt-2">Configuración</h1>
      <p class="page-lead">Parámetros operativos e integración del proveedor de reportes de crédito.</p>
    </header>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section class="card card-pad h-fit" aria-labelledby="ops-title">
        <h2 id="ops-title" class="section-title">Operación y fiscalidad</h2>
        @if (settings(); as s) {
          <dl class="mt-4 divide-y divide-ink-100 text-sm">
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-500">Moneda</dt><dd class="font-medium text-ink-900">{{ s.currency }}</dd></div>
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-500">Modo de pagos</dt><dd><dr-status [value]="s.mode" /></dd></div>
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-500">IVA sobre comisión</dt><dd class="num font-medium text-ink-900">{{ s.fiscal.vatRate * 100 }}%</dd></div>
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-500">Límite diario por cliente</dt><dd class="num font-medium text-ink-900">{{ money(s.limits.daily) }}</dd></div>
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-500">Zona horaria</dt><dd class="font-medium text-ink-900">{{ s.timezone }}</dd></div>
          </dl>
          <p class="mt-2 break-all text-xs text-ink-400">Regla fiscal: {{ s.fiscal.ruleVersion }}</p>
          <h3 class="mt-6 text-sm font-semibold text-ink-900">Integraciones</h3>
          <ul class="mt-2 divide-y divide-ink-100 text-sm">
            @for (i of s.integrations; track i.name) {
              <li class="flex items-center justify-between gap-3 py-3"><span class="text-ink-700">{{ i.name }}</span><span class="badge" [class]="i.status === 'Produccion' ? 'badge-brand' : 'badge-warning'">{{ i.status }}</span></li>
            }
          </ul>
        } @else {
          <div class="mt-4 space-y-3">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-9"></div> }</div>
        }
      </section>

      <form [formGroup]="form" (ngSubmit)="save()" class="card card-pad" novalidate aria-labelledby="eqx-title">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="eqx-title" class="section-title">Conexión de reportes de crédito</h2><p class="text-sm text-ink-500">Proveedor contratado para la consulta Equifax.</p></div>
          <img src="/equifax.svg" alt="Equifax" class="h-5 w-auto" />
        </div>
        @if (integration(); as i) {
          <p class="mt-2 text-xs text-ink-400">Actualizado {{ dateTime(i.updatedAt) }}</p>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <dr-field label="Entorno" [showSuccess]="false">
              <select drControl id="eqx-mode" formControlName="mode"><option value="Sandbox">Sandbox · datos ficticios</option><option value="Produccion">Producción · proveedor contratado</option></select>
            </dr-field>
            <dr-field label="Endpoint HTTPS" [optional]="true" hint="Debe estar en Equifax:AllowedHosts del servidor.">
              <input drControl id="eqx-endpoint" type="url" formControlName="endpoint" maxlength="1000" autocomplete="off" />
            </dr-field>
            <dr-field [label]="'Client ID' + (i.hasClientId ? ' (guardado)' : '')" hint="Vacío conserva el existente." [showSuccess]="false"><input drControl id="eqx-client-id" type="password" formControlName="clientId" autocomplete="new-password" maxlength="4000" /></dr-field>
            <dr-field [label]="'API key' + (i.hasApiKey ? ' (guardada)' : '')" hint="Vacío conserva la existente." [showSuccess]="false">
              <input drControl id="eqx-key" type="password" formControlName="apiKey" autocomplete="new-password" maxlength="4000" />
            </dr-field>
            <dr-field [label]="'Client secret' + (i.hasClientSecret ? ' (guardado)' : '')" hint="Vacío conserva el existente." [showSuccess]="false">
              <input drControl id="eqx-secret" type="password" formControlName="clientSecret" autocomplete="new-password" maxlength="4000" />
            </dr-field>
          </div>
          <details class="group mt-5 rounded-2xl border border-ink-100 bg-ink-25 p-4">
            <summary class="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink-800">Contrato técnico del adaptador JSON <dr-icon name="down" class="size-4 transition group-open:rotate-180" /></summary>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <dr-field label="Plantilla JSON de solicitud" class="md:col-span-2" [hint]="templateHint" [showSuccess]="false">
                <textarea drControl id="eqx-template" class="font-mono text-[0.8125rem]!" formControlName="requestTemplate" rows="4" maxlength="4000"></textarea>
              </dr-field>
              <dr-field label="Ruta del score" [showSuccess]="false"><input drControl id="eqx-path" formControlName="scorePath" maxlength="100" /></dr-field>
              <dr-field label="Cabecera API key" [showSuccess]="false"><input drControl id="eqx-kh" formControlName="apiKeyHeader" maxlength="60" /></dr-field>
              <dr-field label="Cabecera Client ID" [showSuccess]="false"><input drControl id="eqx-ch" formControlName="clientIdHeader" maxlength="60" /></dr-field>
              <dr-field label="Cabecera secret" [showSuccess]="false"><input drControl id="eqx-sh" formControlName="secretHeader" maxlength="60" /></dr-field>
            </div>
          </details>
          <div class="mt-5 space-y-3">
            <label class="check-label"><input type="checkbox" class="check" formControlName="enabled" />Activar el servicio de consulta Equifax para clientes</label>
            <label class="check-label"><input type="checkbox" class="check" formControlName="contractVerified" />Confirmo que el contrato y la compatibilidad técnica del proveedor fueron validados.</label>
            <label class="check-label"><input type="checkbox" class="check" formControlName="clearSecrets" />Eliminar credenciales guardadas</label>
          </div>
          <div class="alert alert-info mt-5"><dr-icon name="info" />Solo se permiten destinos HTTPS de la lista autorizada del servidor. Configurar credenciales no sustituye la homologación con Equifax.</div>
          <div class="mt-5 flex justify-end">
            <div class="flex flex-wrap gap-2"><button type="button" class="btn btn-secondary" [disabled]="busy()||probeBusy()" (click)="probe()">@if(probeBusy()){<span class="spinner"></span>}Probar conexión</button><button type="submit" class="btn btn-primary" [disabled]="busy()">@if (busy()) { <span class="spinner"></span> } Guardar integración</button></div>
          </div>
        } @else {
          <div class="mt-5 grid gap-4 md:grid-cols-2">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-14"></div> }</div>
        }
      </form>
    </div>
    <section class="card card-pad mt-6" aria-labelledby="deuna-title">
      <h2 id="deuna-title" class="section-title">Código QR de cobro Deuna</h2><p class="mt-1 text-sm text-ink-500">Sube el QR oficial de la plataforma. Los clientes podrán verlo antes de reportar el pago.</p>
      <p class="mt-3 text-sm">Estado: <strong>{{qrStatus()?.configured ? 'Configurado' : 'Sin configurar · se muestra el mockup'}}</strong>@if(qrStatus()?.deunaQrFileName){ · {{qrStatus()?.deunaQrFileName}}}</p>
      <div class="mt-4 flex flex-wrap items-center gap-3"><input type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" (change)="pickQr($event)" class="block max-w-full text-sm" /><button type="button" class="btn btn-primary" [disabled]="!qrFile()||uploadingQr()" (click)="uploadQr()">@if(uploadingQr()){<span class="spinner"></span>}Guardar código QR</button></div>
      <p class="mt-2 text-xs text-ink-400">PNG, JPG o PDF · hasta 5 MB. El archivo queda en almacenamiento PostgreSQL.</p>
    </section>
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly money = money;
  protected readonly dateTime = dateTime;
  protected readonly templateHint = 'Variables disponibles: {{document}}, {{type}} y {{requestId}}.';
  protected readonly settings = signal<PlatformSettings | null>(null);
  protected readonly integration = signal<IntegrationSettings | null>(null);
  protected readonly qrStatus = signal<{configured:boolean;deunaQrFileName?:string|null;updatedAt?:string}|null>(null);
  protected readonly qrFile = signal<File|null>(null);
  protected readonly uploadingQr = signal(false);
  protected readonly busy = signal(false);
  protected readonly probeBusy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    mode: ['Sandbox'],
    endpoint: ['', [Validators.maxLength(1000), Validators.pattern(/^$|^https:\/\/.+/)]],
    clientId: [''],
    apiKey: [''],
    clientSecret: [''],
    requestTemplate: ['', [Validators.required, Validators.maxLength(4000)]],
    scorePath: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.]{1,100}$/)]],
    apiKeyHeader: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,60}$/)]],
    clientIdHeader: ['X-Client-Id', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,60}$/)]],
    secretHeader: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,60}$/)]],
    contractVerified: [false],
    enabled: [true],
    clearSecrets: [false],
  });

  async ngOnInit() {
    try {
      const [s, i, q] = await Promise.all([this.api.get<PlatformSettings>('/settings'), this.api.get<IntegrationSettings>('/integrations/equifax'),this.api.get<{configured:boolean;deunaQrFileName?:string|null;updatedAt?:string}>('/settings/deuna-qr/status')]);
      this.settings.set(s);
      this.qrStatus.set(q);
      this.apply(i);
    } catch (e) { this.toasts.error('No se pudo cargar la configuración', errorText(e)); }
  }

  private apply(i: IntegrationSettings) {
    this.integration.set(i);
    this.form.reset({ mode: i.mode, endpoint: i.endpoint, clientId:'', apiKey: '', clientSecret: '', requestTemplate: i.requestTemplate, scorePath: i.scorePath,
      apiKeyHeader: i.apiKeyHeader, clientIdHeader:i.clientIdHeader, secretHeader: i.secretHeader, contractVerified: i.contractVerified, enabled:i.enabled, clearSecrets: false });
  }

  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.api.put('/integrations/equifax', { ...v, clientId:v.clientId||null, apiKey: v.apiKey || null, clientSecret: v.clientSecret || null });
      this.apply(await this.api.get<IntegrationSettings>('/integrations/equifax'));
      this.settings.set(await this.api.get<PlatformSettings>('/settings'));
      this.toasts.success('Configuración guardada', 'Las credenciales se almacenaron cifradas y no se muestran nuevamente.');
    } catch (e) { this.toasts.error('No se pudo guardar', errorText(e)); } finally { this.busy.set(false); }
  }

  protected pickQr(event:Event){const file=(event.target as HTMLInputElement).files?.[0]??null;this.qrFile.set(file);}
  protected async uploadQr(){const file=this.qrFile();if(!file)return;const form=new FormData();form.append('file',file,file.name);this.uploadingQr.set(true);try{await this.api.putUpload('/settings/deuna-qr',form);this.qrStatus.set(await this.api.get('/settings/deuna-qr/status'));this.qrFile.set(null);this.toasts.success('Código QR actualizado','Ya está disponible para los clientes.');}catch(e){this.toasts.error('No se pudo guardar el QR',errorText(e));}finally{this.uploadingQr.set(false);}}
  protected async probe(){this.probeBusy.set(true);try{const result=await this.api.post<{message:string}>('/integrations/equifax/test',{});this.toasts.success('Prueba de conexión completada',result.message);}catch(e){this.toasts.error('No se pudo validar la conexión',errorText(e));}finally{this.probeBusy.set(false);}}
}
