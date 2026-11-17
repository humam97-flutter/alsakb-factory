// أوزان المقاطع الحديدية. الأبعاد بالملم، والطول بالمتر (للصاج: الطول والعرض بالملم)
export const DENSITY: Record<string, { label: string; value: number }> = {
  steel: { label: "حديد (7.85)", value: 7.85 },
  stainless: { label: "ستانلس (7.93)", value: 7.93 },
  aluminium: { label: "ألمنيوم (2.70)", value: 2.7 },
  copper: { label: "نحاس (8.96)", value: 8.96 },
};

type Field = { key: string; label: string };
export type Shape = { label: string; fields: Field[]; area: (v: Record<string, number>) => number; long: boolean };

// area = مساحة المقطع بالملم² (للمقاطع الطويلة)، أو الحجم بالملم³ للصاج
export const SHAPES: Record<string, Shape> = {
  plate: {
    label: "صاج / لوح",
    long: false,
    fields: [
      { key: "l", label: "الطول (ملم)" },
      { key: "w", label: "العرض (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => v.l * v.w * v.t,
  },
  round_tube: {
    label: "أنبوب دائري",
    long: true,
    fields: [
      { key: "d", label: "القطر الخارجي (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => Math.PI * (v.d - v.t) * v.t,
  },
  rect_tube: {
    label: "بروفيل مربع / مستطيل",
    long: true,
    fields: [
      { key: "a", label: "العرض (ملم)" },
      { key: "b", label: "الارتفاع (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => 2 * (v.a + v.b - 2 * v.t) * v.t,
  },
  round_bar: {
    label: "شيش / عمود دائري",
    long: true,
    fields: [{ key: "d", label: "القطر (ملم)" }],
    area: (v) => (Math.PI / 4) * v.d * v.d,
  },
  flat_bar: {
    label: "فلات / عمود مربع",
    long: true,
    fields: [
      { key: "a", label: "العرض (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => v.a * v.t,
  },
  angle: {
    label: "زاوية",
    long: true,
    fields: [
      { key: "a", label: "الضلع الأول (ملم)" },
      { key: "b", label: "الضلع الثاني (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => (v.a + v.b - v.t) * v.t,
  },
  channel: {
    label: "شيلمان (U)",
    long: true,
    fields: [
      { key: "h", label: "الارتفاع (ملم)" },
      { key: "b", label: "عرض الجناح (ملم)" },
      { key: "t", label: "السمك (ملم)" },
    ],
    area: (v) => (v.h + 2 * v.b - 2 * v.t) * v.t,
  },
};

// وزن القطعة الواحدة بالكغم
export function pieceWeight(shape: string, v: Record<string, number>, lengthM: number, density: number) {
  const s = SHAPES[shape];
  if (!s) return 0;
  const a = s.area(v);
  if (!(a > 0)) return 0;
  const volumeMm3 = s.long ? a * lengthM * 1000 : a;
  return (volumeMm3 * density) / 1_000_000; // g/cm³ × mm³ → كغم
}
