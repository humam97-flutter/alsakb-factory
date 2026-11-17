import { API650_MATERIALS, api650, ASME_MATERIALS, BAR, JOINT_E, vessel, type HeadType, type TankIn, type VesselIn } from "@/lib/engineering";

type SP = Record<string, string | undefined>;
const n = (sp: SP, k: string, d: number) => {
  const v = sp[k];
  return v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v);
};

export const VESSEL_DEF = { mat: "SA-516-70", p: 10, d: 1500, l: 4700, ca: 3, joint: "spot", hjoint: "full", head: "ellipsoidal", thin: 10, sf: 40, pl: 6000, pw: 1500, mint: 6, s: "" };

// المدخلات من الرابط (الضغط بالبار) إلى وحدات الحساب
export function vesselInput(sp: SP) {
  const mat = sp.mat && ASME_MATERIALS[sp.mat] ? sp.mat : VESSEL_DEF.mat;
  const m = ASME_MATERIALS[mat];
  const head = (["ellipsoidal", "torispherical", "hemispherical", "flat"].includes(sp.head ?? "") ? sp.head : VESSEL_DEF.head) as HeadType;
  const inp: VesselIn = {
    P: n(sp, "p", VESSEL_DEF.p) * BAR,
    D: n(sp, "d", VESSEL_DEF.d),
    L: n(sp, "l", VESSEL_DEF.l),
    S: n(sp, "s", m.S),
    E: JOINT_E[sp.joint ?? ""]?.E ?? JOINT_E[VESSEL_DEF.joint].E,
    Eh: JOINT_E[sp.hjoint ?? ""]?.E ?? JOINT_E[VESSEL_DEF.hjoint].E,
    CA: n(sp, "ca", VESSEL_DEF.ca),
    head,
    thin: head === "flat" ? 0 : n(sp, "thin", VESSEL_DEF.thin),
    SF: head === "flat" || head === "hemispherical" ? 0 : n(sp, "sf", VESSEL_DEF.sf),
    density: m.density,
    plateL: n(sp, "pl", VESSEL_DEF.pl),
    plateW: n(sp, "pw", VESSEL_DEF.pw),
    minT: n(sp, "mint", VESSEL_DEF.mint),
  };
  return { inp, mat, m };
}

export const TANK_DEF = { mat: "A36", d: 10000, h: 9000, hl: 8500, g: 0.85, ca: 1.5, bca: 1.5, pw: 1800, pl: 6000 };

export function tankInput(sp: SP) {
  const mat = sp.mat && API650_MATERIALS[sp.mat] ? sp.mat : TANK_DEF.mat;
  const m = API650_MATERIALS[mat];
  const H = n(sp, "h", TANK_DEF.h);
  const inp: TankIn = {
    D: n(sp, "d", TANK_DEF.d),
    H,
    HL: Math.min(n(sp, "hl", TANK_DEF.hl), H),
    G: n(sp, "g", TANK_DEF.g),
    CA: n(sp, "ca", TANK_DEF.ca),
    bottomCA: n(sp, "bca", TANK_DEF.bca),
    Sd: m.Sd,
    St: m.St,
    plateW: n(sp, "pw", TANK_DEF.pw),
    plateL: n(sp, "pl", TANK_DEF.pl),
    density: 7.85,
  };
  return { inp, mat, m };
}

// يرجع المدخلات كنص للحفظ والروابط
export function pick(sp: SP, def: Record<string, unknown>) {
  const o: Record<string, string> = {};
  for (const k of Object.keys(def)) if (sp[k] !== undefined && sp[k] !== "") o[k] = String(sp[k]);
  return o;
}

// قطع القص (ألواح الجسم وأقراص الرؤوس أو ألواح الحلقات) من مدخلات حساب محفوظ
export function partsFor(kind: string, raw: SP) {
  if (kind === "vessel") {
    const { inp, mat } = vesselInput(raw);
    const r = vessel(inp);
    const grade = ASME_MATERIALS[mat]?.grade ?? "A516 Gr70";
    return [
      ...r.shellPlates.map((c) => ({ name: `Shell C${c.course}`, shape: "rect", grade, thickness: r.tShell, length_mm: Math.round(Math.max(c.l, c.w)), width_mm: Math.round(Math.min(c.l, c.w)), qty: c.n })),
      inp.head === "flat"
        ? { name: "Flat head", shape: "circle", grade, thickness: r.tHead, diameter_mm: Math.round(r.OD), qty: 2 }
        : { name: "Head blank", shape: "circle", grade, thickness: r.tHead, diameter_mm: r.blank, qty: 2 },
    ];
  }
  if (kind === "tank") {
    const { inp, mat } = tankInput(raw);
    const r = api650(inp);
    const grade = API650_MATERIALS[mat]?.grade ?? "A36";
    return r.courses.map((c) => ({ name: `Course ${c.course}`, shape: "rect", grade, thickness: c.t, length_mm: Math.round(Math.max(r.pieceL, c.w)), width_mm: Math.round(Math.min(r.pieceL, c.w)), qty: r.perCourse }));
  }
  return [];
}
