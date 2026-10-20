import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RISK_BANDS, riskBand } from '../core/format';

const CX = 120, CY = 118, R = 96;
const point = (t: number) => {
  const a = Math.PI - t * Math.PI;
  return { x: +(CX + R * Math.cos(a)).toFixed(2), y: +(CY - R * Math.sin(a)).toFixed(2) };
};
const arc = (t1: number, t2: number) => {
  const a = point(t1), b = point(t2);
  return `M${a.x} ${a.y}A${R} ${R} 0 0 1 ${b.x} ${b.y}`;
};

/** Semicircular credit score gauge with Alto / Medio / Bajo risk bands. */
@Component({
  selector: 'dr-score-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg viewBox="0 0 240 150" class="w-full" role="img" [attr.aria-label]="'Score ' + score() + ' de ' + max() + ', riesgo ' + band().label">
      <path [attr.d]="track" fill="none" stroke="#eceef4" stroke-width="20" stroke-linecap="round" />
      @for (b of bands; track b.label) {
        <path [attr.d]="b.d" fill="none" [attr.stroke]="b.color" stroke-width="20" [attr.stroke-opacity]="b.label === band().label ? 1 : 0.28" />
      }
      <g [attr.transform]="'rotate(' + angle() + ' ' + cx + ' ' + cy + ')'" style="transition: transform .8s cubic-bezier(.22,1,.36,1)">
        <path [attr.d]="'M' + (cx - 4) + ' ' + cy + 'L' + cx + ' ' + (cy - 78) + 'L' + (cx + 4) + ' ' + cy + 'Z'" fill="#101b3c" />
      </g>
      <circle [attr.cx]="cx" [attr.cy]="cy" r="10" fill="#101b3c" />
      <circle [attr.cx]="cx" [attr.cy]="cy" r="4" fill="#fff" />
      <text x="14" y="145" font-size="10" fill="#98a0b3" font-weight="600">{{ min() }}</text>
      <text x="226" y="145" font-size="10" fill="#98a0b3" font-weight="600" text-anchor="end">{{ max() }}</text>
    </svg>
  `,
})
export class ScoreGauge {
  readonly score = input.required<number>();
  readonly min = input(1);
  readonly max = input(999);

  protected readonly cx = CX;
  protected readonly cy = CY;
  protected readonly track = arc(0, 1);
  protected readonly bands = RISK_BANDS.map(b => ({
    ...b,
    d: arc((Math.max(b.from, 1) - 1) / 998 + (b.from > 1 ? 0.006 : 0), (b.to - 1) / 998 - (b.to < 999 ? 0.006 : 0)),
  }));
  protected readonly band = computed(() => riskBand(this.score()));
  /** Needle rotation in degrees: −90 points at the minimum, +90 at the maximum. */
  protected readonly angle = computed(() => {
    const t = Math.min(1, Math.max(0, (this.score() - this.min()) / (this.max() - this.min())));
    return -90 + t * 180;
  });
}
