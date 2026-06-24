"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { toast } from "sonner";
import {
  LayoutList, Plus, Trash2, ExternalLink, Pencil, X, ChevronDown,
  Loader2, BookOpen,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type DropdownType = { rowId: string; field: "stage" | "status" } | null;

interface EditModalData {
  id: string | null; // null = new
  company_name: string;
  position: string;
  job_description: string;
  job_posting_url: string;
  date_started: string;
  notes: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
  resume_submitted_filename: string;
}

const EMPTY_MODAL: EditModalData = {
  id: null,
  company_name: "",
  position: "",
  job_description: "",
  job_posting_url: "",
  date_started: new Date().toISOString().split("T")[0],
  notes: "",
  stage: "applied",
  status: "active",
  resume_submitted_filename: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
  const [modal, setModal] = useState<EditModalData | null>(null);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then((data) => { setApps(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { toast.error("Failed to load applications."); setLoading(false); });
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

  // ── PATCH helper ──────────────────────────────────────────────────────────
  async function patch(id: string, fields: Partial<JobApplication>) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) { toast.error("Failed to save."); return; }
    const updated: JobApplication = await res.json();
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== id));
    toast.success("Application removed.");
  }

  // ── Inline dropdown change ─────────────────────────────────────────────────
  async function handleDropdownChange(
    id: string,
    field: "stage" | "status",
    value: string
  ) {
    setOpenDropdown(null);
    await patch(id, { [field]: value } as Partial<JobApplication>);
  }

  // ── Open modal (edit or new) ───────────────────────────────────────────────
  function openEdit(app: JobApplication) {
    setModal({
      id: app.id,
      company_name: app.company_name,
      position: app.position,
      job_description: app.job_description ?? "",
      job_posting_url: app.job_posting_url ?? "",
      date_started: app.date_started,
      notes: app.notes ?? "",
      stage: app.stage,
      status: app.status,
      resume_submitted_filename: app.resume_submitted_filename ?? "",
    });
  }

  function openNew() {
    setModal({ ...EMPTY_MODAL });
  }

  // ── Save modal ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!modal) return;
    if (!modal.company_name.trim()) { toast.error("Company name is required."); return; }
    setSaving(true);

    const payload = {
      company_name: modal.company_name,
      position: modal.position,
      job_description: modal.job_description || null,
      job_posting_url: modal.job_posting_url || null,
      date_started: modal.date_started,
      notes: modal.notes || null,
      stage: modal.stage,
      status: modal.status,
    };

    if (modal.id) {
      await patch(modal.id, payload);
    } else {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("Failed to create."); setSaving(false); return; }
      const created: JobApplication = await res.json();
      setApps((prev) => [created, ...prev]);
      toast.success("Application added.");
    }

    setSaving(false);
    setModal(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GlobalInputBar />

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
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
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 pb-10">

        {loading && (
          <div className="flex h-44 items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Loading…</span>
          </div>
        )}

        {!loading && apps.length === 0 && (
          <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 text-center">
            <LayoutList className="h-8 w-8 text-slate-200" />
            <div>
              <p className="text-[13px] font-medium text-slate-400">No applications yet</p>
              <p className="text-[12px] text-slate-300 mt-0.5">
                Click "+ New" above or use "Add to Tracker" from a research page
              </p>
            </div>
          </div>
        )}

        {!loading && apps.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Company", "Position", "Stage", "Status", "Started", "Link", ""].map((h) => (
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
                {apps.map((app) => {
                  const sm = statusMeta(app.status);
                  return (
                    <tr
                      key={app.id}
                      className="group border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {/* Company */}
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap max-w-[160px]">
                        <span className="truncate block">{app.company_name || "—"}</span>
                      </td>

                      {/* Position */}
                      <td className="px-3 py-3 text-slate-600 max-w-[160px]">
                        <span className="truncate block">{app.position || <span className="text-slate-300">—</span>}</span>
                      </td>

                      {/* Stage dropdown */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          onClick={() =>
                            setOpenDropdown(
                              openDropdown?.rowId === app.id && openDropdown.field === "stage"
                                ? null
                                : { rowId: app.id, field: "stage" }
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
                                className={`flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-slate-50 transition-colors ${
                                  app.stage === s.value ? "font-semibold text-indigo-500" : "text-slate-700"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status dropdown */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          onClick={() =>
                            setOpenDropdown(
                              openDropdown?.rowId === app.id && openDropdown.field === "status"
                                ? null
                                : { rowId: app.id, field: "status" }
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
                                className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-slate-50 transition-colors ${
                                  app.status === s.value ? "font-semibold" : ""
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full border ${s.cls}`} />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Date */}
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
                            className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-[12px]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-200 text-[12px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn
                            icon={BookOpen}
                            title="Practice interview"
                            disabled
                            className="text-slate-300 cursor-not-allowed"
                          />
                          <ActionBtn
                            icon={Pencil}
                            title="Edit"
                            onClick={() => openEdit(app)}
                          />
                          <ActionBtn
                            icon={Trash2}
                            title="Delete"
                            onClick={() => handleDelete(app.id)}
                            className="hover:text-red-500 hover:bg-red-50"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / New modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[14px] font-semibold text-slate-900">
                {modal.id ? "Edit application" : "New application"}
              </h2>
              <button onClick={() => setModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company name *">
                  <Input
                    value={modal.company_name}
                    onChange={(v) => setModal((m) => m && ({ ...m, company_name: v }))}
                    placeholder="e.g. Stripe"
                  />
                </Field>
                <Field label="Position">
                  <Input
                    value={modal.position}
                    onChange={(v) => setModal((m) => m && ({ ...m, position: v }))}
                    placeholder="e.g. Senior PM"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Stage">
                  <select
                    value={modal.stage}
                    onChange={(e) => setModal((m) => m && ({ ...m, stage: e.target.value as ApplicationStage }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                  >
                    {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={modal.status}
                    onChange={(e) => setModal((m) => m && ({ ...m, status: e.target.value as ApplicationStatus }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                  >
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date started">
                  <input
                    type="date"
                    value={modal.date_started}
                    onChange={(e) => setModal((m) => m && ({ ...m, date_started: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                  />
                </Field>
                <Field label="Job posting URL">
                  <Input
                    value={modal.job_posting_url}
                    onChange={(v) => setModal((m) => m && ({ ...m, job_posting_url: v }))}
                    placeholder="https://…"
                  />
                </Field>
              </div>

              <Field label="Job description">
                <textarea
                  value={modal.job_description}
                  onChange={(e) => setModal((m) => m && ({ ...m, job_description: e.target.value }))}
                  rows={4}
                  placeholder="Paste the full job description…"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={modal.notes}
                  onChange={(e) => setModal((m) => m && ({ ...m, notes: e.target.value }))}
                  rows={2}
                  placeholder="Recruiter name, referral, interview tips…"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
                />
              </Field>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {modal.id ? "Save changes" : "Add application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, title, onClick, disabled, className = "",
}: {
  icon: React.ElementType;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
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
