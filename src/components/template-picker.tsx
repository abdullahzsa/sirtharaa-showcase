import { promptUpgrade } from "@/lib/upgrade-prompt";
import {
  FREE_TEMPLATE,
  TEMPLATE_IDS,
  TEMPLATE_STYLES,
  type TemplateId,
} from "@/lib/templates";
import type { SiteCopy } from "@/lib/site-copy";

const PREVIEW_LINES: Record<TemplateId, string[]> = {
  classic: [
    "AHMED AL-RASHID",
    "Riyadh, Saudi Arabia · +966 50 000 0000",
    "PROFESSIONAL SUMMARY",
    "Project manager with 8 years on Saudi mega-projects.",
    "PROFESSIONAL EXPERIENCE",
    "SAUDI ARAMCO",
    "Senior Project Manager · Jan 2020 – Present",
    "· Lead a SAR 400M infrastructure workstream.",
  ],
  compact: [
    "AHMED AL-RASHID",
    "Riyadh, SA · +966 50 000 0000",
    "SUMMARY",
    "Project manager, 8 years on Saudi mega-projects.",
    "EXPERIENCE",
    "SAUDI ARAMCO | Senior Project Manager | 2020–Present",
    "· Lead SAR 400M infrastructure workstream.",
  ],
  executive: [
    "AHMED AL-RASHID",
    "Riyadh, Kingdom of Saudi Arabia",
    "+966 50 000 0000 · ahmed@example.com",
    "PROFESSIONAL SUMMARY",
    "Seasoned project manager with a track record on",
    "Saudi Arabia's largest energy and infrastructure",
    "programs, combining stakeholder alignment, risk",
    "governance and delivery at scale.",
  ],
};

export function TemplatePicker({
  value,
  onChange,
  pro,
  site,
}: {
  value: TemplateId;
  onChange: (t: TemplateId) => void;
  pro: boolean;
  site: SiteCopy;
}) {
  const labels = site.templatePicker.names;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{site.templatePicker.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {site.templatePicker.body}
          </p>
        </div>
        {!pro && (
          <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground">
            {site.templatePicker.proBadge}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TEMPLATE_IDS.map((id) => {
          const locked = id !== FREE_TEMPLATE && !pro;
          const active = value === id;
          const st = TEMPLATE_STYLES[id].pdf;
          const scale = id === "executive" ? 0.65 : id === "compact" ? 0.78 : 0.72;
          return (
            <button
              key={id}
              type="button"
              aria-disabled={locked}
              onClick={() => (locked ? promptUpgrade((site.build.dir as string) === "rtl" ? "ar" : "en", site.templatePicker.names[id]) : onChange(id))}
              className={`relative overflow-hidden rounded-xl border p-3 text-start transition-all ${
                active
                  ? "border-accent bg-accent/10 ring-1 ring-accent"
                  : "border-border bg-card hover:border-accent/50"
              } ${locked ? "opacity-60" : ""}`}
            >
              {locked && (
                <span className="absolute end-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[0.55rem] font-semibold text-primary-foreground">
                  {site.templatePicker.proBadge}
                </span>
              )}
              {/* The miniature renders the English export, so it keeps its own
                  left-to-right flow whatever the interface language is. */}
              <div dir="ltr" className="mb-2 overflow-hidden text-left">
                <div
                  className="pointer-events-none select-none space-y-0.5 rounded border border-border/60 bg-white p-2 text-[0.5rem] leading-tight text-neutral-900"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    width: `${100 / scale}%`,
                  }}
                >
                  {PREVIEW_LINES[id].map((line, i) => {
                    const isName = i === 0;
                    const isHeading =
                      line === line.toUpperCase() && line.length > 3;
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: isName
                            ? st.nameSize
                            : isHeading
                              ? st.headingSize
                              : st.bodySize,
                          fontWeight: isName || isHeading ? 700 : 400,
                          lineHeight: String(st.lead),
                          color: isHeading ? "#1f4e79" : "#111827",
                          marginBottom: isHeading ? 2 : 0,
                        }}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs font-semibold">{labels[id]}</p>
              <p className="text-[0.6rem] text-muted-foreground">
                {id === FREE_TEMPLATE
                  ? site.templatePicker.free
                  : site.templatePicker.proDensity.replace(
                      "{size}",
                      String(st.bodySize),
                    )}
              </p>
            </button>
          );
        })}
      </div>

      {!pro && (
        <p className="text-[0.65rem] text-muted-foreground">
          {site.templatePicker.proHint}
        </p>
      )}
    </div>
  );
}
