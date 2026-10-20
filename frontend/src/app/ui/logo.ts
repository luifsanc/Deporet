import { ChangeDetectionStrategy, Component, input } from '@angular/core';
/** Vector reconstruction of the supplied DepoRet reference, without photographic background. */
@Component({selector:'dr-logo',changeDetection:ChangeDetectionStrategy.OnPush,host:{class:'inline-flex items-center gap-2.5 select-none'},template:`
<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true" class="shrink-0">
 <path d="M20 5Q20 2 24 2H36C53 2 62 13 62 29C62 47 52 60 34 60H19L24 46H34C44 46 48 39 48 30C48 21 44 16 34 16H17Z" fill="#ec008c"/>
 <path d="M62 28C62 46 51 47 34 47H24L19 60H34C52 60 62 47 62 28Z" [attr.fill]="tone()==='light'?'#ffffff':'#080808'"/>
 <path d="M1 34L18 19L30 35H23L19 48Q16 57 23 60H14Q1 60 5 46L8 34Z" fill="#ec008c"/>
</svg>@if(variant()==='full'){<span class="text-[1.5rem] leading-none tracking-[-0.055em] font-extrabold whitespace-nowrap" [class]="tone()==='light'?'text-white':'text-ink-950'">Depo<span class="text-brand-600">Ret</span></span>}
`})
export class Logo{readonly variant=input<'full'|'mark'>('full');readonly tone=input<'light'|'dark'>('dark');readonly size=input(38);}
