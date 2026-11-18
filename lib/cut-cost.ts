// وقت وكلفة القص من طول القص والسمك ونوع الماكنة
// السرعات افتراضية لماكنة بلازما 130 أمبير وليزر فايبر 3 كيلوواط وأوكسي أستيلين، والمهندس يعدّلها حسب مكائن المعمل

export type CutMachine = "plasma" | "laser" | "oxy";
export const CUT_MACHINE: Record<CutMachine, string> = { plasma: "بلازما", laser: "ليزر", oxy: "أوكسي (لهب)" };

export type CutRates = {
  machine: CutMachine;
  plasma_speed: string; // "السمك:السرعة ملم/دقيقة" مفصولة بفوارز
  laser_speed: string;
  oxy_speed: string;
  plasma_pierce_s: number; // ثواني الثقب لكل ملم سمك (زائد ثانية أساس)
  laser_pierce_s: number;
  oxy_pierce_s: number;
  plasma_hour: number; // كلفة ساعة تشغيل الماكنة: كهرباء وغاز ومستهلكات واستهلاك (دينار)
  laser_hour: number;
  oxy_hour: number;
  sheet_min: number; // تحميل وتنزيل كل لوح (دقيقة)
  max_t_plasma: number; // أقصى سمك تقصه
  max_t_laser: number;
  efficiency: number; // نسبة الوقت الفعلي (تسارع، زوايا، توقفات)
};

export const DEFAULT_CUT_RATES: CutRates = {
  machine: "plasma",
  plasma_speed: "3:4200, 6:3000, 8:2400, 10:1900, 12:1550, 16:1100, 20:800, 25:550, 32:350",
  laser_speed: "1:20000, 3:6000, 6:2800, 8:2000, 10:1400, 12:1000, 16:650, 20:450",
  oxy_speed: "6:700, 10:600, 20:500, 30:420, 50:330, 80:260, 100:220",
  plasma_pierce_s: 0.15,
  laser_pierce_s: 0.12,
  oxy_pierce_s: 1.2,
  plasma_hour: 60000,
  laser_hour: 90000,
  oxy_hour: 35000,
  sheet_min: 12,
  max_t_plasma: 32,
  max_t_laser: 20,
  efficiency: 80,
};

export const CUT_RATE_LABELS: Record<Exclude<keyof CutRates, "machine">, [string, string]> = {
  plasma_speed: ["سرعة البلازما حسب السمك", "سمك:ملم/دقيقة"],
  laser_speed: ["سرعة الليزر حسب السمك", "سمك:ملم/دقيقة"],
  oxy_speed: ["سرعة الأوكسي حسب السمك", "سمك:ملم/دقيقة"],
  plasma_pierce_s: ["وقت ثقب البلازما لكل ملم سمك", "ثانية"],
  laser_pierce_s: ["وقت ثقب الليزر لكل ملم سمك", "ثانية"],
  oxy_pierce_s: ["وقت ثقب الأوكسي لكل ملم سمك", "ثانية"],
  plasma_hour: ["كلفة ساعة البلازما", "دينار"],
  laser_hour: ["كلفة ساعة الليزر", "دينار"],
  oxy_hour: ["كلفة ساعة الأوكسي", "دينار"],
  sheet_min: ["تحميل وتنزيل كل لوح", "دقيقة"],
  max_t_plasma: ["أقصى سمك للبلازما", "ملم"],
  max_t_laser: ["أقصى سمك لليزر", "ملم"],
  efficiency: ["الكفاءة الفعلية للقص", "%"],
};

export function mergeCutRates(stored: unknown): CutRates {
  const o = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const r = { ...DEFAULT_CUT_RATES };
  for (const k of Object.keys(r) as (keyof CutRates)[]) {
    const v = o[k];
    if (v === undefined || v === null || v === "") continue;
    if (k === "machine") {
      if (v === "plasma" || v === "laser" || v === "oxy") r.machine = v;
    } else if (k.endsWith("_speed")) (r as Record<string, unknown>)[k] = String(v);
    else if (Number.isFinite(Number(v))) (r as Record<string, unknown>)[k] = Number(v);
  }
  return r;
}

// "3:4200, 6:3000" ← [[3,4200],[6,3000]] مرتبة بالسمك
export function parseSpeeds(s: string): [number, number][] {
  return s
    .split(/[,،\n]/)
    .map((x) => x.split(/[:=]/).map((y) => parseFloat(y)))
    .filter((x) => x.length === 2 && x[0] > 0 && x[1] > 0)
    .map((x) => [x[0], x[1]] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

// السرعة بالسمك المطلوب: استكمال خطي بين النقاط
export function speedAt(table: [number, number][], t: number) {
  if (!table.length) return 1000;
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [t0, v0] = table[i - 1], [t1, v1] = table[i];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  const [ta, va] = table[table.length - 1];
  return va * (ta / t); // أسمك من الجدول: تقل السرعة بنفس النسبة
}

// الماكنة المناسبة للسمك: الليزر للرقيق إذا اخترته، البلازما للمتوسط، والأوكسي للسميك
export function machineFor(r: CutRates, t: number): CutMachine {
  if (r.machine === "laser" && t <= r.max_t_laser) return "laser";
  if (r.machine !== "oxy" && t <= r.max_t_plasma) return "plasma";
  return "oxy";
}

export type CutTime = { machine: CutMachine; speed: number; cutMin: number; pierceMin: number; sheetMin: number; minutes: number; cost: number };

// وقت قص مجموعة قطع بنفس السمك
export function cutTime(r: CutRates, t: number, cutLenMm: number, pierces: number, sheets: number): CutTime {
  const m = machineFor(r, t);
  const speed = speedAt(parseSpeeds(r[`${m}_speed`]), t);
  const eff = Math.max(30, Math.min(100, r.efficiency)) / 100;
  const cutMin = cutLenMm / speed / eff;
  const pierceMin = (pierces * (1 + r[`${m}_pierce_s`] * t)) / 60;
  const sheetMin = sheets * r.sheet_min;
  const minutes = cutMin + pierceMin + sheetMin;
  return { machine: m, speed: Math.round(speed), cutMin, pierceMin, sheetMin, minutes, cost: (minutes / 60) * r[`${m}_hour`] };
}
