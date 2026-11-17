// خطة الفحص والاختبار ITP: قوالب افتراضية حسب نوع المنتج، تتعدل لكل أمر
// القيم افتراضية من الممارسة الشائعة، والمهندس يراجعها (ملف أسئلة المهندس)

export const POINT: Record<string, { label: string; hint: string }> = {
  H: { label: "H", hint: "نقطة توقف: ما يكمل الشغل إلا بعد حضور وتوقيع" },
  W: { label: "W", hint: "شهادة: يُبلَّغ بالموعد ويحضر إذا يريد" },
  R: { label: "R", hint: "مراجعة الوثائق" },
  M: { label: "M", hint: "مراقبة أثناء الشغل" },
};

export const ITP_STATUS: Record<string, { label: string; tone: "mut" | "ok" | "info" }> = {
  pending: { label: "ينتظر", tone: "mut" },
  done: { label: "منجز", tone: "ok" },
  na: { label: "لا ينطبق", tone: "info" },
};

export type ItpRow = { activity: string; reference: string; acceptance: string; record: string; factory: string | null; client: string | null; tpi: string | null };

const r = (activity: string, reference: string, acceptance: string, record: string, factory: string | null, client: string | null, tpi: string | null): ItpRow => ({ activity, reference, acceptance, record, factory, client, tpi });

export const ITP_TEMPLATES: Record<string, { label: string; rows: ItpRow[] }> = {
  vessel: {
    label: "وعاء ضغط (ASME VIII Div.1)",
    rows: [
      r("مراجعة الرسومات والحسابات", "ASME VIII Div.1 + مواصفة الزبون", "حسابات وسماكات مطابقة", "رسومات وحسابات معتمدة", "H", "R", "R"),
      r("استلام المواد ومطابقة شهادات المصنع MTC", "ASME II / ASTM", "الدرجة والسمك ورقم الصبة مطابقة للشهادة", "MTC", "H", "R", "R"),
      r("نقل رقم الصبة للقطع قبل القص", "إجراء التتبع", "كل قطعة معلّمة برقم الصبة", "سجل تتبع المواد", "W", "M", null),
      r("القص والدرفلة وتشكيل الرؤوس", "الرسم", "الاستدارة ±1% والأبعاد ضمن التفاوت", "تقرير أبعاد", "W", "M", null),
      r("مراجعة WPS/PQR ومؤهلات اللحامين", "ASME IX", "إجراءات ومؤهلات سارية", "WPS / PQR / WPQ", "R", "R", "R"),
      r("فحص التجميع قبل اللحام Fit-up", "WPS + الرسم", "فتحة الجذر والزاوية ومحاذاة الحواف", "تقرير Fit-up", "H", "W", "W"),
      r("الفحص البصري للحامات VT", "ASME VIII UW-35", "بدون شقوق أو نقص تعبئة أو تقويض زائد", "تقرير VT", "W", "M", null),
      r("الفحص بالأشعة RT", "ASME VIII UW-51 / UW-52", "حسب نسبة الفحص المحددة بالتصميم", "تقارير وأفلام RT", "H", "R", "R"),
      r("فحص الأبعاد النهائي والفوهات", "الرسم", "الاتجاهات والارتفاعات ضمن التفاوت", "تقرير أبعاد نهائي", "H", "W", "W"),
      r("الاختبار المائي", "ASME VIII UG-99", "بدون تسريب أو تشوّه طول مدة الثبات", "شهادة الاختبار المائي", "H", "H", "H"),
      r("التنظيف والصبغ", "مواصفة الصبغ", "تحضير السطح وسمك الطبقة الجافة DFT", "تقرير الصبغ", "W", "W", null),
      r("لوحة الاسم والوثائق النهائية", "ASME VIII UG-116", "البيانات مطابقة والملف كامل", "Data Book", "H", "R", "R"),
    ],
  },
  tank: {
    label: "خزان عمودي (API 650)",
    rows: [
      r("مراجعة الرسومات والحسابات", "API 650 + مواصفة الزبون", "سماكات الأطواق والأرضية والسقف مطابقة", "رسومات وحسابات معتمدة", "H", "R", "R"),
      r("استلام المواد ومطابقة شهادات المصنع MTC", "API 650 فصل 4", "الدرجة والسمك ورقم الصبة مطابقة", "MTC", "H", "R", "R"),
      r("فحص الأساس قبل التركيب", "API 650 فصل 7", "استواء الأساس ضمن التفاوت", "تقرير الأساس", "W", "W", null),
      r("مراجعة WPS/PQR ومؤهلات اللحامين", "ASME IX", "إجراءات ومؤهلات سارية", "WPS / PQR / WPQ", "R", "R", "R"),
      r("فحص لحامات الأرضية بالتفريغ Vacuum box", "API 650 بند 8.6", "بدون فقاعات", "تقرير Vacuum box", "H", "W", "W"),
      r("فحص التجميع والاستقامة لكل طوق", "API 650 بند 7.5", "الشاقولية والاستدارة والتدريج ضمن التفاوت", "تقرير أبعاد", "W", "M", null),
      r("الفحص البصري للحامات VT", "API 650 بند 8.5", "بدون شقوق أو تقويض زائد", "تقرير VT", "W", "M", null),
      r("الفحص بالأشعة RT للحامات الأطواق", "API 650 بند 8.1", "حسب عدد الصور المطلوب", "تقارير وأفلام RT", "H", "R", "R"),
      r("فحص لحام الأرضية مع الجسم", "API 650 بند 7.2.4", "فحص PT/MT أو زيت قبل وبعد", "تقرير PT", "H", "W", null),
      r("الاختبار المائي (التعبئة)", "API 650 بند 7.3.6", "بدون تسريب، وقياس هبوط الأساس", "شهادة الاختبار المائي", "H", "H", "H"),
      r("التنظيف والصبغ", "مواصفة الصبغ", "تحضير السطح وسمك الطبقة الجافة DFT", "تقرير الصبغ", "W", "W", null),
      r("لوحة الاسم والوثائق النهائية", "API 650 بند 10", "البيانات مطابقة والملف كامل", "Data Book", "H", "R", "R"),
    ],
  },
  structure: {
    label: "هياكل وأعمال عامة",
    rows: [
      r("مراجعة الرسومات", "الرسم + AWS D1.1", "الأبعاد والمواد واضحة", "رسومات معتمدة", "R", "R", null),
      r("استلام المواد", "شهادات المصنع", "الدرجة والمقاسات مطابقة", "MTC", "W", "R", null),
      r("فحص التجميع قبل اللحام", "الرسم", "الأبعاد والزوايا ضمن التفاوت", "تقرير Fit-up", "W", "M", null),
      r("الفحص البصري للحامات VT", "AWS D1.1 جدول 8.1", "بدون شقوق، مقاس اللحام صحيح", "تقرير VT", "H", "W", null),
      r("فحص الأبعاد النهائي", "الرسم", "ضمن التفاوت", "تقرير أبعاد", "H", "W", null),
      r("التنظيف والصبغ", "مواصفة الصبغ", "سمك الطبقة الجافة DFT", "تقرير الصبغ", "W", "W", null),
    ],
  },
};

// بيانات لوحة الاسم
export const NAMEPLATE_FIELDS: [string, string][] = [
  ["code", "كود التصميم"],
  ["serial", "الرقم التسلسلي"],
  ["tag", "رقم المعدة (Tag)"],
  ["year", "سنة الصنع"],
  ["service", "المادة المخزونة"],
  ["material", "مادة الجسم"],
  ["design_bar", "ضغط التصميم (bar)"],
  ["mawp_bar", "أقصى ضغط تشغيل MAWP (bar)"],
  ["test_bar", "ضغط الاختبار (bar)"],
  ["temp", "حرارة التصميم (°م)"],
  ["mdmt", "أقل حرارة تصميم MDMT (°م)"],
  ["ca", "سماحية التآكل (ملم)"],
  ["rt", "نسبة الفحص بالأشعة"],
  ["pwht", "المعالجة الحرارية PWHT"],
  ["capacity", "السعة (لتر)"],
  ["empty_kg", "الوزن فارغ (كغم)"],
];

const JOINT_RT: Record<string, string> = { full: "RT-1 (كامل)", spot: "RT-3 (نقطي)", none: "بدون أشعة" };
const fmt = (n: number) => String(Math.round(n * 10) / 10);

// قيم افتراضية للوحة الاسم من الحساب الهندسي المرتبط بالأمر
export function nameplateDefaults(o: { no: number; created_at?: string }, calc: { kind: string; inputs: Record<string, string>; results: Record<string, unknown> } | null): Record<string, string> {
  const d: Record<string, string> = { serial: `SN-${o.no}`, year: String(new Date(o.created_at ?? Date.now()).getFullYear()), temp: "65", mdmt: "-29", pwht: "لا" };
  if (calc?.kind === "vessel") {
    const i = calc.inputs, res = calc.results as Record<string, number>;
    Object.assign(d, {
      code: "ASME VIII Div.1",
      material: i.mat || "SA-516-70",
      design_bar: i.p || "10",
      mawp_bar: res.mawp ? fmt(res.mawp * 10) : "",
      test_bar: res.hydro ? fmt(res.hydro * 10) : "",
      ca: i.ca || "3",
      rt: JOINT_RT[i.joint || "spot"] ?? "",
      capacity: res.liters ? String(Math.round(res.liters)) : "",
      empty_kg: res.emptyKg ? String(Math.round(res.emptyKg)) : "",
    });
  } else if (calc?.kind === "tank") {
    const i = calc.inputs, res = calc.results as Record<string, number>;
    Object.assign(d, {
      code: "API 650",
      material: i.mat || "A36",
      design_bar: "جوي",
      test_bar: "تعبئة ماء كاملة",
      ca: i.ca || "1.5",
      capacity: res.nominal ? String(Math.round(res.nominal)) : "",
      empty_kg: res.totalKg ? String(Math.round(res.totalKg)) : "",
    });
  }
  return d;
}
