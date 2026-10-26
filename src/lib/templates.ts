/**
 * Three export layouts. All of them emit the same single-column, plain-text
 * structure underneath, so an ATS parser reads every line identically — the
 * differences are purely typographic density.
 */

export type TemplateId = "classic" | "compact" | "executive";

export const TEMPLATE_IDS: TemplateId[] = ["classic", "compact", "executive"];

/** Compact and Executive are part of the paid tier. */
export const FREE_TEMPLATE: TemplateId = "classic";

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as string[]).includes(v);
}

export function asTemplateId(v: unknown): TemplateId {
  return isTemplateId(v) ? v : FREE_TEMPLATE;
}

/** Word measurements are in half-points (size) and twips (spacing). */
export type DocxStyle = {
  nameSize: number;
  contactSize: number;
  headingSize: number;
  bodySize: number;
  headingBefore: number;
  headingAfter: number;
  employerBefore: number;
  roleBefore: number;
  bulletAfter: number;
  lineAfter: number;
};

/** PDF measurements are in points. */
export type PdfStyle = {
  nameSize: number;
  contactSize: number;
  headingSize: number;
  bodySize: number;
  lead: number;
  headingBefore: number;
  headingAfter: number;
  employerBefore: number;
  roleBefore: number;
  bulletAfter: number;
};

export type TemplateStyle = { docx: DocxStyle; pdf: PdfStyle };

export const TEMPLATE_STYLES: Record<TemplateId, TemplateStyle> = {
  classic: {
    docx: {
      nameSize: 32,
      contactSize: 18,
      headingSize: 22,
      bodySize: 20,
      headingBefore: 200,
      headingAfter: 80,
      employerBefore: 100,
      roleBefore: 120,
      bulletAfter: 60,
      lineAfter: 40,
    },
    pdf: {
      nameSize: 16,
      contactSize: 9,
      headingSize: 11,
      bodySize: 10,
      lead: 1.28,
      headingBefore: 8,
      headingAfter: 2,
      employerBefore: 5,
      roleBefore: 3,
      bulletAfter: 2,
    },
  },
  compact: {
    docx: {
      nameSize: 28,
      contactSize: 16,
      headingSize: 20,
      bodySize: 18,
      headingBefore: 120,
      headingAfter: 50,
      employerBefore: 60,
      roleBefore: 70,
      bulletAfter: 20,
      lineAfter: 20,
    },
    pdf: {
      nameSize: 14,
      contactSize: 8.5,
      headingSize: 10,
      bodySize: 9,
      lead: 1.18,
      headingBefore: 5,
      headingAfter: 1,
      employerBefore: 3,
      roleBefore: 2,
      bulletAfter: 0.5,
    },
  },
  executive: {
    docx: {
      nameSize: 40,
      contactSize: 18,
      headingSize: 24,
      bodySize: 20,
      headingBefore: 280,
      headingAfter: 120,
      employerBefore: 140,
      roleBefore: 160,
      bulletAfter: 80,
      lineAfter: 60,
    },
    pdf: {
      nameSize: 20,
      contactSize: 9.5,
      headingSize: 12,
      bodySize: 10,
      lead: 1.38,
      headingBefore: 12,
      headingAfter: 4,
      employerBefore: 7,
      roleBefore: 5,
      bulletAfter: 3,
    },
  },
};
