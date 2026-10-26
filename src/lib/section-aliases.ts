import { SECTIONS_AR, SECTIONS_EN } from "./ats-sample";

/** Same normalisation as the resume parsers, plus "&"/"and" folding. */
export function headingKey(s: string): string {
  return s
    .replace(/[#*_:•\-]/g, " ")
    .replace(/&|\band\b|\bو(?=\S)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Extra section headings that are not one of the six template headings. */
export const OTHER_SECTION = "__other_section__";

const ALIASES: Record<string, string[]> = {
  [SECTIONS_EN[0]]: ["Summary", "Profile", "Professional Profile", "Career Summary", "Objective", "Career Objective", "About Me", "Executive Summary", "نبذة", "نبذة عني", "الملخص", "الملخص التنفيذي", "الهدف الوظيفي"],
  [SECTIONS_EN[1]]: ["Key Competencies", "Competencies", "Core Skills", "Key Skills", "Areas of Expertise", "Expertise", "Key Strengths", "Strengths", "الكفاءات", "المهارات الأساسية", "مجالات الخبرة"],
  [SECTIONS_EN[2]]: ["Experience", "Work Experience", "Employment History", "Work History", "Career History", "Professional Background", "Relevant Experience", "الخبرة", "الخبرات", "الخبرات العملية", "الخبرة العملية", "الخبرات المهنية", "السجل الوظيفي"],
  [SECTIONS_EN[3]]: ["Education & Training", "Academic Background", "Academic Qualifications", "Qualifications", "Education and Qualifications", "المؤهلات", "المؤهلات العلمية", "المؤهل العلمي", "التعليم والتدريب"],
  [SECTIONS_EN[4]]: ["Certifications", "Certificates", "Professional Certifications", "Licenses & Certifications", "Certifications & Licenses", "Courses", "Training", "Training & Courses", "Courses & Certifications", "الشهادات", "الدورات", "الدورات التدريبية", "الشهادات والدورات"],
  [SECTIONS_EN[5]]: ["Skills", "Technical Skills", "Additional Skills", "Skills & Tools", "Tools", "Software", "Computer Skills", "Languages", "Language Skills", "Skills & Languages", "Languages & Skills", "Additional Information", "المهارات", "المهارات التقنية", "اللغات", "المهارات واللغات", "مهارات الحاسب"],
  [OTHER_SECTION]: ["Projects", "Academic Projects", "Academic Projects & Teamwork", "Key Projects", "Projects & Teamwork", "Volunteering", "Volunteer Experience", "Volunteer Work", "Leadership & Activities", "Activities", "Extracurricular Activities", "Awards", "Honors & Awards", "Achievements", "Publications", "Memberships", "Affiliations", "Interests", "References", "المشاريع", "المشاريع الأكاديمية", "المشاريع الأكاديمية والعمل الجماعي", "العمل التطوعي", "التطوع", "الأنشطة", "الجوائز", "الإنجازات", "المنشورات", "العضويات", "الاهتمامات", "المعرفون"],
};

const MAP = new Map<string, string>();
SECTIONS_EN.forEach((en, i) => {
  MAP.set(headingKey(en), en);
  MAP.set(headingKey(SECTIONS_AR[i] ?? ""), en);
});
for (const [canon, list] of Object.entries(ALIASES)) for (const a of list) if (!MAP.has(headingKey(a))) MAP.set(headingKey(a), canon);

/**
 * The template section a heading line stands for (English canonical name),
 * OTHER_SECTION for a recognised off-template heading, or null for a non-heading.
 */
export function canonicalSection(line: string): string | null {
  const k = headingKey(line);
  if (!k || k.length > 60) return null;
  return MAP.get(k) ?? null;
}
