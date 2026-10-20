import { inject, Injectable, signal } from '@angular/core';
import { Api, errorText } from './api';
import { saveBlob } from './format';
import { Payment } from './models';
import { Toasts } from '../ui/toast';

export interface PdfPreview { title: string; subtitle: string; url: string; filename: string }

/** App-wide document previews and receipts hosted by the shell. */
@Injectable({ providedIn: 'root' })
export class Dialogs {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly receipt = signal<Payment | null>(null);
  readonly pdf = signal<PdfPreview | null>(null);
  /** Path of the PDF currently being generated, to show inline loaders. */
  readonly pdfBusy = signal('');

  async previewPdf(path: string, filename: string, title: string, subtitle = '') {
    const blob = await this.fetchPdf(path);
    if (!blob) return;
    this.closePdf();
    this.pdf.set({ title, subtitle, filename, url: URL.createObjectURL(blob) });
  }

  async downloadPdf(path: string, filename: string) {
    const blob = await this.fetchPdf(path);
    if (blob) { saveBlob(blob, filename); this.toasts.success('PDF descargado', filename); }
  }

  closePdf() {
    const current = this.pdf();
    if (current) URL.revokeObjectURL(current.url);
    this.pdf.set(null);
  }

  private async fetchPdf(path: string): Promise<Blob | null> {
    this.pdfBusy.set(path);
    try {
      const blob = await this.api.blob(path);
      return new Blob([blob], { type: 'application/pdf' });
    } catch (e) {
      this.toasts.error('No se pudo generar el PDF', errorText(e));
      return null;
    } finally {
      this.pdfBusy.set('');
    }
  }
}
