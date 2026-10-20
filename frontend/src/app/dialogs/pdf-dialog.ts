import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { PdfPreview } from '../core/dialogs';
import { Icon } from '../ui/icon';
import { Modal } from '../ui/modal';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

@Component({selector:'dr-pdf-dialog',imports:[Modal,Icon],changeDetection:ChangeDetectionStrategy.OnPush,template:`
 @let p=preview();
 <dr-modal [heading]="p.title" [subtitle]="p.subtitle" icon="file" size="xl" (closed)="closed.emit()">
   @if(loading()){<div class="flex items-center justify-center gap-3 p-5 text-sm text-ink-500" role="status"><span class="spinner"></span>Preparando vista previa…</div>}
   @if(error()){<div class="alert alert-warning" role="alert">No se pudo mostrar la vista previa. Puedes descargar el documento PDF.</div>}
   <div #pages class="max-h-[68dvh] overflow-auto rounded-2xl border border-ink-100 bg-ink-100 p-2 sm:p-5" aria-label="Páginas del documento PDF"></div>
   <div footer class="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-4 sm:px-7">
    <span class="text-xs text-ink-500">{{count()}} página(s) · PDF A4</span>
    <a class="btn btn-primary" [href]="p.url" [attr.download]="p.filename"><dr-icon name="download"/>Descargar PDF</a>
   </div>
 </dr-modal>
`})
export class PdfDialog{
 readonly preview=input.required<PdfPreview>();readonly closed=output<void>();
 protected readonly loading=signal(true);protected readonly error=signal(false);protected readonly count=signal(0);
 private readonly pages=viewChild.required<ElementRef<HTMLDivElement>>('pages');private readonly destroy=inject(DestroyRef);private task?:PDFDocumentLoadingTask;
 constructor(){afterNextRender(()=>void this.render());this.destroy.onDestroy(()=>{void this.task?.destroy();});}
 private async render(){try{
   const pdfjs=await import('pdfjs-dist');if(this.destroy.destroyed)return;
   pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
   const bytes=await (await fetch(this.preview().url)).arrayBuffer();if(this.destroy.destroyed)return;
   this.task=pdfjs.getDocument({data:bytes,disableFontFace:true});const pdf=await this.task.promise;
   if(this.destroy.destroyed)return;this.count.set(pdf.numPages);const host=this.pages().nativeElement;
   for(let i=1;i<=Math.min(pdf.numPages,20);i++){
     if(this.destroy.destroyed)return;const page=await pdf.getPage(i);const base=page.getViewport({scale:1});
     const width=Math.min(900,Math.max(240,host.clientWidth-40));const scale=width/base.width;const ratio=Math.min(devicePixelRatio||1,2);const viewport=page.getViewport({scale:scale*ratio});
     const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.cssText='display:block;width:100%;max-width:'+width+'px;height:auto;margin:0 auto 16px;background:white;box-shadow:0 2px 10px #101b3c18';canvas.setAttribute('aria-label','Página '+i+' de '+pdf.numPages);canvas.setAttribute('role','img');host.appendChild(canvas);
     await page.render({canvas,viewport}).promise;
   }
 }catch{if(!this.destroy.destroyed)this.error.set(true);}finally{if(!this.destroy.destroyed)this.loading.set(false);}}
}
