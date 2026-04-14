"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { TagInput } from "@/components/ui/tag-input";
import type { UserProfile, WorkStyle, RoleType } from "@/types";

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
const ROLE_TYPE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: "ic", label: "IC" },
  { value: "manager", label: "Manager" },
  { value: "both", label: "Both" },
];
const WORK_STYLE_OPTIONS: { value: WorkStyle; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
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
  const [roleType, setRoleType] = useState<RoleType>("ic");
  const [workStyle, setWorkStyle] = useState<WorkStyle>("hybrid");

  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Track user id and whether initial load is complete (so we don't auto-save on mount)
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
        setRoleType((p.role_type as RoleType) ?? "ic");
        setWorkStyle((p.work_style as WorkStyle) ?? "hybrid");
      }

      setLoading(false);
      // Mark initialized after a tick so the useEffect below doesn't fire immediately
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
        role_type: roleType,
        work_style: workStyle,
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
  }, [desiredPosition, salaryFloor, companySizes, companyTypes, fundingStages, domains, roleType, workStyle]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-[--muted-foreground]">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-[--foreground]">My Profile</h1>
          <p className="text-[13px] text-[--muted-foreground] mt-0.5">
            Your preferences are used to score every company and role against what you actually want.
          </p>
        </div>
        {/* Auto-save indicator */}
        <div className="text-[12px] shrink-0">
          {saveState === "saving" && (
            <span className="text-[--muted-foreground]">Saving…</span>
          )}
          {saveState === "saved" && (
            <span className="text-emerald-400">Saved</span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="flex flex-col gap-6 max-w-2xl">

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

              <div className="grid grid-cols-2 gap-4">
                <Field label="Role type">
                  <div className="flex gap-1.5">
                    {ROLE_TYPE_OPTIONS.map(({ value, label }) => (
                      <ToggleChip
                        key={value}
                        active={roleType === value}
                        onClick={() => setRoleType(value)}
                      >
                        {label}
                      </ToggleChip>
                    ))}
                  </div>
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
            </div>
          </FormSection>

          <Divider />

          {/* ── Compensation ─────────────────────────────────────────────── */}
          <FormSection title="Compensation">
            <Field label="Minimum salary (USD / year)">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[--muted-foreground]">$</span>
                <input
                  type="number"
                  placeholder="130000"
                  value={salaryFloor}
                  onChange={(e) => setSalaryFloor(e.target.value)}
                  className={`${inputCls} w-36`}
                />
                <span className="text-[13px] text-[--muted-foreground]">and above</span>
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
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const inputCls = `
  h-9 w-full rounded-md border border-slate-200
  bg-white px-3 text-[13px] text-slate-900
  placeholder:text-slate-400 outline-none
  focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200
  transition-colors
`;

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[--muted-foreground]">
        {title}
      </p>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[--muted-foreground]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[--border]" />;
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
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"}
      `}
    >
      {children}
    </button>
  );
}
