import { ChangeDetectionStrategy, Component, contentChild, Directive, ElementRef, inject, input } from '@angular/core';
import { AbstractControl, NgControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Icon } from './icon';

type FieldState = 'error' | 'warning' | 'success' | null;

const DEFAULT_MESSAGES: Record<string, (e: any) => string> = {
  required: () => 'Este campo es obligatorio.',
  requiredTrue: () => 'Debes aceptar para continuar.',
  email: () => 'Ingresa un correo electrónico válido.',
  minlength: e => `Ingresa al menos ${e.requiredLength} caracteres.`,
  maxlength: e => `Máximo ${e.requiredLength} caracteres.`,
  min: e => `El valor mínimo es ${e.min}.`,
  max: e => `El valor máximo es ${e.max}.`,
  pattern: () => 'El formato no es válido.',
  ecuadorianId: () => 'La cédula ecuatoriana no es válida (módulo 10).',
  decimals: () => 'Usa como máximo dos decimales.',
  digits: e => `Debe tener ${e.expected} dígitos numéricos.`,
  mobile: () => 'Debe tener 10 dígitos y empezar por 09.',
  phone: () => 'Usa solo números, opcionalmente con + al inicio (7 a 15 dígitos).',
};

/** Marks the native input/select/textarea inside <dr-field> and wires accessibility. */
@Directive({
  selector: 'input[drControl], select[drControl], textarea[drControl]',
  host: {
    class: 'field-control',
    placeholder: ' ',
    '[attr.aria-invalid]': 'field?.state() === "error" ? "true" : null',
    '[attr.aria-describedby]': 'field?.hasMessage() ? id + "-msg" : null',
  },
})
export class FieldControl {
  readonly ngControl = inject(NgControl, { self: true, optional: true });
  readonly field = inject(Field, { optional: true });
  get id(): string { return this.element.nativeElement.id; }
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
}

/**
 * Floating-label field with real-time validation states.
 * Usage: <dr-field label="Correo"><input drControl id="email" formControlName="email"></dr-field>
 */
@Component({
  selector: 'dr-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.Default,
  host: { class: 'block' },
  template: `
    <div class="field" [class.has-prefix]="!!prefix()" [class.has-trail]="true"
         [class.is-error]="state() === 'error'" [class.is-warning]="state() === 'warning'" [class.is-success]="state() === 'success'">
      @if (prefix()) { <span class="field-prefix">{{ prefix() }}</span> }
      <ng-content />
      <label class="field-label" [attr.for]="control()?.id">{{ label() }}@if (optional()) {<span class="field-optional"> · opcional</span>}</label>
      <span class="field-trail">
        <ng-content select="[trail]" />
        @switch (state()) {
          @case ('error') { <dr-icon name="alert-circle" /> }
          @case ('warning') { <dr-icon name="alert" /> }
          @case ('success') { <dr-icon name="check-circle" /> }
        }
      </span>
    </div>
    @if (message(); as m) {
      <p class="field-msg" [class.is-error]="state() === 'error'" [class.is-warning]="state() === 'warning'" [class.is-success]="state() === 'success'"
         [id]="control()?.id + '-msg'" [attr.role]="state() === 'error' ? 'alert' : null">
        <dr-icon [name]="state() === 'error' ? 'alert-circle' : state() === 'warning' ? 'alert' : 'check-circle'" />{{ m }}
      </p>
    } @else if (hint()) {
      <p class="field-hint" [id]="control()?.id + '-msg'">{{ hint() }}</p>
    }
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly prefix = input('');
  readonly optional = input(false);
  /** Non-blocking advisory shown in amber when the control is otherwise valid. */
  readonly warning = input<string | null>(null);
  /** Message shown in green once a dirty control becomes valid. */
  readonly successText = input('');
  readonly showSuccess = input(true);
  readonly messages = input<Record<string, string>>({});
  protected readonly control = contentChild(FieldControl);

  state(): FieldState {
    const c = this.control()?.ngControl;
    if (c?.invalid && (c.touched || c.dirty)) return 'error';
    if (this.warning() && (!c || c.dirty || c.touched || filled(c.value))) return 'warning';
    if (c && this.showSuccess() && c.valid && c.dirty && filled(c.value)) return 'success';
    return null;
  }

  message(): string | null {
    const state = this.state();
    if (state === 'error') return this.errorText(this.control()?.ngControl?.errors ?? null);
    if (state === 'warning') return this.warning();
    if (state === 'success') return this.successText() || null;
    return null;
  }

  hasMessage(): boolean { return !!this.message() || !!this.hint(); }

  private errorText(errors: ValidationErrors | null): string {
    if (!errors) return '';
    const [key, detail] = Object.entries(errors)[0];
    if (typeof detail === 'string') return detail;
    return this.messages()[key] ?? DEFAULT_MESSAGES[key]?.(detail) ?? 'Revisa este campo.';
  }
}

function filled(value: unknown): boolean { return value !== null && value !== undefined && value !== ''; }

/** Validators shared by DepoRet forms. */
export const DrValidators = {
  decimals(places = 2): ValidatorFn {
    return (c: AbstractControl) => {
      if (c.value === null || c.value === '' || c.value === undefined) return null;
      const [, fraction = ''] = String(c.value).split('.');
      return fraction.length > places ? { decimals: true } : null;
    };
  },
  digits(...lengths: number[]): ValidatorFn {
    return (c: AbstractControl) => {
      const v = String(c.value ?? '');
      if (!v) return null;
      return /^\d+$/.test(v) && lengths.includes(v.length) ? null : { digits: { expected: lengths.join(' o ') } };
    };
  },
  mobile(): ValidatorFn {
    return (c: AbstractControl) => (!c.value || /^09\d{8}$/.test(c.value) ? null : { mobile: true });
  },
  ecuadorianId(): ValidatorFn {
    return (c: AbstractControl) => (!c.value || cedulaLooksValid(String(c.value)) ? null : { ecuadorianId: true });
  },
  phone(): ValidatorFn {
    return (c: AbstractControl) => (!c.value || /^\+?\d{7,15}$/.test(c.value) ? null : { phone: true });
  },
};

/** Ecuadorian ID checksum (módulo 10). Used only as a non-blocking advisory. */
export function cedulaLooksValid(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (province < 1 || province > 24 || Number(value[2]) > 5) return false;
  const sum = [...value.slice(0, 9)].reduce((acc, digit, i) => {
    let n = Number(digit) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    return acc + n;
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}
