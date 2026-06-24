"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  LayoutList, Plus, Trash2, ExternalLink, ChevronDown,
  Loader2, BookOpen, FileText, Upload, X, Link2,
  Paperclip, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { JobApplication, ApplicationStage, ApplicationStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: { value: ApplicationStage; label: string }[] = [
  { value: "applied",        label: "Applied" },
  { value: "intro_call",     label: "Intro Call" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "technical",      label: "Technical" },
  { value: "panel",          label: "Panel" },
  { value: "contract",       label: "Contract" },
  { value: "offer",          label: "Offer" },
];

const STATUSES: { value: ApplicationStatus; label: string; cls: string }[] = [
  { value: "active",          label: "Active",          cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "pending_company", label: "Pending Company", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "pending_me",      label: "Pending Me",      cls: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "rejected",        label: "Rejected",        cls: "text-red-700 bg-red-50 border-red-200" },
  { value: "withdrew",        label: "Withdrew",        cls: "text-slate-600 bg-slate-50 border-slate-200" },
  { value: "offer_received",  label: "Offer Received",  cls: "text-purple-700 bg-purple-50 border-purple-200" },
  { value: "accepted",        label: "Accepted",        cls: "text-emerald-800 bg-emerald-100 border-emerald-300" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function stageLabel(v: ApplicationStage) { return STAGES.find(s => s.value === v)?.label ?? v; }
function statusMeta(v: ApplicationStatus) { return STATUSES.find(s => s.value === v) ?? STATUSES[0]; }
function toIsoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH_SHORT[m-1]} ${d}, '${String(y).slice(2)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableTextField = "company_name" | "position";
type CellEdit = { id: string; field: EditableTextField; value: string } | null;
type DropdownState = { rowId: string; field: "stage" | "status" } | null;
type LinkEditState = { id: string; value: string } | null;

interface NewDraft {
  company_name: string; position: string; date_started: string;
  stage: ApplicationStage; status: ApplicationStatus;
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [y, m, d] = value.split("-").map(Number);
  const [nav, setNav] = useState({ year: y || new Date().getFullYear(), month: (m || new Date().getMonth() + 1) - 1 });

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const firstDow = new Date(nav.year, nav.month, 1).getDay();
  const daysInMonth = new Date(nav.year, nav.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  const isSelected = (day: number) => nav.year === y && nav.month === m - 1 && day === d;
  const isToday = (day: number) => nav.year === today.getFullYear() && nav.month === today.getMonth() && day === today.getDate();

  function prevMonth() { setNav(n => n.month === 0 ? { year: n.year - 1, month: 11 } : { ...n, month: n.month - 1 }); }
  function nextMonth() { setNav(n => n.month === 11 ? { year: n.year + 1, month: 0 } : { ...n, month: n.month + 1 }); }
  function pick(day: number) { onChange(toIsoDate(new Date(nav.year, nav.month, day))); setOpen(false); }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-mono text-slate-500 hover:bg-slate-100 transition-colors group"
      >
        <svg className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
          <rect x="1" y="3" width="14" height="12" rx="2" />
          <path d="M1 7h14M5 1v4M11 1v4" strokeLinecap="round" />
        </svg>
        {formatDate(value)}
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-[228px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[13px] font-semibold text-slate-700">{MONTHS[nav.month]} {nav.year}</span>
            <button onClick={nextMonth} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(dn => (
              <div key={dn} className="text-center text-[10px] font-mono font-semibold text-slate-400 py-1">{dn}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => (
              <div key={i} className="aspect-square flex items-center justify-center">
                {day ? (
                  <button
                    onClick={() => pick(day)}
                    className={`h-7 w-7 rounded-lg text-[12px] transition-colors ${
                      isSelected(day)
                        ? "bg-indigo-500 text-white font-semibold shadow-sm shadow-indigo-200"
                        : isToday(day)
                        ? "border border-indigo-300 text-indigo-600 font-medium hover:bg-indigo-50"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >{day}</button>
                ) : <div />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const supabase = createClient();

  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [cellEdit, setCellEdit] = useState<CellEdit>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  const [dropdown, setDropdown] = useState<DropdownState>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [linkEdit, setLinkEdit] = useState<LinkEditState>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [jdModal, setJdModal] = useState<{ id: string; value: string } | null>(null);
  const [jdSaving, setJdSaving] = useState(false);

  const [pdfModal, setPdfModal] = useState<{ filename: string; url: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [resumeUploading, setResumeUploading] = useState<string | null>(null); // holds app id

  const [deleteModal, setDeleteModal] = useState<{ id: string; company: string } | null>(null);

  const [showNewRow, setShowNewRow] = useState(false);
  const [newDraft, setNewDraft] = useState<NewDraft>({ company_name: "", position: "", date_started: toIsoDate(new Date()), stage: "applied", status: "active" });
  const [savingNew, setSavingNew] = useState(false);
  const newRowRef = useRef<HTMLTableRowElement>(null);

  const [defaultPosition, setDefaultPosition] = useState("");

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/applications")
      .then(r => r.json())
      .then(d => { setApps(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error("Failed to load."); setLoading(false); });

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("desired_position").eq("id", user.id).single();
      if (data?.desired_position) setDefaultPosition(data.desired_position);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (cellEdit) cellInputRef.current?.focus(); }, [cellEdit]);
  useEffect(() => { if (linkEdit) linkInputRef.current?.focus(); }, [linkEdit]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdown(null);
    }
    if (dropdown) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [dropdown]);

  // ── Optimistic patch ───────────────────────────────────────────────────────
  async function patch(id: string, fields: Partial<JobApplication>) {
    const prev = apps.find(a => a.id === id);
    setApps(prev2 => prev2.map(a => a.id === id ? { ...a, ...fields } : a)); // optimistic
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      if (prev) setApps(p => p.map(a => a.id === id ? prev : a)); // rollback
      toast.error("Failed to save.");
    }
  }

  // ── Cell text save ─────────────────────────────────────────────────────────
  async function saveCellEdit() {
    if (!cellEdit) return;
    const { id, field, value } = cellEdit;
    setCellEdit(null);
    await patch(id, { [field]: value } as Partial<JobApplication>);
  }

  // ── Link save ─────────────────────────────────────────────────────────────
  async function saveLinkEdit() {
    if (!linkEdit) return;
    const { id, value } = linkEdit;
    setLinkEdit(null);
    await patch(id, { job_posting_url: value.trim() || null });
  }

  // ── Dropdown change ───────────────────────────────────────────────────────
  async function handleDropdown(id: string, field: "stage" | "status", value: string) {
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
    setResumeUploading(id);
    const form = new FormData();
    form.append("resume", file);
    const res = await fetch(`/api/applications/${id}/resume`, { method: "POST", body: form });
    const data = await res.json();
    setResumeUploading(null);
    if (!res.ok) { toast.error(data.error ?? "Upload failed."); return; }
    // Refresh row with updated fields
    const rows = await fetch("/api/applications").then(r => r.json()) as JobApplication[];
    const updated = rows.find(a => a.id === id);
    if (updated) setApps(prev => prev.map(a => a.id === id ? updated : a));
    toast.success("Resume uploaded.");
  }

  async function handleResumeRemove(id: string) {
    await fetch(`/api/applications/${id}/resume`, { method: "DELETE" });
    setApps(prev => prev.map(a => a.id === id ? { ...a, resume_submitted_filename: null, resume_submitted_text: null, resume_storage_path: null } : a));
    toast.success("Resume removed.");
  }

  async function openPdf(app: JobApplication) {
    if (!app.resume_storage_path) {
      toast.error("PDF file not available. Try re-uploading the resume.");
      return;
    }
    setPdfLoading(true);
    const res = await fetch(`/api/applications/${app.id}/resume-url`);
    setPdfLoading(false);
    if (!res.ok) { toast.error("Could not load PDF."); return; }
    const { url } = await res.json();
    setPdfModal({ filename: app.resume_submitted_filename ?? "Resume", url });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteModal) return;
    await fetch(`/api/applications/${deleteModal.id}`, { method: "DELETE" });
    setApps(prev => prev.filter(a => a.id !== deleteModal.id));
    setDeleteModal(null);
    toast.success("Application removed.");
  }

  // ── New row ───────────────────────────────────────────────────────────────
  function openNew() {
    setNewDraft({ company_name: "", position: defaultPosition, date_started: toIsoDate(new Date()), stage: "applied", status: "active" });
    setShowNewRow(true);
  }

  async function saveNew() {
    if (!newDraft.company_name.trim()) { setShowNewRow(false); return; } // discard if empty

    // Optimistic: show row immediately, POST in background
    const tempId = `__temp_${Date.now()}`;
    const tempRow: JobApplication = {
      id: tempId, user_id: "",
      ...newDraft,
      job_description: null, job_posting_url: null,
      resume_submitted_filename: null, resume_submitted_text: null, resume_storage_path: null,
      notes: null, research_session_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setApps(prev => [tempRow, ...prev]);
    setShowNewRow(false);

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDraft),
    });
    if (!res.ok) {
      setApps(prev => prev.filter(a => a.id !== tempId)); // rollback
      toast.error("Failed to create application.");
      return;
    }
    const created: JobApplication = await res.json();
    setApps(prev => prev.map(a => a.id === tempId ? created : a)); // replace temp
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
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-400 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-10 pt-4">
        {loading && (
          <div className="flex h-44 items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-[13px]">Loading…</span>
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
            <table className="w-full border-collapse text-[13px] min-w-[1080px]">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Company", "Position", "Stage", "Status", "App Date", "Job Description", "Link", "Resume", "Practice", ""].map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono whitespace-nowrap ${i === 0 ? "sticky left-0 z-10 bg-white shadow-[1px_0_0_0_#e2e8f0]" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* New row */}
                {showNewRow && (
                  <tr
                    ref={newRowRef}
                    className="border-b border-indigo-100 bg-indigo-50/30"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node) && !savingNew) {
                        saveNew();
                      }
                    }}
                  >
                    <td className="sticky left-0 z-10 bg-indigo-50/30 px-2 py-2 shadow-[1px_0_0_0_#e2e8f0]">
                      <input autoFocus value={newDraft.company_name}
                        onChange={e => setNewDraft(d => ({ ...d, company_name: e.target.value }))}
                        placeholder="Company *"
                        onKeyDown={e => e.key === "Escape" && setShowNewRow(false)}
                        className="w-full min-w-[110px] rounded border border-indigo-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input value={newDraft.position}
                        onChange={e => setNewDraft(d => ({ ...d, position: e.target.value }))}
                        placeholder="Position"
                        className="w-full min-w-[100px] rounded border border-slate-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select value={newDraft.stage} onChange={e => setNewDraft(d => ({ ...d, stage: e.target.value as ApplicationStage }))}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-indigo-300">
                        {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={newDraft.status} onChange={e => setNewDraft(d => ({ ...d, status: e.target.value as ApplicationStatus }))}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-indigo-300">
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <DatePicker value={newDraft.date_started} onChange={v => setNewDraft(d => ({ ...d, date_started: v }))} />
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-300 italic">after save</td>
                    <td /><td />
                    <td />
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {savingNew && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
                        <button onClick={() => setShowNewRow(false)} className="rounded p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Existing rows */}
                {apps.map(app => {
                  const sm = statusMeta(app.status);
                  return (
                    <tr key={app.id} className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors">

                      {/* Company — sticky */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2.5 min-w-[130px] max-w-[160px] shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50">
                        {cellEdit?.id === app.id && cellEdit.field === "company_name" ? (
                          <input ref={cellInputRef} value={cellEdit.value}
                            onChange={e => setCellEdit(c => c && { ...c, value: e.target.value })}
                            onBlur={saveCellEdit}
                            onKeyDown={e => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setCellEdit(null); }}
                            className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-[13px] font-medium outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : (
                          <span onClick={() => setCellEdit({ id: app.id, field: "company_name", value: app.company_name })}
                            className="block truncate font-medium text-slate-800 cursor-text rounded px-1 py-0.5 hover:bg-slate-100 transition-colors" title="Click to edit">
                            {app.company_name || <span className="font-normal text-slate-300">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Position */}
                      <td className="px-3 py-2.5 min-w-[110px] max-w-[150px]">
                        {cellEdit?.id === app.id && cellEdit.field === "position" ? (
                          <input ref={cellInputRef} value={cellEdit.value}
                            onChange={e => setCellEdit(c => c && { ...c, value: e.target.value })}
                            onBlur={saveCellEdit}
                            onKeyDown={e => { if (e.key === "Enter") saveCellEdit(); if (e.key === "Escape") setCellEdit(null); }}
                            className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : (
                          <span onClick={() => setCellEdit({ id: app.id, field: "position", value: app.position })}
                            className="block truncate text-slate-600 cursor-text rounded px-1 py-0.5 hover:bg-slate-100 transition-colors" title="Click to edit">
                            {app.position || <span className="text-slate-300">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-2.5 whitespace-nowrap relative">
                        <button onClick={() => setDropdown(dropdown?.rowId === app.id && dropdown.field === "stage" ? null : { rowId: app.id, field: "stage" })}
                          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:border-slate-300 transition-colors">
                          {stageLabel(app.stage)}<ChevronDown className="h-3 w-3 text-slate-400" />
                        </button>
                        {dropdown?.rowId === app.id && dropdown.field === "stage" && (
                          <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            {STAGES.map(s => (
                              <button key={s.value} onClick={() => handleDropdown(app.id, "stage", s.value)}
                                className={`flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.stage === s.value ? "font-semibold text-indigo-500" : "text-slate-700"}`}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 whitespace-nowrap relative">
                        <button onClick={() => setDropdown(dropdown?.rowId === app.id && dropdown.field === "status" ? null : { rowId: app.id, field: "status" })}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${sm.cls}`}>
                          {sm.label}<ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                        {dropdown?.rowId === app.id && dropdown.field === "status" && (
                          <div className="absolute z-20 mt-1 min-w-[170px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            {STATUSES.map(s => (
                              <button key={s.value} onClick={() => handleDropdown(app.id, "status", s.value)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-slate-50 ${app.status === s.value ? "font-semibold" : ""}`}>
                                <span className={`h-1.5 w-1.5 rounded-full border ${s.cls}`} />{s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <DatePicker value={app.date_started} onChange={v => patch(app.id, { date_started: v })} />
                      </td>

                      {/* Job Description */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setJdModal({ id: app.id, value: app.job_description ?? "" })}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors ${
                            app.job_description
                              ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-500"
                              : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {app.job_description ? "View / Edit" : "Add"}
                        </button>
                      </td>

                      {/* Link */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {linkEdit?.id === app.id ? (
                          <input ref={linkInputRef} value={linkEdit.value}
                            onChange={e => setLinkEdit(l => l && { ...l, value: e.target.value })}
                            onBlur={saveLinkEdit}
                            onKeyDown={e => { if (e.key === "Enter") saveLinkEdit(); if (e.key === "Escape") setLinkEdit(null); }}
                            placeholder="https://…"
                            className="w-32 rounded border border-indigo-300 bg-white px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-indigo-100"
                          />
                        ) : app.job_posting_url ? (
                          <div className="flex items-center gap-1">
                            <a href={app.job_posting_url} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-600 transition-colors" title={app.job_posting_url}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => setLinkEdit({ id: app.id, value: app.job_posting_url ?? "" })}
                              className="text-slate-300 hover:text-slate-500 transition-colors" title="Edit">
                              <Link2 className="h-3 w-3" />
                            </button>
                            <button onClick={() => patch(app.id, { job_posting_url: null })}
                              className="text-slate-300 hover:text-red-400 transition-colors" title="Remove">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setLinkEdit({ id: app.id, value: "" })}
                            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-indigo-400 transition-colors" title="Add link">
                            <Plus className="h-3 w-3" /> Link
                          </button>
                        )}
                      </td>

                      {/* Resume */}
                      <td className="px-3 py-2.5">
                        {app.resume_submitted_filename ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openPdf(app)}
                              disabled={pdfLoading}
                              className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[12px] text-emerald-700 hover:border-emerald-300 transition-colors disabled:opacity-50"
                              title={app.resume_submitted_filename}
                            >
                              {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                              View
                            </button>
                            <button onClick={() => handleResumeRemove(app.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors" title="Remove resume">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-300 hover:text-indigo-400 transition-colors" title="Attach resume PDF">
                            {resumeUploading === app.id
                              ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                              : <Paperclip className="h-4 w-4" />}
                            <input type="file" accept="application/pdf" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(app.id, f); e.target.value = ""; }}
                            />
                            Attach
                          </label>
                        )}
                      </td>

                      {/* Practice */}
                      <td className="px-3 py-2.5">
                        <button disabled title="Coming in V1"
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 cursor-not-allowed whitespace-nowrap">
                          <BookOpen className="h-3 w-3" /> Practice
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2.5">
                        <button onClick={() => setDeleteModal({ id: app.id, company: app.company_name })}
                          className="rounded p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 transition-colors group-hover:text-slate-400" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
          <div className="flex flex-col w-full max-w-2xl h-[85vh] rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">Job description</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Click anywhere in the text to edit</p>
              </div>
              <button onClick={() => setJdModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={jdModal.value}
              onChange={e => setJdModal(m => m && { ...m, value: e.target.value })}
              placeholder="Paste the full job description here…"
              autoFocus
              className="flex-1 resize-none px-5 py-4 text-[13px] text-slate-800 placeholder:text-slate-300 outline-none leading-relaxed focus:outline-none border-0 cursor-text"
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 shrink-0">
              <button onClick={() => setJdModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] text-slate-600 hover:border-slate-300 transition-colors">Cancel</button>
              <button onClick={saveJd} disabled={jdSaving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors">
                {jdSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Viewer Modal ───────────────────────────────────────────────────── */}
      {pdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="flex flex-col w-full max-w-4xl h-[90vh] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <span className="text-[13px] font-semibold text-slate-800 truncate max-w-[400px]">{pdfModal.filename}</span>
              </div>
              <button onClick={() => setPdfModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe src={pdfModal.url} className="flex-1 w-full border-0" title={pdfModal.filename} />
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900">Delete application?</h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  This will permanently remove the application for <span className="font-medium text-slate-700">{deleteModal.company || "this company"}</span>, including any attached resume and job description. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] text-slate-600 hover:border-slate-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
