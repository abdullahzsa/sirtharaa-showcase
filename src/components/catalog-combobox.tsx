import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { CatalogItem } from "@/lib/builder-catalog";

const norm = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F]/g, "");

/**
 * Type-to-search picker. Picking a preset stores its English name; anything
 * typed is kept as-is, so names missing from the list are never blocked.
 */
export function CatalogCombobox({
  value,
  onChange,
  onPick,
  items,
  placeholder,
  lang,
  customLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (item: CatalogItem) => void;
  items: CatalogItem[];
  placeholder: string;
  lang: "en" | "ar";
  customLabel: (typed: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number | undefined>(undefined);

  const matches = useMemo(() => {
    const q = norm(value.trim());
    const list = q
      ? items.filter((i) => norm(i.en).includes(q) || (i.ar && norm(i.ar).includes(q)))
      : items;
    return list.slice(0, 8);
  }, [items, value]);

  const exact = matches.some((m) => m.en.toLowerCase() === value.trim().toLowerCase());
  const showCustom = value.trim().length > 0 && !exact;
  const total = matches.length + (showCustom ? 1 : 0);

  const pick = (item: CatalogItem) => {
    onChange(item.en);
    onPick?.(item);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
          onChange(ev.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => {
          if (!open || total === 0) return;
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setActive((a) => (a + 1) % total);
          } else if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setActive((a) => (a - 1 + total) % total);
          } else if (ev.key === "Enter") {
            ev.preventDefault();
            if (active < matches.length) pick(matches[active]!);
            else setOpen(false);
          } else if (ev.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && total > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {matches.map((m, i) => (
            <li
              key={m.en}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => ev.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(m)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === active ? "bg-primary/15 text-primary" : ""}`}
            >
              <div>{lang === "ar" && m.ar ? m.ar : m.en}</div>
              {(lang === "ar" && m.ar) || m.issuer ? (
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {lang === "ar" && m.ar ? m.en : m.issuer}
                </div>
              ) : null}
            </li>
          ))}
          {showCustom && (
            <li
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(ev) => ev.preventDefault()}
              onMouseEnter={() => setActive(matches.length)}
              onClick={() => setOpen(false)}
              className={`cursor-pointer rounded-lg border-t border-border/60 px-3 py-2 text-sm italic ${active === matches.length ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
            >
              {customLabel(value.trim())}
            </li>
          )}
          <li aria-hidden className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground/80">
            {lang === "ar" ? "اكتب للعثور على المزيد" : "Type to find more"}
          </li>
        </ul>
      )}
    </div>
  );
}
