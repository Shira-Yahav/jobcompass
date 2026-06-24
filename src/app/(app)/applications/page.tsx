"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  LayoutList, Plus, Trash2, ExternalLink, ChevronDown,
  Loader2, BookOpen, AlertTriangle, FileText, Upload,
  X, Link2, CheckCircle2,
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
  { value: "active",           label: "Active",          cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "pending_company",  label: "Pending Company", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "pending_me",       label: "Pending Me",      cls: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "rejected",         label: "Rejected",        cls: "text-red-700 bg-red-50 border-red-200" },
  { value: "withdrew",         label: "Withdrew",        cls: "text-slate-600 bg-slate-50 border-slate-200" },
  { value: "offer_received",   label: "Offer Received",  cls: "text-purple-700 bg-purple-50 border-purple-200" },
  { value: "accepted",         label: "Accepted",        cls: "text-emerald-800 bg-emerald-100 border-emerald-300" },
];

function stageLabel(v: ApplicationStage) { return STAGES.find((s) => s.value === v)?.label ?? v; }
function statusMeta(v: ApplicationStatus) { return STATUSES.find((s) => s.value === v) ?? STATUSES[0]; }
function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// ─── State types ──────────────────────────────────────────────────────────────

type EditableField = "company_name" | "position" | "date_started";
type CellEdit = { id: string; field: EditableField; value: string } | null;
type DropdownState = { rowId: string; field: "stage" | "status" } | null;
type JdModal = { id: string; value: string } | null;
type ResumeModal = { id: string; filename: string | null; text: string | null } | null;
type LinkEdit = { id: string; value: string } | null;

// ─── New-row draft ────────────────────────────────────────────────────────────

interface NewDraft {
  company_name: string;
  position: string;
  date_started: string;
  stage: ApplicationStage;
  status: ApplicationStatus;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const supabase = createClient();

  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline cell text edit
  const [cellEdit, setCellEdit] = useState<CellEdit>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Inline dropdowns (stage / status)
  const [dropdown, setDropdown] = useState<DropdownState>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Inline link edit
  const [linkEdit, setLinkEdit] = useState<LinkEdit>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // JD modal
  const [jdModal, setJdModal] = useState<JdModal>(null);
  const [jdSaving, setJdSaving] = useState(false);

  // Resume modal
  const [resumeModal, setResumeModal] = useState<ResumeModal>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New row inline
  const [showNewRow, setShowNewRow] = useState(false);
  const [newDraft, setNewDraft] = useState<NewDraft>({
    company_name: "", position: "", date_started: new Date().toISOString().split("T")[0],
    stage: "applied", status: "active",
  });
  const [savingNew, setSavingNew] = useState(false);

  // Profile defaults
  const [defaultPosition, setDefaultPosition] = useState("");

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then((d) => { setApps(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error("Failed to load."); setLoading(false); });

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("desired_position").eq("id", user.id).single();
      if (data?.desired_position) setDefaultPosition(data.desired_position);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-focus cell inputs ─────────────────────────────────────────────────
  useEffect(() => { if (cellEdit) cellInputRef.current?.focus(); }, [cellEdit]);
  useEffect(() => { if (linkEdit) linkInputRef.current?.focus(); }, [linkEdit]);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdown(null);
    }
    if (dropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [dropdown]);

  // ── PATCH helper ──────────────────────────────────────────────────────────
  async function patch(id: string, fields: Partial<JobApplication>) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) { toast.error("Failed to save."); return null; }
    const updated: JobApplication = await res.json();
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }

  // ── Cell text save ─────────────────────────────────────────────────────────
  async function saveCellEdit() {
    if (!cellEdit) return;
    setCellEdit(null);
    await patch(cellEdit.id, { [cellEdit.field]: cellEdit.value } as Partial<JobApplication>);
  }

  // ── Link save / clear ─────────────────────────────────────────────────────
  async function saveLinkEdit() {
    if (!linkEdit) return;
    const val = linkEdit.value.trim();
    setLinkEdit(null);
    await patch(linkEdit.id, { job_posting_url: val || null });
  }

  // ── Dropdown change ───────────────────────────────────────────────────────
  async function handleDropdownChange(id: string, field: "stage" | "status", value: string) {
    setDropdown(null);
    await patch(id, { [field]: value } as Partial<JobApplication>);
  }

  // ── JD save ───────────────────────────────────────────────────────────────
  async function saveJd() {
    if (!jdModal) return;
    setJdSaving(true);
    await patch(jdModal.id, { job_description: jdModal.value || null });
    setJdSaving(false);
    setJdModal(null);
  }

  // ── Resume upload ─────────────────────────────────────────────────────────
  async function handleResumeUpload(id: string, file: File) {
    if (file.type !== "application/pdf") { toast.error("Please upload a PDF."); return; }
    setResumeUploading(true);
    const form = new FormData();
    form.append("resume", file);
    const res = await fetch(`/api/applications/${id}/resume`, { method: "POST", body: form });
    const data = await res.json();
    setResumeUploading(false);
    if (!res.ok) { toast.error(data.error ?? "Upload failed."); return; }
    // Refresh this row
    const row = await fetch(`/api/applications`).then((r) => r.json()) as JobApplication[];
    const updated = row.find((a) => a.id === id);
    if (updated) {
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setResumeModal({ id, filename: updated.resume_submitted_filename, text: updated.resume_submitted_text ?? null });
    }
    toast.success("Resume uploaded.");
  }

  async function handleResumeRemove(id: string) {
    await fetch(`/api/applications/${id}/resume`, { method: "DELETE" });
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, resume_submitted_filename: null, resume_submitted_text: null } : a));
    setResumeModal(null);
    toast.success("Resume removed.");
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
    toast.success("Application removed.");
  }

  // ── New row save ──────────────────────────────────────────────────────────
  async function handleSaveNew() {
    if (!newDraft.company_name.trim()) { toast.error("Company name is required."); return; }
    setSavingNew(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDraft),
    });
    setSavingNew(false);
    if (!res.ok) { toast.error("Failed to create."); return; }
    const created: JobApplication = await res.json();
    setApps((prev) => [created, ...prev]);
    setShowNewRow(false);
    toast.success("Application added.");
  }

  function openNew() {
    setNewDraft({
      company_name: "",
      position: defaultPosition,
      date_started: new Date().toISOString().split("T")[0],
      stage: "applied",
      status: "active",
    });
    setShowNewRow(true);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <LayoutList className="h-4 w-4 text-indigo-500" />
            <h1 className="text-[15px] font-semibold text-slate-900">Applications</h1>
          </div>
          <p className="text-[13px] text-slate-500 pl-6">Track every role from first application to offer.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {/* Table */}
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
              <p className="text-[12px] text-slate-300 mt-0.5">Click "+ New" or use "Add to Tracker" from a research page</p>
            </div>
          </div>
        )}

        {!loading && (apps.length > 0 || showNewRow) && (
          <div ref={dropdownRef}>
            <table className="w-full border-collapse text-[13px] min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Company", "Position", "Stage", "Status", "App Date", "Job Description", "Link", "Resume", "Practice", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* ── New row ───────────────────────────────────────────── */}
                {showNewRow && (
                  <tr className="border-b border-indigo-100 bg-indigo-50/40">
                    {/* Company */}
                    <td className="px-2 py-2">
                      <input
                        autoFocus
                        value={newDraft.company_name}
                        onChange={(e) => setNewDraft((d) => ({ ...d, company_name: e.target.value }))}
                        placeholder="Company *"
                        className="w-full min-w-[120px] rounded border border-indigo-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveNew()}
                      />
                    </td>
                    {/* Position */}
                    <td className="px-2 py-2">
                      <input
                        value={newDraft.position}
                        onChange={(e) => setNewDraft((d) => ({ ...d, position: e.target.value }))}
                        placeholder="Position"
                        className="w-full min-w-[110px] rounded border border-slate-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                      />
                    </td>
                    {/* Stage */}
                    <td className="px-2 py-2">
                      <select
                        value={newDraft.stage}
                        onChange={(e) => setNewDraft((d) => ({ ...d, stage: e.target.value as ApplicationStage }))}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-indigo-300"
                      >
                        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    {/* Status */}
                    <td className="px-2 py-2">
                      <select
                        value={newDraft.status}
                        onChange={(e) => setNewDraft((d) => ({ ...d, status: e.target.value as ApplicationStatus }))}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-indigo-300"
                      >
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    {/* Date */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={newDraft.date_started}
                        onChange={(e) => setNewDraft((d) => ({ ...d, date_started: e.target.value }))}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-indigo-300"
                      />
                    </td>
                    {/* JD / Link / Resume — add after creation */}
                    <td className="px-3 py-2 text-slate-300 text-[11px] italic">after save</td>
                    <td /><td />
                    {/* Practice */}
                    <td />
                    {/* Save / Cancel */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleSaveNew}
                          disabled={savingNew}
                          className="flex items-center gap-1 rounded bg-indigo-500 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors"
                        >
                          {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Add
                        </button>
                        <button
                          onClick={() => setShowNewRow(false)}
                          className="rounded p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Existing rows ─────────────────────────────────────── */}
                {apps.map((app) => {
                  const sm = statusMeta(app.status);
                  const isConfirmDelete = confirmDeleteId === app.id;

                  return (
                    <tr key={app.id} className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors">

                      {/* Company — inline edit */}
                      <td className="px-3 py-2.5 min-w-[130px] max-w-[160px]">
                        {cellEdit?.id === app.id && cellEdit.field === "company_name" ? (
                          <input
                            ref={cellInputRef}
                            value={cellEdit.value}
                            onChange={(e) => setCellEdit((c) => c && { ...c, value: e.target.value })}
                            onBlur={saveCellEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setCellEdit(null); }}
                            className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-[13px] font-medium outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : (
                          <span
                            onClick={() => setCellEdit({ id: app.id, field: "company_name", value: app.company_name })}
                            className="block truncate font-medium text-slate-800 cursor-text rounded px-1 py-0.5 hover:bg-slate-100 transition-colors"
                            title="Click to edit"
                          >
                            {app.company_name || <span className="text-slate-300 font-normal">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Position — inline edit */}
                      <td className="px-3 py-2.5 min-w-[120px] max-w-[150px]">
                        {cellEdit?.id === app.id && cellEdit.field === "position" ? (
                          <input
                            ref={cellInputRef}
                            value={cellEdit.value}
                            onChange={(e) => setCellEdit((c) => c && { ...c, value: e.target.value })}
                            onBlur={saveCellEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setCellEdit(null); }}
                            className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : (
                          <span
                            onClick={() => setCellEdit({ id: app.id, field: "position", value: app.position })}
                            className="block truncate text-slate-600 cursor-text rounded px-1 py-0.5 hover:bg-slate-100 transition-colors"
                            title="Click to edit"
                          >
                            {app.position || <span className="text-slate-300">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Stage dropdown */}
                      <td className="px-3 py-2.5 whitespace-nowrap relative">
                        <button
                          onClick={() => setDropdown(dropdown?.rowId === app.id && dropdown.field === "stage" ? null : { rowId: app.id, field: "stage" })}
                          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:border-slate-300 transition-colors"
                        >
                          {stageLabel(app.stage)}<ChevronDown className="h-3 w-3 text-slate-400" />
                        </button>
                        {dropdown?.rowId === app.id && dropdown.field === "stage" && (
                          <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            {STAGES.map((s) => (
                              <button key={s.value} onClick={() => handleDropdownChange(app.id, "stage", s.value)}
                                className={`flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.stage === s.value ? "font-semibold text-indigo-500" : "text-slate-700"}`}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status dropdown */}
                      <td className="px-3 py-2.5 whitespace-nowrap relative">
                        <button
                          onClick={() => setDropdown(dropdown?.rowId === app.id && dropdown.field === "status" ? null : { rowId: app.id, field: "status" })}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${sm.cls}`}
                        >
                          {sm.label}<ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                        {dropdown?.rowId === app.id && dropdown.field === "status" && (
                          <div className="absolute z-20 mt-1 min-w-[170px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            {STATUSES.map((s) => (
                              <button key={s.value} onClick={() => handleDropdownChange(app.id, "status", s.value)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.status === s.value ? "font-semibold" : ""}`}>
                                <span className={`h-1.5 w-1.5 rounded-full border ${s.cls}`} />{s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* App date — inline edit */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {cellEdit?.id === app.id && cellEdit.field === "date_started" ? (
                          <input
                            ref={cellInputRef}
                            type="date"
                            value={cellEdit.value}
                            onChange={(e) => setCellEdit((c) => c && { ...c, value: e.target.value })}
                            onBlur={saveCellEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setCellEdit(null); }}
                            className="rounded border border-indigo-300 bg-white px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : (
                          <span
                            onClick={() => setCellEdit({ id: app.id, field: "date_started", value: app.date_started })}
                            className="font-mono text-[12px] text-slate-500 cursor-text rounded px-1 py-0.5 hover:bg-slate-100 transition-colors"
                            title="Click to edit"
                          >
                            {formatDate(app.date_started)}
                          </span>
                        )}
                      </td>

                      {/* Job description — click → modal */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setJdModal({ id: app.id, value: app.job_description ?? "" })}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors ${
                            app.job_description
                              ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-500"
                              : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400"
                          }`}
                          title={app.job_description ? "View / edit job description" : "Add job description"}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {app.job_description ? "View" : "Add"}
                        </button>
                      </td>

                      {/* Link — inline add/remove */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {linkEdit?.id === app.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={linkInputRef}
                              value={linkEdit.value}
                              onChange={(e) => setLinkEdit((l) => l && { ...l, value: e.target.value })}
                              onBlur={saveLinkEdit}
                              onKeyDown={(e) => { if (e.key === "Enter") saveLinkEdit(); if (e.key === "Escape") setLinkEdit(null); }}
                              placeholder="https://…"
                              className="w-32 rounded border border-indigo-300 bg-white px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                          </div>
                        ) : app.job_posting_url ? (
                          <div className="flex items-center gap-1">
                            <a href={app.job_posting_url} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-600 transition-colors" title={app.job_posting_url}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => setLinkEdit({ id: app.id, value: app.job_posting_url ?? "" })}
                              className="text-slate-300 hover:text-slate-500 transition-colors" title="Edit link">
                              <Link2 className="h-3 w-3" />
                            </button>
                            <button onClick={() => patch(app.id, { job_posting_url: null })}
                              className="text-slate-300 hover:text-red-400 transition-colors" title="Remove link">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setLinkEdit({ id: app.id, value: "" })}
                            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-indigo-400 transition-colors"
                            title="Add link"
                          >
                            <Plus className="h-3 w-3" /> Link
                          </button>
                        )}
                      </td>

                      {/* Resume — click → view/upload modal */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setResumeModal({ id: app.id, filename: app.resume_submitted_filename, text: app.resume_submitted_text ?? null })}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors ${
                            app.resume_submitted_filename
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                              : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400"
                          }`}
                          title={app.resume_submitted_filename ?? "Upload resume submitted for this role"}
                        >
                          {app.resume_submitted_filename
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> View</>
                            : <><Upload className="h-3.5 w-3.5" /> Upload</>}
                        </button>
                      </td>

                      {/* Practice */}
                      <td className="px-3 py-2.5">
                        <button disabled title="Coming in V1"
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 cursor-not-allowed whitespace-nowrap">
                          <BookOpen className="h-3 w-3" /> Practice
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isConfirmDelete ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 text-[11px] text-red-500">
                              <AlertTriangle className="h-3 w-3" /> Delete?
                            </span>
                            <button onClick={() => handleDelete(app.id)}
                              className="rounded px-2 py-0.5 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
                              Yes
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-0.5 text-[11px] text-slate-500 border border-slate-200 hover:border-slate-300 transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(app.id)}
                            className="rounded p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 transition-colors group-hover:text-slate-400"
                            title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── JD Modal ──────────────────────────────────────────────────────────── */}
      {jdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-2xl max-h-[80vh] rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <h2 className="text-[14px] font-semibold text-slate-900">Job description</h2>
              <button onClick={() => setJdModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={jdModal.value}
              onChange={(e) => setJdModal((m) => m && { ...m, value: e.target.value })}
              placeholder="Paste the full job description…"
              className="flex-1 resize-none px-5 py-4 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed"
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 shrink-0">
              <button onClick={() => setJdModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] text-slate-600 hover:border-slate-300 transition-colors">
                Cancel
              </button>
              <button
                onClick={saveJd}
                disabled={jdSaving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors"
              >
                {jdSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resume Modal ───────────────────────────────────────────────────────── */}
      {resumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-2xl max-h-[80vh] rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">
                  {resumeModal.filename ?? "Resume submitted"}
                </h2>
                {resumeModal.filename && (
                  <p className="text-[12px] text-slate-400 mt-0.5">Uploaded PDF — parsed text shown below</p>
                )}
              </div>
              <button onClick={() => setResumeModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {resumeModal.filename && resumeModal.text ? (
                <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 font-mono">
                  {resumeModal.text}
                </pre>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 text-center">
                  <Upload className="h-6 w-6 text-slate-200" />
                  <p className="text-[13px] text-slate-400">Upload the PDF resume you submitted for this role</p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 shrink-0">
              <div className="flex gap-2">
                {resumeModal.filename && (
                  <button
                    onClick={() => handleResumeRemove(resumeModal.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {resumeUploading && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-400 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  {resumeModal.filename ? "Replace" : "Upload PDF"}
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleResumeUpload(resumeModal.id, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
