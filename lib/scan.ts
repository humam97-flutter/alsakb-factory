// قراءة شهادات المواد (MTC) وفواتير الموردين: شكل البيانات المستخرجة

export type ScanItem = {
  description: string;
  grade: string | null;
  thickness_mm: number | null;
  length_mm: number | null;
  width_mm: number | null;
  qty: number | null;
  unit: string | null;
  heat_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
};
export type ScanResult = {
  doc_type: "mtc" | "invoice" | "other";
  supplier: string | null;
  doc_no: string | null;
  date: string | null;
  currency: "IQD" | "USD" | null;
  standard: string | null;
  items: ScanItem[];
  chemistry: string | null;
  mechanical: string | null;
  total: number | null;
  notes: string | null;
};

const s = { type: ["string", "null"] };
const nn = { type: ["number", "null"] };
const req = (o: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(o), properties: o });

export const SCAN_SCHEMA = req({
  doc_type: { type: "string", enum: ["mtc", "invoice", "other"] },
  supplier: s,
  doc_no: s,
  date: { ...s, description: "YYYY-MM-DD" },
  currency: { ...s, description: "IQD أو USD" },
  standard: s,
  items: {
    type: "array",
    items: req({ description: { type: "string" }, grade: s, thickness_mm: nn, length_mm: nn, width_mm: nn, qty: nn, unit: s, heat_no: s, weight_kg: nn, unit_price: nn }),
  },
  chemistry: s,
  mechanical: s,
  total: nn,
  notes: s,
});

export const SCAN_PROMPT = `هذا مستند من معمل حديد بالعراق: إما شهادة مواد من المصنع (Mill Test Certificate / MTC / Inspection Certificate EN 10204 3.1) أو فاتورة مورد (عربي أو إنكليزي أو صيني مترجم).
استخرج البيانات كما هي مكتوبة بالضبط، بدون تخمين:
- doc_type: mtc للشهادة، invoice للفاتورة، other لغيرها.
- supplier: اسم المصنع أو المورد. doc_no: رقم الشهادة أو رقم الفاتورة. date: التاريخ بصيغة YYYY-MM-DD.
- standard: المواصفة (مثل ASTM A516 Gr.70، EN 10025 S275JR).
- items: كل سطر لوح أو مادة. grade النوع، القياسات بالملم (حوّل من inch إذا لازم: 1 inch = 25.4)، qty العدد أو الكمية، unit الوحدة، heat_no رقم الصبة، weight_kg الوزن بالكغم (حوّل من الطن)، unit_price سعر الوحدة إذا فاتورة.
- chemistry: ملخص التحليل الكيمياوي بسطر واحد (C, Mn, Si, P, S ...). mechanical: ملخص الخواص الميكانيكية (Yield, Tensile, Elongation, Impact).
- total: المجموع النهائي للفاتورة. notes: أي ملاحظة مهمة بالعربي (مثلاً قيمة خارج المواصفة، أو جزء غير مقروء).
أي حقل مو موجود أو مو واضح اتركه null.`;
