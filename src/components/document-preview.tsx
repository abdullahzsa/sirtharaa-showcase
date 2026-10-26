import { useEffect, useRef, useState } from "react";
import { installPdfPolyfills, resumePdfBytes } from "@/lib/doc-io";
import type { TemplateId } from "@/lib/templates";

/** A badge drawn over the rendered page beside the first line of `text`; never part of the export. */
export type PreviewMark = { text: string; label: string; tone: "added" | "enhanced" | "approved" };
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const TONE: Record<PreviewMark["tone"], string> = {
  added: "border-gold-deep/50 bg-gold-deep/15 text-gold-deep",
  enhanced: "border-paper-teal/50 bg-paper-teal/15 text-paper-teal",
  approved: "border-paper-teal/60 bg-paper-teal/20 text-paper-teal",
};
const LINE: Record<PreviewMark["tone"], string> = { added: "border-gold-deep", enhanced: "border-paper-teal", approved: "border-paper-teal" };
const DOT: Record<PreviewMark["tone"], string> = { added: "bg-gold-deep", enhanced: "bg-paper-teal", approved: "bg-paper-teal" };

/** Rasterize the export itself: device width can never change its typography. */
export function DocumentPreview({ text, template, lang, watermark = false, marks = [] }: { text: string; template: TemplateId; lang: "en" | "ar"; watermark?: boolean; marks?: PreviewMark[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const marksKey = JSON.stringify(marks);
  useEffect(() => {
    setFailed(false);
    let cancelled = false;
    let dispose: (() => Promise<void>) | undefined;
    const pendingMarks = (JSON.parse(marksKey) as PreviewMark[]).map((m) => ({ ...m, n: norm(m.text) })).filter((m) => m.n.length > 6);
    const timer = window.setTimeout(() => {
      void (async () => {
        installPdfPolyfills();
        const [bytes, pdfjs, worker] = await Promise.all([
          resumePdfBytes(text, "preview", template),
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdfjs.getDocument({ data: bytes });
        dispose = () => task.destroy();
        const doc = await task.promise;
        const pages = document.createDocumentFragment();
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Preview unavailable");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block w-full bg-paper shadow-2xl";
          canvas.setAttribute("aria-label", lang === "ar" ? `صفحة ${n} من ${doc.numPages}` : `Resume page ${n} of ${doc.numPages}`);
          await page.render({ canvasContext: context, canvas, viewport }).promise;
          const sheet = document.createElement("div");
          sheet.className = "relative mx-auto w-full max-w-[794px] [container-type:inline-size]";
          sheet.dataset["documentPage"] = String(n);
          sheet.append(canvas);
          if (pendingMarks.length) {
            const base = page.getViewport({ scale: 1 });
            const content = await page.getTextContent();
            for (const item of content.items as { str?: string; transform?: number[]; height?: number; width?: number }[]) {
              const s = norm(item.str ?? "");
              if (s.length < 8 || !item.transform) continue;
              const i = pendingMarks.findIndex((m) => m.n.includes(s) || s.includes(m.n));
              if (i < 0) continue;
              const m = pendingMarks.splice(i, 1)[0]!;
              const h = item.height ?? 10;
              const mid = Math.max(0, ((base.height - item.transform[5]! - h * 0.35) / base.height) * 100);
              const end = ((item.transform[4]! + (item.width ?? 0)) / base.width) * 100;
              const wrap = document.createElement("span");
              wrap.setAttribute("aria-hidden", "true");
              wrap.className = "pointer-events-none absolute right-[1%] z-10 -translate-y-1/2 rounded-full bg-paper";
              wrap.style.top = `${mid}%`;
              const badge = document.createElement("span");
              badge.className = `block rounded-full border px-[0.55em] py-[0.05em] text-[clamp(4px,0.85cqw,7px)] font-bold leading-[1.4] tracking-wider shadow-sm ${TONE[m.tone]}`;
              badge.textContent = m.label;
              wrap.append(badge);
              if (end < 88) {
                const line = document.createElement("span");
                line.setAttribute("aria-hidden", "true");
                line.className = `pointer-events-none absolute right-[2%] border-t-[max(0.5px,0.13cqw)] border-dotted opacity-45 ${LINE[m.tone]}`;
                line.style.left = `${end + 0.6}%`;
                line.style.top = `${mid}%`;
                const dot = document.createElement("span");
                dot.className = `absolute -left-[0.2cqw] -top-[0.25cqw] size-[0.4cqw] rounded-full ${DOT[m.tone]}`;
                line.append(dot);
                sheet.append(line);
              }
              sheet.append(wrap);
            }
          }
          if (watermark) {
            const mark = document.createElement("div");
            mark.setAttribute("aria-hidden", "true");
            mark.className = "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden";
            const label = document.createElement("span");
            label.className = "-rotate-[30deg] whitespace-nowrap font-display text-[clamp(1.5rem,6vw,3.5rem)] font-bold tracking-[0.2em] text-paper-muted opacity-25";
            label.textContent = lang === "ar" ? "سير ثراء • معاينة مجانية" : "sir tharaa • Free Preview";
            mark.append(label);
            sheet.append(mark);
          }
          pages.append(sheet);
        }
        if (!cancelled && host.current) { host.current.replaceChildren(pages); setFailed(false); }
      })().catch(() => { if (!cancelled) setFailed(true); }).finally(() => { void dispose?.().catch(() => {}); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); void dispose?.().catch(() => {}); };
  }, [text, template, lang, watermark, marksKey]);
  return <>
    <div ref={host} className="mx-auto min-h-24 w-full max-w-[794px] space-y-6 empty:aspect-[1/1.414] empty:bg-paper" role="img" aria-label={lang === "ar" ? "معاينة مستند السيرة الذاتية" : "Resume document preview"} />
    {failed && <p className="py-6 text-center text-sm text-destructive">{lang === "ar" ? "تعذر عرض المعاينة. جرّب مرة أخرى." : "Preview could not load. Please try again."}</p>}
  </>;
}
