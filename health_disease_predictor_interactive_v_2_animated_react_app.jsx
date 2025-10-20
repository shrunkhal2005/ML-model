import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

/*************************************************
 * Health Disease Predictor — Interactive v2
 * Stack: React + Tailwind + framer-motion + recharts
 * Highlights:
 *  - Multi-disease selector (Heart / Diabetes / Stroke)
 *  - Live sliders + instant prediction
 *  - A/B Compare (Scenario A vs Scenario B)
 *  - Presets (Athlete / Office / Smoker / Diabetic)
 *  - Risk timeline (what‑if lifestyle improvement)
 *  - Save/Load profiles (localStorage)
 *  - Hinglish helper toggle + Dark Mode
 *  - Client-side only (toy models!)
 *************************************************/

// ---- Utilities ----
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const percent = (n) => `${Math.round(n * 100)}%`;

// ---- Toy weights per disease (NOT MEDICAL) ----
const DISEASES = {
  heart: {
    label: "Heart Disease",
    bias: -4.7,
    w: {
      age: 0.025,
      sexMale: 0.12,
      bmi: 0.06,
      systolic: 0.018,
      diastolic: 0.01,
      cholesterol: 0.025,
      glucose: 0.02,
      smoker: 0.28,
      exercise: -0.05,
      sleep: -0.02,
      familyHx: 0.32,
      stress: 0.06,
    },
  },
  diabetes: {
    label: "Type‑2 Diabetes",
    bias: -5.4,
    w: {
      age: 0.02,
      sexMale: 0.05,
      bmi: 0.09,
      systolic: 0.012,
      diastolic: 0.008,
      cholesterol: 0.015,
      glucose: 0.04,
      smoker: 0.15,
      exercise: -0.04,
      sleep: -0.01,
      familyHx: 0.35,
      stress: 0.03,
    },
  },
  stroke: {
    label: "Stroke",
    bias: -5.1,
    w: {
      age: 0.03,
      sexMale: 0.06,
      bmi: 0.04,
      systolic: 0.024,
      diastolic: 0.012,
      cholesterol: 0.02,
      glucose: 0.02,
      smoker: 0.22,
      exercise: -0.03,
      sleep: -0.015,
      familyHx: 0.28,
      stress: 0.05,
    },
  },
};

const DEFAULT_FEATURES = {
  age: 28,
  sex: "male", // male/female
  bmi: 24,
  systolic: 118,
  diastolic: 76,
  cholesterol: 170,
  glucose: 92,
  smoker: false,
  exercise: 3,
  sleep: 7,
  familyHx: false,
  stress: 3,
};

function scoreRisk(features, diseaseKey) {
  const cfg = DISEASES[diseaseKey];
  const w = cfg.w;
  const z =
    cfg.bias +
    w.age * features.age +
    w.sexMale * (features.sex === "male" ? 1 : 0) +
    w.bmi * features.bmi +
    w.systolic * features.systolic +
    w.diastolic * features.diastolic +
    w.cholesterol * features.cholesterol +
    w.glucose * features.glucose +
    w.smoker * (features.smoker ? 1 : 0) +
    w.exercise * features.exercise +
    w.sleep * features.sleep +
    w.familyHx * (features.familyHx ? 1 : 0) +
    w.stress * features.stress;
  return clamp(sigmoid(z), 0, 1);
}

function importance(features, diseaseKey) {
  const cfg = DISEASES[diseaseKey];
  const w = cfg.w;
  const entries = [
    { name: "Age", raw: w.age * features.age },
    { name: "Male", raw: w.sexMale * (features.sex === "male" ? 1 : 0) },
    { name: "BMI", raw: w.bmi * features.bmi },
    { name: "Systolic", raw: w.systolic * features.systolic },
    { name: "Diastolic", raw: w.diastolic * features.diastolic },
    { name: "Chol", raw: w.cholesterol * features.cholesterol },
    { name: "Glucose", raw: w.glucose * features.glucose },
    { name: "Smoker", raw: w.smoker * (features.smoker ? 1 : 0) },
    { name: "Exercise", raw: w.exercise * features.exercise },
    { name: "Sleep", raw: w.sleep * features.sleep },
    { name: "FamHx", raw: w.familyHx * (features.familyHx ? 1 : 0) },
    { name: "Stress", raw: w.stress * features.stress },
  ];
  const total = entries.reduce((s, e) => s + Math.abs(e.raw), 0) || 1;
  return entries.map((e) => ({ ...e, pct: Math.round((Math.abs(e.raw) / total) * 100) }));
}

// ---- Small UI atoms ----
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl bg-white/70 backdrop-blur shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>
);
const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-slate-700 border-slate-200 bg-white">{children}</span>
);
const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
    {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
  </div>
);
const Field = ({ label, hint, children }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</label>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
    {children}
  </div>
);
const GradientText = ({ children }) => (
  <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500">{children}</span>
);
const GradientBar = ({ value }) => (
  <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden dark:bg-slate-700">
    <motion.div
      className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500"
      initial={{ width: 0 }}
      animate={{ width: `${clamp(value, 0, 1) * 100}%` }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    />
  </div>
);

// ---- Presets ----
const PRESETS = {
  Athlete: { age: 26, sex: "male", bmi: 22, systolic: 112, diastolic: 70, cholesterol: 155, glucose: 88, smoker: false, exercise: 7, sleep: 8, familyHx: false, stress: 2 },
  Office: { age: 30, sex: "female", bmi: 26, systolic: 120, diastolic: 78, cholesterol: 175, glucose: 95, smoker: false, exercise: 2, sleep: 7, familyHx: false, stress: 5 },
  Smoker: { age: 35, sex: "male", bmi: 27, systolic: 126, diastolic: 82, cholesterol: 190, glucose: 98, smoker: true, exercise: 1, sleep: 6.5, familyHx: true, stress: 6 },
  Diabetic: { age: 45, sex: "female", bmi: 30, systolic: 130, diastolic: 85, cholesterol: 200, glucose: 130, smoker: false, exercise: 1.5, sleep: 7, familyHx: true, stress: 5 },
};

// ---- Main App ----
export default function HealthPredictorInteractive() {
  const [dark, setDark] = useState(false);
  const [hinglish, setHinglish] = useState(false);
  const [disease, setDisease] = useState("heart");
  const [A, setA] = useState(DEFAULT_FEATURES);
  const [B, setB] = useState({ ...DEFAULT_FEATURES, exercise: 5, sleep: 7.5, smoker: false, stress: 2 });
  const [activeSide, setActiveSide] = useState("A");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hdp.v2.state");
      if (saved) {
        const parsed = JSON.parse(saved);
        setDark(!!parsed.dark);
        setHinglish(!!parsed.hinglish);
        setDisease(parsed.disease || "heart");
        setA(parsed.A || DEFAULT_FEATURES);
        setB(parsed.B || B);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("hdp.v2.state", JSON.stringify({ dark, hinglish, disease, A, B })); } catch {}
  }, [dark, hinglish, disease, A, B]);

  const riskA = useMemo(() => scoreRisk(A, disease), [A, disease]);
  const riskB = useMemo(() => scoreRisk(B, disease), [B, disease]);
  const impA = useMemo(() => importance(A, disease), [A, disease]);
  const impB = useMemo(() => importance(B, disease), [B, disease]);

  // lifestyle improvement timeline (start from A, step towards B)
  const timeline = useMemo(() => {
    const steps = 11; // 0..10
    return Array.from({ length: steps }, (_, i) => {
      const t = i / 10;
      const f = Object.fromEntries(Object.keys(A).map((k) => [k, (1 - t) * A[k] + t * B[k]]));
      const r = scoreRisk(f, disease);
      return { step: i, risk: r };
    });
  }, [A, B, disease]);

  const active = activeSide === "A" ? A : B;
  const setActive = activeSide === "A" ? setA : setB;

  const heroGradient = "bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_40%),radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.18),transparent_40%)]";

  return (
    <div className={`${dark ? "dark" : ""}`}>
      <div className={`min-h-screen ${heroGradient} bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100`}>
        {/* Navbar */}
        <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-slate-900/70 border-b border-slate-200/60 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-blue-500"
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 120 }}
              />
              <div>
                <h1 className="text-lg font-semibold"><GradientText>HealthPredict v2</GradientText></h1>
                <p className="text-xs text-slate-500">Multi‑disease, interactive & visual</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setHinglish((v) => !v)} className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">{hinglish ? "EN" : "हिंग्लिश"}</button>
              <button onClick={() => setDark((v) => !v)} className="px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">{dark ? "Light" : "Dark"}</button>
            </div>
          </div>
        </header>

        {/* Top Controls */}
        <section className="max-w-6xl mx-auto px-4 pt-6 pb-2">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-4">
              <SectionTitle title={hinglish ? "Disease चुनें" : "Choose Disease"} />
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DISEASES).map(([k, v]) => (
                  <button key={k} onClick={() => setDisease(k)} className={`px-3 py-2 rounded-xl border text-sm transition ${disease === k ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"}`}>
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Toy model for learning. Not medical advice.</p>
            </Card>

            <Card className="p-4">
              <SectionTitle title={hinglish ? "Scenario A / B Compare" : "Compare Scenario A / B"} />
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveSide("A")} className={`px-3 py-2 rounded-xl border text-sm ${activeSide === "A" ? "bg-sky-50 border-sky-200 text-sky-700" : "bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"}`}>Edit A</button>
                <button onClick={() => setActiveSide("B")} className={`px-3 py-2 rounded-xl border text-sm ${activeSide === "B" ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"}`}>Edit B</button>
                <div className="ml-auto text-xs flex items-center gap-2">
                  <Pill>A: {percent(riskA)}</Pill>
                  <Pill>B: {percent(riskB)}</Pill>
                  <Pill>Δ {Math.abs(Math.round((riskB - riskA) * 100))}%</Pill>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.keys(PRESETS).map((k) => (
                  <button key={k} onClick={() => (activeSide === "A" ? setA(PRESETS[k]) : setB(PRESETS[k]))} className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                    {k}
                  </button>
                ))}
                <button onClick={() => (activeSide === "A" ? setA(DEFAULT_FEATURES) : setB(DEFAULT_FEATURES))} className="px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">Reset</button>
              </div>
            </Card>

            <Card className="p-4">
              <SectionTitle title={hinglish ? "Profiles Save/Load" : "Save / Load Profiles"} />
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => saveProfile(activeSide, active)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Save {activeSide}</button>
                <button onClick={() => loadProfile(activeSide, setActive)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Load {activeSide}</button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Profiles stored locally only.</p>
            </Card>
          </div>
        </section>

        {/* Main content */}
        <section className="max-w-6xl mx-auto px-4 pt-4 pb-10">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <Card className="p-6">
              <SectionTitle title={hinglish ? (activeSide === "A" ? "Scenario A इनपुट" : "Scenario B इनपुट") : (activeSide === "A" ? "Scenario A Inputs" : "Scenario B Inputs")} subtitle={hinglish ? "Sliders ghumao aur turant result dekho" : "Use the sliders and see the result instantly"} />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={hinglish ? "Age (saal)" : "Age"}>
                  <input type="number" min={0} className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.age} onChange={(e) => setActive({ ...active, age: Number(e.target.value) })} />
                </Field>
                <Field label={hinglish ? "Sex" : "Sex"}>
                  <select className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.sex} onChange={(e) => setActive({ ...active, sex: e.target.value })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>

                <Field label="BMI">
                  <input type="range" min={14} max={40} step={0.1} value={active.bmi} onChange={(e) => setActive({ ...active, bmi: Number(e.target.value) })} className="w-full" />
                  <div className="text-xs">{active.bmi.toFixed(1)}</div>
                </Field>

                <Field label={hinglish ? "Systolic BP (mmHg)" : "Systolic BP (mmHg)"}>
                  <input type="number" min={80} max={200} className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.systolic} onChange={(e) => setActive({ ...active, systolic: Number(e.target.value) })} />
                </Field>

                <Field label={hinglish ? "Diastolic BP (mmHg)" : "Diastolic BP (mmHg)"}>
                  <input type="number" min={50} max={140} className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.diastolic} onChange={(e) => setActive({ ...active, diastolic: Number(e.target.value) })} />
                </Field>

                <Field label={hinglish ? "Cholesterol (mg/dL)" : "Cholesterol (mg/dL)"}>
                  <input type="number" min={100} max={300} className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.cholesterol} onChange={(e) => setActive({ ...active, cholesterol: Number(e.target.value) })} />
                </Field>

                <Field label={hinglish ? "Fasting Glucose (mg/dL)" : "Fasting Glucose (mg/dL)"}>
                  <input type="number" min={70} max={250} className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white dark:bg-slate-800" value={active.glucose} onChange={(e) => setActive({ ...active, glucose: Number(e.target.value) })} />
                </Field>

                <Field label={hinglish ? "Exercise (hrs/week)" : "Exercise (hrs/week)"}>
                  <input type="range" min={0} max={14} step={0.5} value={active.exercise} onChange={(e) => setActive({ ...active, exercise: Number(e.target.value) })} className="w-full" />
                  <div className="text-xs">{active.exercise} hrs</div>
                </Field>

                <Field label={hinglish ? "Sleep (hrs/night)" : "Sleep (hrs/night)"}>
                  <input type="range" min={3} max={10} step={0.1} value={active.sleep} onChange={(e) => setActive({ ...active, sleep: Number(e.target.value) })} className="w-full" />
                  <div className="text-xs">{active.sleep.toFixed(1)} hrs</div>
                </Field>

                <Field label={hinglish ? "Stress (0-10)" : "Stress (0-10)"}>
                  <input type="range" min={0} max={10} step={1} value={active.stress} onChange={(e) => setActive({ ...active, stress: Number(e.target.value) })} className="w-full" />
                  <div className="text-xs">{active.stress}/10</div>
                </Field>

                <Field label={hinglish ? "Smoker?" : "Smoker?"}>
                  <button type="button" onClick={() => setActive({ ...active, smoker: !active.smoker })} className={`px-3 py-2 rounded-xl border transition ${active.smoker ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>{active.smoker ? (hinglish ? "Haan" : "Yes") : (hinglish ? "Nahi" : "No")}</button>
                </Field>

                <Field label={hinglish ? "Family History?" : "Family History?"}>
                  <button type="button" onClick={() => setActive({ ...active, familyHx: !active.familyHx })} className={`px-3 py-2 rounded-xl border transition ${active.familyHx ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>{active.familyHx ? (hinglish ? "Haan" : "Yes") : (hinglish ? "Nahi" : "No")}</button>
                </Field>
              </div>

              <p className="text-[11px] text-slate-500 mt-3">Disclaimer: Educational demo only. Not a diagnostic tool. Talk to a clinician for medical guidance.</p>
            </Card>

            {/* Right: Visuals */}
            <Card className="p-6">
              <SectionTitle title={hinglish ? "A/B Risk Meter" : "A/B Risk Meter"} subtitle={hinglish ? "Dono scenario ka difference dekho" : "See the difference between scenarios"} />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Pill>A: {percent(riskA)}</Pill>
                  <Pill>B: {percent(riskB)}</Pill>
                  <Pill>{hinglish ? "Farq" : "Delta"}: {Math.round((riskB - riskA) * 100)}%</Pill>
                </div>
                <GradientBar value={riskA} />
                <GradientBar value={riskB} />

                <AnimatePresence mode="popLayout">
                  <motion.div key={`${disease}-${riskA}-${riskB}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="text-sm">
                    {hinglish ? (
                      <>
                        {riskB < riskA ? "Scenario B behtar hai—risk kam ho raha hai." : "Scenario B me risk zyada hai—habits sudharo."}
                      </>
                    ) : (
                      <>
                        {riskB < riskA ? "Scenario B looks better — risk goes down." : "Scenario B increases risk — consider healthier changes."}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Importance charts */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-sm font-medium mb-2">{hinglish ? "Importance (A)" : "Importance (A)"}</div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart innerRadius="20%" outerRadius="90%" data={impA}>
                          <RadialBar minAngle={4} background clockWise dataKey="pct" />
                          <ReTooltip formatter={(v, n, p) => [`${v}%`, p?.payload?.name]} />
                          <Legend />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm font-medium mb-2">{hinglish ? "Importance (B)" : "Importance (B)"}</div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart innerRadius="20%" outerRadius="90%" data={impB}>
                          <RadialBar minAngle={4} background clockWise dataKey="pct" />
                          <ReTooltip formatter={(v, n, p) => [`${v}%`, p?.payload?.name]} />
                          <Legend />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                {/* What‑if timeline */}
                <Card className="p-4">
                  <div className="text-sm font-medium mb-2">{hinglish ? "Lifestyle Improvement Timeline" : "Lifestyle Improvement Timeline"}</div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="step" tickFormatter={(t) => `+${t}`} />
                        <YAxis domain={[0, 1]} tickFormatter={(t) => `${Math.round(t * 100)}%`} />
                        <ReTooltip formatter={(v) => percent(v)} labelFormatter={(l) => `Improvement units: ${l}`} />
                        <Area type="monotone" dataKey="risk" strokeWidth={2} fillOpacity={0.25} />
                        <Line type="monotone" dataKey="risk" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </Card>
          </div>

          {/* Tips */}
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <Card className="p-5">
              <h3 className="font-semibold">{hinglish ? "Yeh kaise kaam karta hai" : "How it works"}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                {hinglish
                  ? "Ye ek simple logistic model hai jo inputs ko probability‑like risk score me convert karta hai."
                  : "A simple logistic model turns inputs into a probability‑like risk score."}
                &nbsp;<b>Client‑side only</b>.
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-300 mt-3 list-disc pl-5 space-y-1">
                <li>{hinglish ? "Red badhata, Green ghatata risk." : "Red increases, green decreases risk."}</li>
                <li>{hinglish ? "Timeline se dekh sakte ho improvement ka effect." : "Timeline shows the effect of gradual improvements."}</li>
                <li>{hinglish ? "A/B se tez comparison milta hai." : "A/B makes comparisons fast and clear."}</li>
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold">{hinglish ? "Quick Tips (non‑medical)" : "Quick tips (non‑medical)"}</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-300 mt-2 list-disc pl-5 space-y-1">
                <li>{hinglish ? "150+ min/week activity aim karo (agar safe ho)." : "Aim for 150+ min/week of activity if safe for you."}</li>
                <li>{hinglish ? "7–9 ghante ki neend rakho." : "Target 7–9 hours of sleep."}</li>
                <li>{hinglish ? "BP, glucose, lipids clinician se discuss karo." : "Discuss BP, glucose, and lipids with a clinician."}</li>
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold">Developer Notes</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Swap the toy <code>scoreRisk()</code> with your ML API/TF.js model. Add auth, dataset‑backed SHAP, and logging.
              </p>
              <pre className="mt-3 text-xs bg-slate-900 text-slate-100 p-3 rounded-xl overflow-auto">{`
// Example FastAPI contract
POST /api/predict
Body: { disease: "heart|diabetes|stroke", features: { ... } }
Resp: { probability: 0.0..1.0 }
`}</pre>
            </Card>
          </div>
        </section>

        <footer className="border-t border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70">
          <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500 flex items-center justify-between">
            <div>© {new Date().getFullYear()} HealthPredict v2 — Educational only.</div>
            <div>Built with ❤️ for learning.</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---- Local profile utils ----
function saveProfile(which, data) {
  try {
    localStorage.setItem(`hdp.profile.${which}`, JSON.stringify(data));
    alert(`Saved profile ${which}`);
  } catch (e) {
    alert("Save failed");
  }
}
function loadProfile(which, setter) {
  try {
    const raw = localStorage.getItem(`hdp.profile.${which}`);
    if (!raw) return alert("No saved profile");
    const data = JSON.parse(raw);
    setter(data);
  } catch (e) {
    alert("Load failed");
  }
}
