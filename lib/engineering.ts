// حسابات هندسية تقديرية لأوعية الضغط والخزانات. الوحدات: ملم، ميغاباسكال (MPa)، كغم، لتر.
// للتسعير والتقدير السريع؛ التصميم النهائي يحتاج مراجعة وتوقيع مهندس معتمد.

export const BAR = 0.1; // 1 bar = 0.1 MPa

// الإجهاد المسموح S (MPa) بحرارة لحد 40°م تقريباً، ASME II-D. يتعدل من النموذج.
export const ASME_MATERIALS: Record<string, { label: string; S: number; density: number; grade: string }> = {
  "SA-516-70": { label: "SA-516 Gr70", S: 138, density: 7.85, grade: "A516 Gr70" },
  "SA-516-60": { label: "SA-516 Gr60", S: 118, density: 7.85, grade: "A516 Gr60" },
  "SA-285-C": { label: "SA-285 Gr C", S: 108, density: 7.85, grade: "A285 C" },
  "SA-36": { label: "SA-36", S: 114, density: 7.85, grade: "A36" },
  "SA-240-304": { label: "SA-240 304", S: 138, density: 7.93, grade: "SS304" },
  "SA-240-316": { label: "SA-240 316", S: 138, density: 7.98, grade: "SS316" },
};

// API 650 جدول 5-2a: إجهاد التصميم Sd وإجهاد الاختبار المائي St (MPa)
export const API650_MATERIALS: Record<string, { label: string; Sd: number; St: number; grade: string }> = {
  A36: { label: "A36", Sd: 160, St: 171, grade: "A36" },
  "A283-C": { label: "A283 Gr C", Sd: 137, St: 154, grade: "A283 C" },
  "A285-C": { label: "A285 Gr C", Sd: 137, St: 154, grade: "A285 C" },
  "A516-60": { label: "A516 Gr60 (415)", Sd: 147, St: 165, grade: "A516 Gr60" },
  "A516-70": { label: "A516 Gr70 (485)", Sd: 173, St: 195, grade: "A516 Gr70" },
};

// كفاءة اللحام حسب الفحص بالأشعة (لحام تناكبي من الجهتين، Type 1)
export const JOINT_E: Record<string, { label: string; E: number }> = {
  full: { label: "أشعة كاملة (Full RT) · 1.00", E: 1 },
  spot: { label: "أشعة نقطية (Spot RT) · 0.85", E: 0.85 },
  none: { label: "بدون أشعة · 0.70", E: 0.7 },
};

export const PLATE_T = [3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 45, 50, 55, 60];
export const nextPlate = (t: number) => PLATE_T.find((x) => x >= t - 1e-9) ?? Math.ceil(t);

export type HeadType = "ellipsoidal" | "torispherical" | "hemispherical" | "flat";
export const HEAD_LABEL: Record<HeadType, string> = {
  ellipsoidal: "بيضاوي 2:1",
  torispherical: "توريسفيريكال (F&D)",
  hemispherical: "نصف كروي",
  flat: "مسطح (للخزانات الجوية)",
};

const r1 = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- وعاء ضغط ----------
export type VesselIn = {
  P: number; // ضغط التصميم MPa
  D: number; // القطر الداخلي ملم
  L: number; // الطول بين خطي اللحام (tan-tan) ملم
  S: number;
  E: number; // كفاءة لحام الجسم
  Eh: number; // كفاءة لحام الرأس (1 للرأس المكبوس قطعة وحدة)
  CA: number; // سماحية التآكل ملم
  head: HeadType;
  thin: number; // نسبة الترقق بالكبس %
  SF: number; // الحافة المستقيمة للرأس ملم
  density: number;
  plateL: number; // طول اللوح ملم
  plateW: number; // عرض اللوح ملم
  minT: number; // أقل سمك مقبول (عملي)
};

export function vessel(v: VesselIn) {
  const R = v.D / 2;
  const SE = v.S * v.E;
  // UG-27(c)(1) جسم أسطواني، إجهاد محيطي
  const tShellReq = (v.P * R) / (SE - 0.6 * v.P);
  // UG-27(c)(2) إجهاد طولي (للتأكد)
  const tLong = (v.P * R) / (2 * v.S * v.E + 0.4 * v.P);
  const tShellMin = Math.max(tShellReq, tLong) + v.CA;
  const tShell = nextPlate(Math.max(tShellMin, v.minT));
  const tc = tShell - v.CA; // السمك بعد التآكل
  const mawpShell = (v.S * v.E * tc) / (R + 0.6 * tc);

  // الرأس
  const SEh = v.S * v.Eh;
  let tHeadReq = 0, mawpHead = Infinity, blank = 0, headVol = 0, headDepth = 0;
  const thin = 1 + v.thin / 100;
  if (v.head === "ellipsoidal") {
    tHeadReq = (v.P * v.D) / (2 * SEh - 0.2 * v.P); // UG-32(d)
    headDepth = v.D / 4;
    headVol = (Math.PI * v.D ** 3) / 24;
  } else if (v.head === "torispherical") {
    tHeadReq = (0.885 * v.P * v.D) / (SEh - 0.1 * v.P); // UG-32(e)، L = D و r = 6%
    headDepth = 0.1935 * v.D;
    headVol = 0.0809 * v.D ** 3;
  } else if (v.head === "hemispherical") {
    tHeadReq = (v.P * R) / (2 * SEh - 0.2 * v.P); // UG-32(f)
    headDepth = R;
    headVol = (Math.PI * v.D ** 3) / 12;
  } else {
    // UG-34 لوح مسطح ملحوم، C = 0.33 تقريباً
    tHeadReq = v.D * Math.sqrt((0.33 * v.P) / SEh);
    headDepth = 0;
  }
  const tHeadMin = tHeadReq * thin + v.CA;
  const tHead = nextPlate(Math.max(tHeadMin, tShell, v.minT));
  const thc = tHead / thin - v.CA;
  if (v.head === "ellipsoidal") mawpHead = (2 * SEh * thc) / (v.D + 0.2 * thc);
  else if (v.head === "torispherical") mawpHead = (SEh * thc) / (0.885 * v.D + 0.1 * thc);
  else if (v.head === "hemispherical") mawpHead = (2 * SEh * thc) / (R + 0.2 * thc);
  else mawpHead = SEh * (thc / v.D) ** 2 / 0.33;
  const OD = v.D + 2 * tShell;
  // قطر قرص القص التقريبي (قاعدة الورش)
  if (v.head === "ellipsoidal") blank = 1.2 * OD + 2 * v.SF;
  else if (v.head === "torispherical") blank = 1.12 * OD + 2 * v.SF;
  else if (v.head === "hemispherical") blank = 1.42 * OD;
  else blank = OD;
  blank = Math.ceil(blank / 5) * 5;
  const sfVol = (Math.PI / 4) * v.D ** 2 * v.SF;

  const mawp = Math.min(mawpShell, mawpHead);
  const hydro = 1.3 * mawp; // UG-99(b) مع نسبة إجهاد 1

  // الحجم والأوزان
  const shellVol = (Math.PI / 4) * v.D ** 2 * v.L;
  const volume = shellVol + 2 * (headVol + sfVol); // ملم³
  const shellKg = (Math.PI * (v.D + tShell) * tShell * v.L * v.density) / 1e6;
  const headBlankKg = ((Math.PI / 4) * blank ** 2 * tHead * v.density) / 1e6;
  const headKg = headBlankKg * 0.85; // تقريباً بعد قص الزوائد
  const emptyKg = shellKg + 2 * headKg;
  const liters = volume / 1e6;

  // فرد الجسم للدرفيل
  const dev = Math.PI * (v.D + tShell); // المحيط على القطر الوسطي
  const courses = Math.max(1, Math.ceil(v.L / v.plateW));
  const perCourse = Math.max(1, Math.ceil(dev / v.plateL));
  const pieceL = dev / perCourse;
  const lastW = v.L - (courses - 1) * v.plateW;
  // إذا الحلقة الأخيرة ضيقة (أقل من ثلث اللوح) نوزع الطول بالتساوي على الحلقات
  const even = courses > 1 && lastW < v.plateW / 3;
  const shellPlates = Array.from({ length: courses }, (_, i) => ({ course: i + 1, w: even ? v.L / courses : i === courses - 1 ? lastW : v.plateW, l: pieceL, n: perCourse }));

  // اللحام
  const longSeams = courses * perCourse; // لحامات طولية
  const longLen = shellPlates.reduce((a, c) => a + c.w * c.n, 0);
  const circLen = (courses - 1 + 2) * Math.PI * (v.D + tShell); // بين الحلقات + رأسين

  // المساحة الخارجية للصبغ (م²)
  const headArea = v.head === "ellipsoidal" ? 1.084 * OD ** 2 : v.head === "torispherical" ? 0.931 * OD ** 2 : v.head === "hemispherical" ? (Math.PI / 2) * OD ** 2 : (Math.PI / 4) * OD ** 2;
  const areaOut = (Math.PI * OD * (v.L + 2 * v.SF) + 2 * headArea) / 1e6;

  return {
    tShellReq: r1(tShellReq, 2), tLong: r1(tLong, 2), tShellMin: r1(tShellMin, 2), tShell, mawpShell,
    tHeadReq: r1(tHeadReq, 2), tHeadMin: r1(tHeadMin, 2), tHead, mawpHead, headDepth: r1(headDepth),
    OD, blank, mawp, hydro,
    liters, emptyKg, waterKg: emptyKg + liters, shellKg, headKg, headBlankKg,
    dev, courses, perCourse, pieceL, shellPlates,
    longSeams, longLen, circLen, areaOut,
    overall: v.L + 2 * (headDepth + v.SF + tHead),
  };
}

// ---------- API 650 خزان عمودي ----------
export type TankIn = { D: number; H: number; HL: number; G: number; CA: number; Sd: number; St: number; plateW: number; plateL: number; density: number; bottomCA: number };

export function minShellT(Dm: number) {
  if (Dm < 15) return 5;
  if (Dm < 36) return 6;
  if (Dm <= 60) return 8;
  return 10;
}

export function api650(t: TankIn) {
  const Dm = t.D / 1000;
  const n = Math.max(1, Math.ceil(t.H / t.plateW));
  const tMin = minShellT(Dm);
  const courses = [];
  for (let i = 0; i < n; i++) {
    const bottom = i * t.plateW; // من أسفل الخزان
    const w = Math.min(t.plateW, t.H - bottom);
    const Hc = Math.max(0, (t.HL - bottom) / 1000); // م: من أسفل الحلقة لأعلى منسوب
    const td = Hc > 0.3 ? (4.9 * Dm * (Hc - 0.3) * t.G) / t.Sd + t.CA : t.CA;
    const tt = Hc > 0.3 ? (4.9 * Dm * (Hc - 0.3)) / t.St : 0;
    const req = Math.max(td, tt, tMin);
    courses.push({ course: i + 1, bottom, w, Hc: r1(Hc, 2), td: r1(td, 2), tt: r1(tt, 2), req: r1(req, 2), t: nextPlate(req) });
  }
  const circ = Math.PI * (t.D + courses[0].t);
  const perCourse = Math.ceil(circ / t.plateL);
  let shellKg = 0;
  for (const c of courses) shellKg += (Math.PI * (t.D + c.t) * c.t * c.w * t.density) / 1e6;
  const tBottom = nextPlate(6 + t.bottomCA);
  const bottomD = t.D + 2 * courses[0].t + 100; // بروز 50 ملم
  const bottomKg = ((Math.PI / 4) * bottomD ** 2 * tBottom * t.density) / 1e6;
  const tRoof = 5;
  const roofKg = ((Math.PI / 4) * (t.D + 2 * courses[n - 1].t) ** 2 * 1.02 * tRoof * t.density) / 1e6; // سقف مخروطي خفيف
  const nominal = ((Math.PI / 4) * t.D ** 2 * t.H) / 1e6; // لتر
  const working = ((Math.PI / 4) * t.D ** 2 * t.HL) / 1e6;
  const areaOut = (Math.PI * (t.D + 2 * courses[0].t) * t.H + (Math.PI / 4) * (t.D + 2 * courses[0].t) ** 2) / 1e6;
  return { courses, perCourse, pieceL: circ / perCourse, circ, shellKg, tBottom, bottomD, bottomKg, tRoof, roofKg, totalKg: shellKg + bottomKg + roofKg, nominal, working, tMin, areaOut, waterKg: shellKg + bottomKg + roofKg + working };
}

// ---------- جدول عمق خزان أفقي (Dip chart) ----------
// حجم السائل بارتفاع h بخزان أسطواني أفقي قطره D وطوله L، مع رأسين (بيضاوي 2:1 أو مسطح أو نصف كروي)
export function horizontalVolume(D: number, L: number, h: number, head: HeadType) {
  const R = D / 2;
  h = Math.min(Math.max(h, 0), D);
  const seg = R * R * Math.acos((R - h) / R) - (R - h) * Math.sqrt(Math.max(0, 2 * R * h - h * h));
  let v = seg * L;
  // حجم الرأسين بارتفاع h: الكروي = π h² (3R − h)/3 لكل كرة كاملة (رأسين = كرة)
  const sphere = (Math.PI * h * h * (3 * R - h)) / 3;
  if (head === "hemispherical") v += sphere;
  else if (head === "ellipsoidal") v += sphere / 2; // عمق الرأس D/4 = نصف الكروي
  else if (head === "torispherical") v += sphere * 0.39; // تقريب
  return v / 1e6; // لتر
}

export function dipChart(D: number, L: number, head: HeadType, step: number) {
  const rows: { h: number; liters: number; pct: number }[] = [];
  const full = horizontalVolume(D, L, D, head);
  for (let h = step; h < D + step / 2; h += step) {
    const hh = Math.min(h, D);
    const v = horizontalVolume(D, L, hh, head);
    rows.push({ h: hh, liters: v, pct: (v / full) * 100 });
  }
  return { full, rows };
}

// ---------- اللحام والصبغ ----------
// مساحة مقطع لحام V بزاوية كلية a، فتحة جذر g، شفة جذر c، وتحديب 1.5 ملم تقريباً
export function vGrooveArea(t: number, angle = 60, g = 2, c = 1.5) {
  const d = Math.max(0, t - c);
  const tri = d * d * Math.tan(((angle / 2) * Math.PI) / 180);
  const top = t * Math.tan(((angle / 2) * Math.PI) / 180) * 2 + g;
  return tri + g * t + (2 / 3) * top * 1.5; // ملم²
}

export const PROCESSES: Record<string, { label: string; eff: number; rate: number }> = {
  smaw: { label: "قوس يدوي (SMAW) · أقطاب", eff: 0.6, rate: 1.2 },
  fcaw: { label: "سلك بقلب مساعد (FCAW)", eff: 0.82, rate: 2.5 },
  gmaw: { label: "سلك CO₂ (GMAW)", eff: 0.92, rate: 2.5 },
  saw: { label: "قوس مغمور (SAW)", eff: 0.98, rate: 6 },
};

export function weld(lenMm: number, t: number, proc: keyof typeof PROCESSES | string, angle = 60, opFactor = 0.35) {
  const p = PROCESSES[proc] ?? PROCESSES.smaw;
  const area = vGrooveArea(t, angle);
  const deposit = (area * lenMm * 7.85) / 1e6; // كغم
  const consumable = deposit / p.eff;
  const arcHours = deposit / p.rate;
  const hours = arcHours / opFactor;
  return { area, deposit, consumable, arcHours, hours, p };
}

export function paint(areaM2: number, dft: number, vs: number, loss: number, coats = 1) {
  const spread = (vs * 10) / dft; // م²/لتر نظري
  const liters = ((areaM2 * coats) / spread) * (1 + loss / 100);
  return { spread, liters };
}
