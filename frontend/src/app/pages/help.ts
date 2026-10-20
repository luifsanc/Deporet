import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../ui/icon';

const TOPICS = [
  { icon: 'arrows', title: '¿Cómo funciona una operación?', text: 'Para transferencias y giros, completa los datos del beneficiario y revisa el monto más la comisión fija de $0.45. El total se reserva al solicitar; al liquidarse se debita y si se rechaza se libera la reserva.' },
  { icon: 'users', title: '¿Qué puedo hacer con mi perfil?', text: 'Cliente: operar, recargar y consultar sus movimientos. Operador: revisar, aprobar o rechazar transacciones y acreditaciones, y consultar auditoría. Administrador: además gestiona usuarios, roles y configuración.' },
  { icon: 'chart', title: '¿Qué incluye el reporte Equifax?', text: 'Score de referencia con escala de riesgo, obligaciones directas e indirectas, mora histórica y distribución de deuda por entidad, en un PDF listo para imprimir. En Sandbox el reporte es ficticio y está marcado como tal.' },
  { icon: 'receipt', title: '¿Las constancias son facturas?', text: 'No. Son constancias internas sin validez tributaria. La facturación electrónica autorizada por el SRI se integrará antes de operar comercialmente.' },
  { icon: 'lock', title: '¿Cómo se protege mi sesión?', text: 'Tu sesión vence a los 20 minutos y te avisamos dos minutos antes. El token se mantiene solo en memoria: si recargas la página, vuelve a ingresar.' },
  { icon: 'shield', title: '¿Qué es el entorno Sandbox?', text: 'Un espacio de pruebas: saldos y operaciones simuladas, sin dinero real ni conexión con bancos o el buró de crédito.' },
];

@Component({
  selector: 'dr-help',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <p class="eyebrow">Estamos cerca</p>
      <h1 class="page-title mt-2">Centro de ayuda</h1>
      <p class="page-lead">Todo lo que necesitas saber sobre esta versión de DepoRet.</p>
    </header>
    <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      @for (t of topics; track t.title) {
        <article class="card card-pad">
          <span class="icon-tile is-brand"><dr-icon [name]="t.icon" /></span>
          <h2 class="mt-4 text-base font-semibold">{{ t.title }}</h2>
          <p class="mt-2 text-sm leading-relaxed text-ink-500">{{ t.text }}</p>
        </article>
      }
    </div>
  `,
})
export class HelpPage {
  protected readonly topics = TOPICS;
}
