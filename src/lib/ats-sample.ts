import type { Lang } from "./i18n";

/** Canonical section order — the single source of truth for the whole app. */
export const SECTIONS_EN = [
  "Professional Summary",
  "Core Competencies",
  "Professional Experience",
  "Education",
  "Professional Certification",
  "Technical & Additional Skills",
] as const;

export const SECTIONS_AR = [
  "الملخص المهني",
  "الكفاءات الأساسية",
  "الخبرة المهنية",
  "التعليم",
  "الشهادات المهنية",
  "المهارات التقنية والإضافية",
] as const;

/** The contact header that sits above the six sections. */
export const HEADER_BLOCK: Record<Lang, { name: string; why: string }> = {
  en: {
    name: "Contact header",
    why: "Top of the page, above the sections: full name, professional headline, email, phone, city/country, LinkedIn. For Saudi roles you may add your work-authorization status (Saudi national, transferable Iqama, GCC national) — only if you choose to. Keep it as plain body text — not in a document header or footer.",
  },
  ar: {
    name: "ترويسة التواصل",
    why: "أعلى الصفحة قبل الأقسام: الاسم الكامل، المسمّى المهني، البريد الإلكتروني، الهاتف، المدينة/الدولة، لينكدإن. وللوظائف داخل السعودية يمكنك إضافة حالة الأهلية للعمل (سعودي، إقامة قابلة للنقل، مواطن خليجي) إن رغبت. اكتبها كنص عادي لا داخل رأس المستند أو تذييله.",
  },
};

export const SECTION_PURPOSE: Record<Lang, { name: string; why: string }[]> = {
  en: [
    {
      name: "Professional Summary",
      why: "One paragraph positioning you for this exact role. Also titled Executive Summary for senior or management roles.",
    },
    {
      name: "Core Competencies",
      why: "A short scannable list of your strongest role-relevant capabilities.",
    },
    {
      name: "Professional Experience",
      why: "Reverse-chronological roles with achievement bullets, weighted toward recent and relevant work.",
    },
    { name: "Education", why: "Degrees, institutions, graduation years." },
    {
      name: "Professional Certification",
      why: "Credentials with issuing body and year, most relevant first.",
    },
    {
      name: "Technical & Additional Skills",
      why: "Closing section: tools, platforms, methods, languages.",
    },
  ],
  ar: [
    {
      name: "الملخص المهني",
      why: "فقرة واحدة تُظهر ملاءمتك لهذه الوظيفة تحديداً. ويُسمّى أيضاً «الملخص التنفيذي» للمناصب القيادية.",
    },
    {
      name: "الكفاءات الأساسية",
      why: "قائمة قصيرة سهلة القراءة لأقوى قدراتك المرتبطة بالوظيفة.",
    },
    {
      name: "الخبرة المهنية",
      why: "الوظائف بترتيب زمني عكسي مع نقاط إنجاز، مع ترجيح الأحدث والأكثر صلة.",
    },
    { name: "التعليم", why: "الدرجات العلمية والجهات وسنوات التخرج." },
    {
      name: "الشهادات المهنية",
      why: "الشهادات مع الجهة المانحة والسنة، الأكثر صلة أولاً.",
    },
    {
      name: "المهارات التقنية والإضافية",
      why: "القسم الختامي: الأدوات والمنصات والمنهجيات واللغات.",
    },
  ],
};

export const ATS_DOS: Record<Lang, string[]> = {
  en: [
    "Single column, one standard font, black text only",
    "Real section headings spelled exactly as above",
    "Standard bullets (•/-) and plain dates like Mar 2021 – Jun 2024",
    "Save and send as .docx or a text-layer .pdf",
  ],
  ar: [
    "عمود واحد، خط قياسي واحد، ونص أسود فقط",
    "عناوين أقسام حقيقية بنفس المسميات أعلاه",
    "نقاط قياسية (•/-) وتواريخ بسيطة مثل مارس ٢٠٢١ – يونيو ٢٠٢٤",
    "الحفظ والإرسال بصيغة .docx أو .pdf بطبقة نصية",
  ],
};

export const ATS_DONTS: Record<Lang, string[]> = {
  en: [
    "No tables, text boxes, columns or sidebars",
    "No logos, icons, photos or charts",
    "Nothing in headers or footers — parsers drop it",
    "No abbreviations only: write “Structured Query Language (SQL)” once",
  ],
  ar: [
    "لا جداول ولا مربعات نص ولا أعمدة ولا أشرطة جانبية",
    "لا شعارات ولا أيقونات ولا صور ولا رسوم بيانية",
    "لا شيء في الرأس أو التذييل — أنظمة الفحص تتجاهلها",
    "لا تكتفِ بالاختصارات: اكتب المصطلح كاملاً مرة واحدة مع اختصاره",
  ],
};

export const ATS_SAMPLE: Record<Lang, string> = {
  en: `[YOUR FULL NAME]
[City, Country] · [Phone] · [Email] · [LinkedIn]

PROFESSIONAL SUMMARY
Senior data analyst with eight years turning operational data into decisions for retail and logistics teams. Builds governed dashboards, owns forecasting models, and partners with commercial leaders on pricing and inventory. Led a demand-planning rebuild that cut stockouts 23% across 140 stores. Fluent in SQL, Python and Power BI, and experienced running analytics for regional expansion programs.

CORE COMPETENCIES
- Demand forecasting and planning
- SQL data modeling
- Power BI dashboard delivery
- Pricing and margin analysis
- Stakeholder partnership
- Data governance and quality
- Python automation

PROFESSIONAL EXPERIENCE
NORVERSE RETAIL GROUP, RIYADH | Mar 2021 – Present
Senior Data Analyst | Mar 2021 – Present
- Rebuilt demand planning for 140 stores, reducing stockouts 23% and excess stock 11% within two quarters.
- Delivered 18 governed Power BI dashboards adopted by merchandising, supply chain and finance.
- Automated a weekly reporting cycle in Python, removing roughly 30 analyst hours per month.
- Led pricing analysis for two category resets, protecting gross margin during a 9% cost increase.

HALSTEAD LOGISTICS, DUBAI | Aug 2016 – Feb 2021
Data Analyst | Jul 2018 – Feb 2021
- Modelled route profitability across 60 lanes, informing a network redesign that lowered cost per drop 8%.
- Built the company's first SQL data mart, cutting standard report turnaround from three days to same day.
- Trained 24 operations staff on self-service reporting, raising dashboard adoption from 30% to 78%.

Junior Analyst | Aug 2016 – Jun 2018
- Produced daily fulfilment KPI packs for three depots and flagged the variance drivers behind them.
- Cleaned and consolidated legacy shipment data into a single validated source.


EDUCATION
BSc Statistics — King Saud University, Riyadh, 2016

PROFESSIONAL CERTIFICATION
Microsoft Certified: Power BI Data Analyst Associate — Microsoft, 2023
Certified Supply Chain Professional (CSCP) — ASCM, 2022

TECHNICAL & ADDITIONAL SKILLS
Tools: SQL, Python (pandas, scikit-learn), Power BI, Excel, Git, Azure Data Factory
Methods: forecasting, A/B testing, cohort analysis, dimensional modeling
Languages: English (fluent), Arabic (native)`,
  ar: `[الاسم الكامل]
[المدينة، الدولة] · [الهاتف] · [البريد الإلكتروني] · [لينكدإن]

الملخص المهني
محلل بيانات أول بخبرة ثماني سنوات في تحويل البيانات التشغيلية إلى قرارات لفرق التجزئة واللوجستيات. يبني لوحات معلومات محكومة، ويملك نماذج التوقع، ويعمل مع القيادات التجارية في التسعير والمخزون. قاد إعادة بناء تخطيط الطلب فخفّض نفاد المخزون بنسبة ٢٣٪ في ١٤٠ فرعاً. متمكّن من SQL وPython وPower BI.

الكفاءات الأساسية
- توقع الطلب والتخطيط
- نمذجة البيانات بـ SQL
- بناء لوحات Power BI
- تحليل التسعير والهوامش
- الشراكة مع أصحاب المصلحة
- حَوكمة البيانات وجودتها
- الأتمتة بـ Python

الخبرة المهنية
مجموعة نورفيرس للتجزئة، الرياض | مارس ٢٠٢١ – حتى الآن
محلل بيانات أول | مارس ٢٠٢١ – حتى الآن
- أعاد بناء تخطيط الطلب لـ ١٤٠ فرعاً، فخفّض نفاد المخزون ٢٣٪ والمخزون الزائد ١١٪ خلال ربعين.
- سلّم ١٨ لوحة Power BI محكومة تستخدمها إدارات التجارة وسلسلة التوريد والمالية.
- أتمت دورة التقارير الأسبوعية بـ Python، ووفّر نحو ٣٠ ساعة عمل شهرياً.
- قاد تحليل التسعير لإعادة تنظيم فئتين، وحافظ على الهامش الإجمالي مع ارتفاع كلفة بنسبة ٩٪.

هالستيد للخدمات اللوجستية، دبي | يوليو ٢٠١٨ – فبراير ٢٠٢١
محلل بيانات | يوليو ٢٠١٨ – فبراير ٢٠٢١
- نمذج ربحية ٦٠ مساراً، وأسهم في إعادة تصميم الشبكة وخفض كلفة التوصيل ٨٪.
- بنى أول مستودع بيانات SQL للشركة، فقلّص زمن التقارير من ثلاثة أيام إلى اليوم نفسه.
- درّب ٢٤ موظفاً على التقارير الذاتية، فرفع تبنّي اللوحات من ٣٠٪ إلى ٧٨٪.

التعليم
بكالوريوس الإحصاء — جامعة الملك سعود، الرياض، ٢٠١٦

الشهادات المهنية
Microsoft Certified: Power BI Data Analyst Associate — مايكروسوفت، ٢٠٢٣
Certified Supply Chain Professional (CSCP) — ASCM، ٢٠٢٢

المهارات التقنية والإضافية
الأدوات: SQL، Python (pandas، scikit-learn)، Power BI، Excel، Git، Azure Data Factory
المنهجيات: التوقع، اختبار A/B، تحليل المجموعات، النمذجة البُعدية
اللغات: الإنجليزية (بطلاقة)، العربية (اللغة الأم)`,
};
