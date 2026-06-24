"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  LayoutList, Plus, Trash2, ExternalLink, ChevronDown, ChevronRight,
  Loader2, BookOpen, AlertTriangle, FileText, Save, X,
} from "lucide-react";
import type { JobApplication, ApplicationStage, ApplicationStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: { value: ApplicationStage; label: string }[] = [
  { value: "applied",          label: "Applied" },
  { value: "intro_call",       label: "Intro Call" },
  { value: "hiring_manager",   label: "Hiring Manager" },
  { value: "technical",        label: "Technical" },
  { value: "panel",            label: "Panel" },
  { value: "contract",         label: "Contract" },
  { value: "offer",            label: "Offer" },
];

const STATUSES: { value: ApplicationStatus; label: string; cls: string }[] = [
  { value: "active",           label: "Active",            cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "pending_company",  label: "Pending Company",   cls: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "pending_me",       label: "Pending Me",        cls: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "rejected",         label: "Rejected",          cls: "text-red-700 bg-red-50 border-red-200" },
  { value: "withdrew",         label: "Withdrew",          cls: "text-slate-600 bg-slate-50 border-slate-200" },
  { value: "offer_received",   label: "Offer Received",    cls: "text-purple-700 bg-purple-50 border-purple-200" },
  { value: "accepted",         label: "Accepted",          cls: "text-emerald-800 bg-emerald-100 border-emerald-300" },
];

function stageLabel(v: ApplicationStage) {
  return STAGES.find((s) => s.value === v)?.label ?? v;
}
function statusMeta(v: ApplicationStatus) {
  return STATUSES.find((s) => s.value === v) ?? STATUSES[0];
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// ─── Draft type for the expanded row editor ───────────────────────────────────

interface RowDraft {
  company_name: string;
  position: string;
  job_description: string;
  job_posting_url: string;
  date_started: string;
  resume_submitted_filename: string;
  notes: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
}

const EMPTY_DRAFT = (defaults: Partial<RowDraft> = {}): RowDraft => ({
  company_name: "",
  position: "",
  job_description: "",
  job_posting_url: "",
  date_started: new Date().toISOString().split("T")[0],
  resume_submitted_filename: "",
  notes: "",
  stage: "applied",
  status: "active",
  ...defaults,
});

type DropdownState = { rowId: string; field: "stage" | "status" } | null;

const NEW_ROW_ID = "__new__";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const supabase = createClient();

  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline dropdown (stage/status)
  const [openDropdown, setOpenDropdown] = useState<DropdownState>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Accordion edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowDraft>(EMPTY_DRAFT());
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Profile defaults
  const [profileDefaults, setProfileDefaults] = useState<{ position: string; resume: string }>({
    position: "", resume: "",
  });

  // ── Load apps + profile defaults ──────────────────────────────────────────
  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then((data) => { setApps(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { toast.error("Failed to load applications."); setLoading(false); });

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("desired_position, resume_filename")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfileDefaults({
          position: data.desired_position ?? "",
          resume: data.resume_filename ?? "",
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openDropdown]);

  // ── Expand row ────────────────────────────────────────────────────────────
  function expandRow(app: JobApplication) {
    setExpandedId(app.id);
    setDraft({
      company_name: app.company_name,
      position: app.position,
      job_description: app.job_description ?? "",
      job_posting_url: app.job_posting_url ?? "",
      date_started: app.date_started,
      resume_submitted_filename: app.resume_submitted_filename ?? "",
      notes: app.notes ?? "",
      stage: app.stage,
      status: app.status,
    });
    setConfirmDeleteId(null);
  }

  function openNew() {
    setExpandedId(NEW_ROW_ID);
    setDraft(EMPTY_DRAFT({
      position: profileDefaults.position,
      resume_submitted_filename: profileDefaults.resume,
    }));
    setConfirmDeleteId(null);
  }

  function collapseRow() {
    setExpandedId(null);
  }

  // ── PATCH helper ──────────────────────────────────────────────────────────
  async function patch(id: string, fields: Partial<JobApplication>) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) { toast.error("Failed to save."); return null; }
    return await res.json() as JobApplication;
  }

  // ── Save expanded row ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft.company_name.trim()) { toast.error("Company name is required."); return; }
    setSaving(true);

    const payload = {
      company_name: draft.company_name,
      position: draft.position,
      job_description: draft.job_description || null,
      job_posting_url: draft.job_posting_url || null,
      date_started: draft.date_started,
      resume_submitted_filename: draft.resume_submitted_filename || null,
      notes: draft.notes || null,
      stage: draft.stage,
      status: draft.status,
    };

    if (expandedId === NEW_ROW_ID) {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Failed to create."); setSaving(false); return; }
      const created: JobApplication = await res.json();
      setApps((prev) => [created, ...prev]);
      toast.success("Application added.");
    } else if (expandedId) {
      const updated = await patch(expandedId, payload);
      if (updated) setApps((prev) => prev.map((a) => (a.id === expandedId ? updated : a)));
    }

    setSaving(false);
    setExpandedId(null);
  }

  // ── Inline dropdown change ────────────────────────────────────────────────
  async function handleDropdownChange(id: string, field: "stage" | "status", value: string) {
    setOpenDropdown(null);
    const updated = await patch(id, { [field]: value } as Partial<JobApplication>);
    if (updated) setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
    if (expandedId === id) setExpandedId(null);
    toast.success("Application removed.");
  }

  // ─────────────────────────────────────────────────────────────────────────
  const showNewRow = expandedId === NEW_ROW_ID;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <LayoutList className="h-4 w-4 text-indigo-500" />
            <h1 className="text-[15px] font-semibold text-slate-900">Applications</h1>
          </div>
          <p className="text-[13px] text-slate-500 pl-6">
            Track every role from first application to offer.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 pb-10 pt-4">

        {loading && (
          <div className="flex h-44 items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Loading…</span>
          </div>
        )}

        {!loading && apps.length === 0 && !showNewRow && (
          <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 text-center">
            <LayoutList className="h-8 w-8 text-slate-200" />
            <div>
              <p className="text-[13px] font-medium text-slate-400">No applications yet</p>
              <p className="text-[12px] text-slate-300 mt-0.5">
                Click "+ New" or use "Add to Tracker" from a research page
              </p>
            </div>
          </div>
        )}

        {(!loading) && (apps.length > 0 || showNewRow) && (
          <div ref={dropdownRef}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="w-8" />
                  {["Company", "Position", "Stage", "Status", "Application Date", "Link", "Practice", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* ── New row (at top when creating) ────────────────────── */}
                {showNewRow && (
                  <>
                    <tr className="border-b border-indigo-100 bg-indigo-50/40">
                      <td className="pl-3">
                        <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
                      </td>
                      <td colSpan={8} className="px-3 py-2.5 text-[12px] font-medium text-indigo-400 italic">
                        New application
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={9} className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
                        <ExpandedForm
                          draft={draft}
                          setDraft={setDraft}
                          onSave={handleSave}
                          onDiscard={collapseRow}
                          saving={saving}
                          isNew
                        />
                      </td>
                    </tr>
                  </>
                )}

                {/* ── Existing rows ─────────────────────────────────────── */}
                {apps.map((app) => {
                  const sm = statusMeta(app.status);
                  const isExpanded = expandedId === app.id;
                  const isConfirmDelete = confirmDeleteId === app.id;

                  return (
                    <>
                      <tr
                        key={app.id}
                        className={`border-b border-slate-100 transition-colors ${isExpanded ? "bg-slate-50" : "hover:bg-slate-50/60"}`}
                      >
                        {/* Expand chevron */}
                        <td className="pl-3 pr-1">
                          <button
                            onClick={() => isExpanded ? collapseRow() : expandRow(app)}
                            className="rounded p-1 text-slate-300 hover:text-slate-500 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>

                        {/* Company */}
                        <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap max-w-[160px]">
                          <span className="truncate block">{app.company_name || "—"}</span>
                        </td>

                        {/* Position */}
                        <td className="px-3 py-3 text-slate-600 max-w-[150px]">
                          <span className="truncate block">{app.position || <span className="text-slate-300">—</span>}</span>
                        </td>

                        {/* Stage dropdown */}
                        <td className="px-3 py-3 whitespace-nowrap relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown?.rowId === app.id && openDropdown.field === "stage"
                                  ? null : { rowId: app.id, field: "stage" }
                              )
                            }
                            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:border-slate-300 transition-colors"
                          >
                            {stageLabel(app.stage)}
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </button>
                          {openDropdown?.rowId === app.id && openDropdown.field === "stage" && (
                            <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              {STAGES.map((s) => (
                                <button
                                  key={s.value}
                                  onClick={() => handleDropdownChange(app.id, "stage", s.value)}
                                  className={`flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.stage === s.value ? "font-semibold text-indigo-500" : "text-slate-700"}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Status dropdown */}
                        <td className="px-3 py-3 whitespace-nowrap relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown?.rowId === app.id && openDropdown.field === "status"
                                  ? null : { rowId: app.id, field: "status" }
                              )
                            }
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${sm.cls}`}
                          >
                            {sm.label}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                          {openDropdown?.rowId === app.id && openDropdown.field === "status" && (
                            <div className="absolute z-20 mt-1 min-w-[170px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              {STATUSES.map((s) => (
                                <button
                                  key={s.value}
                                  onClick={() => handleDropdownChange(app.id, "status", s.value)}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.status === s.value ? "font-semibold" : ""}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full border ${s.cls}`} />
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Application date */}
                        <td className="px-3 py-3 whitespace-nowrap font-mono text-[12px] text-slate-500">
                          {formatDate(app.date_started)}
                        </td>

                        {/* Link */}
                        <td className="px-3 py-3">
                          {app.job_posting_url ? (
                            <a
                              href={app.job_posting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-indigo-400 hover:text-indigo-600"
                              title={app.job_posting_url}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>

                        {/* Practice — always visible */}
                        <td className="px-3 py-3">
                          <button
                            disabled
                            title="Practice interview — coming in V1"
                            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 cursor-not-allowed"
                          >
                            <BookOpen className="h-3 w-3" />
                            Practice
                          </button>
                        </td>

                        {/* Delete (with confirm) */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {isConfirmDelete ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-red-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Delete?
                              </span>
                              <button
                                onClick={() => handleDelete(app.id)}
                                className="rounded px-2 py-0.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(app.id)}
                              className="rounded p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${app.id}-expanded`}>
                          <td colSpan={9} className="border-b border-slate-200 bg-slate-50/60 px-5 py-4">
                            <ExpandedForm
                              draft={draft}
                              setDraft={setDraft}
                              onSave={handleSave}
                              onDiscard={collapseRow}
                              saving={saving}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expanded inline form ─────────────────────────────────────────────────────

function ExpandedForm({
  draft, setDraft, onSave, onDiscard, saving, isNew,
}: {
  draft: RowDraft;
  setDraft: React.Dispatch<React.SetStateAction<RowDraft>>;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const set = (field: keyof RowDraft) => (v: string) =>
    setDraft((d) => ({ ...d, [field]: v }));

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {/* Row 1: company + position */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Company name *">
          <TextInput value={draft.company_name} onChange={set("company_name")} placeholder="e.g. Stripe" />
        </FormField>
        <FormField label="Position">
          <TextInput value={draft.position} onChange={set("position")} placeholder="e.g. Senior PM" />
        </FormField>
      </div>

      {/* Row 2: date + URL + resume */}
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Application date">
          <input
            type="date"
            value={draft.date_started}
            onChange={(e) => set("date_started")(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
          />
        </FormField>
        <FormField label="Job posting URL">
          <TextInput value={draft.job_posting_url} onChange={set("job_posting_url")} placeholder="https://…" />
        </FormField>
        <FormField label="Resume submitted">
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            <input
              type="text"
              value={draft.resume_submitted_filename}
              onChange={(e) => set("resume_submitted_filename")(e.target.value)}
              placeholder="filename.pdf"
              className="flex-1 text-[13px] text-slate-700 outline-none placeholder:text-slate-300 min-w-0"
            />
          </div>
        </FormField>
      </div>

      {/* Row 3: JD */}
      <FormField label="Job description">
        <textarea
          value={draft.job_description}
          onChange={(e) => set("job_description")(e.target.value)}
          rows={5}
          placeholder="Paste the full job description…"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
        />
      </FormField>

      {/* Row 4: notes */}
      <FormField label="Notes">
        <textarea
          value={draft.notes}
          onChange={(e) => set("notes")(e.target.value)}
          rows={2}
          placeholder="Recruiter name, referral contact, prep tips…"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {isNew ? "Add application" : "Save changes"}
        </button>
        <button
          onClick={onDiscard}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:border-slate-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors"
    />
  );
}
