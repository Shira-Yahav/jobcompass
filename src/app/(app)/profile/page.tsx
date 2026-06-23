"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { TagInput } from "@/components/ui/tag-input";
import { SlidersHorizontal, Info } from "lucide-react";
import type { UserProfile, WorkStyle, FitWeights } from "@/types";
import { DEFAULT_FIT_WEIGHTS as DEFAULTS } from "@/types";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Option lists ─────────────────────────────────────────────────────────────

const COMPANY_SIZE_OPTIONS = ["1–10", "11–50", "51–200", "201–500", "500+"];
const COMPANY_TYPE_OPTIONS = ["Startup", "Scale-up", "Corporate", "Agency", "Non-profit"];
const FUNDING_STAGE_OPTIONS = [
  "Pre-seed", "Seed", "Series A", "Series B", "Series C+",
  "Public", "Bootstrapped", "Any",
];
const DOMAIN_SUGGESTIONS = [
  "SaaS", "FinTech", "HealthTech", "EdTech", "Climate Tech",
  "Developer Tools", "Marketplace", "E-commerce", "Enterprise Software",
  "Consumer", "Defense", "AI / ML",
];
const WORK_STYLE_OPTIONS: { value: WorkStyle; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const FIT_WEIGHT_LABELS: { key: keyof FitWeights; label: string; description: string }[] = [
  { key: "salary", label: "Salary", description: "How much weight to give salary range alignment" },
  { key: "company_type", label: "Company type", description: "Startup vs. corporate preference alignment" },
  { key: "funding_stage", label: "Funding stage", description: "Seed vs. Series A vs. public preference alignment" },
  { key: "domain", label: "Domain / industry", description: "Industry and domain preference alignment" },
  { key: "work_style", label: "Work style", description: "Remote / hybrid / on-site alignment" },
];

type SaveState = "idle" | "saving" | "saved";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = createClient();

  const [desiredPosition, setDesiredPosition] = useState("");
  const [salaryFloor, setSalaryFloor] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);
  const [fundingStages, setFundingStages] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [workStyle, setWorkStyle] = useState<WorkStyle>("hybrid");
  const [fitWeights, setFitWeights] = useState<FitWeights>(DEFAULTS);

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const userIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        const p = data as UserProfile;
        setDesiredPosition(p.desired_position ?? "");
        setSalaryFloor(p.salary_floor ? String(p.salary_floor) : "");
        setCompanySizes(p.company_sizes ?? []);
        setCompanyTypes(p.company_types ?? []);
        setFundingStages(p.funding_stages ?? []);
        setDomains(p.domains ?? []);
        setWorkStyle((p.work_style as WorkStyle) ?? "hybrid");
        setFitWeights(p.fit_weights ?? DEFAULTS);
      }

      setLoading(false);
      setTimeout(() => { initializedRef.current = true; }, 0);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save (debounced 700ms) ────────────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) return;
    const userId = userIdRef.current;
    if (!userId) return;

    setSaveState("saving");

    const timer = setTimeout(async () => {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        desired_position: desiredPosition,
        salary_floor: parseInt(salaryFloor) || 0,
        company_sizes: companySizes,
        company_types: companyTypes,
        funding_stages: fundingStages,
        domains,
        work_style: workStyle,
        fit_weights: fitWeights,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } else {
        setSaveState("idle");
      }
    }, 700);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desiredPosition, salaryFloor, companySizes, companyTypes, fundingStages, domains, workStyle, fitWeights]);

  function setWeight(key: keyof FitWeights, value: number) {
    setFitWeights((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-slate-400">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 border-b border-slate-200">
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">My Profile</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Your preferences and fit formula are used to score every company and role.
          </p>
        </div>
        <div className="text-[12px] shrink-0">
          {saveState === "saving" && (
            <span className="text-slate-400">Saving…</span>
          )}
          {saveState === "saved" && (
            <span className="text-emerald-500 font-medium">Saved ✓</span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="flex flex-col gap-6 max-w-2xl pt-6">

          {/* ── Role ─────────────────────────────────────────────────────── */}
          <FormSection title="Role">
            <div className="flex flex-col gap-4">
              <Field label="Desired position">
                <input
                  type="text"
                  placeholder="e.g. Senior Product Manager"
                  value={desiredPosition}
                  onChange={(e) => setDesiredPosition(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Work style">
                <div className="flex gap-1.5">
                  {WORK_STYLE_OPTIONS.map(({ value, label }) => (
                    <ToggleChip
                      key={value}
                      active={workStyle === value}
                      onClick={() => setWorkStyle(value)}
                    >
                      {label}
                    </ToggleChip>
                  ))}
                </div>
              </Field>
            </div>
          </FormSection>

          <Divider />

          {/* ── Compensation ─────────────────────────────────────────────── */}
          <FormSection title="Compensation">
            <Field label="Minimum salary (USD / year)">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-400">$</span>
                <input
                  type="number"
                  placeholder="130000"
                  value={salaryFloor}
                  onChange={(e) => setSalaryFloor(e.target.value)}
                  className={`${inputCls} w-36`}
                />
                <span className="text-[13px] text-slate-400">and above</span>
              </div>
            </Field>
          </FormSection>

          <Divider />

          {/* ── Company ──────────────────────────────────────────────────── */}
          <FormSection title="Company preferences">
            <div className="flex flex-col gap-4">
              <Field label="Company type">
                <MultiSelect
                  options={COMPANY_TYPE_OPTIONS}
                  value={companyTypes}
                  onChange={setCompanyTypes}
                />
              </Field>
              <Field label="Funding stage">
                <MultiSelect
                  options={FUNDING_STAGE_OPTIONS}
                  value={fundingStages}
                  onChange={setFundingStages}
                />
              </Field>
              <Field label="Company size">
                <MultiSelect
                  options={COMPANY_SIZE_OPTIONS}
                  value={companySizes}
                  onChange={setCompanySizes}
                />
              </Field>
            </div>
          </FormSection>

          <Divider />

          {/* ── Industry ─────────────────────────────────────────────────── */}
          <FormSection title="Industry / domain">
            <TagInput
              value={domains}
              onChange={setDomains}
              suggestions={DOMAIN_SUGGESTIONS}
              placeholder="Type a domain and press Enter…"
            />
          </FormSection>

          <Divider />

          {/* ── Fit Formula ──────────────────────────────────────────────── */}
          <FormSection
            title="Fit formula"
            titleRight={
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-[11px] font-mono font-semibold text-indigo-500">
                  CUSTOM WEIGHTS
                </span>
              </div>
            }
          >
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
                Adjust how much each dimension contributes to your fit score.
                Higher importance = that factor has more influence on the result.
              </p>
              <div className="flex flex-col gap-5">
                {FIT_WEIGHT_LABELS.map(({ key, label, description }) => (
                  <WeightSlider
                    key={key}
                    label={label}
                    description={description}
                    value={fitWeights[key]}
                    onChange={(v) => setWeight(key, v)}
                  />
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">Weights are saved automatically per account</span>
                <button
                  type="button"
                  onClick={() => setFitWeights(DEFAULTS)}
                  className="text-[11px] text-slate-400 hover:text-indigo-500 transition-colors font-medium"
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          </FormSection>

        </div>
      </div>
    </div>
  );
}

// ─── Weight Slider ────────────────────────────────────────────────────────────

function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const importanceLabel = value <= 3 ? "Low" : value <= 7 ? "Medium" : "High";
  const importanceColor = value <= 3 ? "text-slate-400" : value <= 7 ? "text-amber-600" : "text-indigo-500";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-slate-700">{label}</span>
          <Tooltip content={description} side="right">
            <span>
              <Info className="h-3 w-3 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
            </span>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold font-mono ${importanceColor}`}>
            {importanceLabel}
          </span>
          <span className="font-mono text-[12px] font-bold text-slate-900 tabular-nums w-4 text-right">
            {value}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-400 shrink-0 w-6">1</span>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 appearance-none rounded-full bg-slate-200 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-indigo-400
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-indigo-400"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(value - 1) / 9 * 100}%, #e2e8f0 ${(value - 1) / 9 * 100}%, #e2e8f0 100%)`,
          }}
        />
        <span className="text-[10px] text-slate-400 shrink-0 w-6 text-right">10</span>
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const inputCls = `
  h-9 w-full rounded-md border border-slate-200
  bg-white px-3 text-[13px] text-slate-900
  placeholder:text-slate-400 outline-none
  focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100
  transition-colors
`;

function FormSection({
  title,
  titleRight,
  children,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </p>
        {titleRight}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100" />;
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 rounded-md border py-1.5 text-[12px] font-medium transition-colors
        ${active
          ? "border-indigo-400 bg-indigo-50 text-indigo-500"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"}
      `}
    >
      {children}
    </button>
  );
}
