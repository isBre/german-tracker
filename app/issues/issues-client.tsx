"use client";

import { useState } from "react";
import type { Topic } from "@/lib/schema";
import Select from "@/components/select";

type IssueRow = {
  id: number;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  createdAt: string;
  resolvedAt: string | null;
  topicId: number | null;
  topicName: string | null;
  topicColor: string | null;
};

const STATUS_LABELS = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Gelöst",
};

const STATUS_STYLES = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  resolved: "bg-green-50 text-green-700",
};

const PRIORITY_DOTS = {
  low: "bg-slate-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

const PRIORITY_LABELS = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function IssuesClient({
  initialIssues,
  topics,
}: {
  initialIssues: IssueRow[];
  topics: Topic[];
}) {
  const [issues, setIssues] = useState(initialIssues);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTopicId, setNewTopicId] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Edit modal state
  const [editingIssue, setEditingIssue] = useState<IssueRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTopicId, setEditTopicId] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editSaving, setEditSaving] = useState(false);

  const createIssue = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDescription || null,
        topicId: newTopicId ? parseInt(newTopicId) : null,
        priority: newPriority,
        status: "open",
      }),
    });
    const issue = await res.json();
    const topic = topics.find((t) => t.id === issue.topicId);
    setIssues((prev) => [{ ...issue, topicName: topic?.name ?? null, topicColor: topic?.color ?? null }, ...prev]);
    setShowNew(false);
    setNewTitle("");
    setNewDescription("");
    setNewTopicId("");
    setNewPriority("medium");
    setSaving(false);
  };

  const updateStatus = async (id: number, status: "open" | "in_progress" | "resolved") => {
    await fetch(`/api/issues/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status, resolvedAt: status === "resolved" ? new Date().toISOString() : null } : i
      )
    );
  };

  const deleteIssue = async (id: number) => {
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  const openEdit = (issue: IssueRow) => {
    setEditingIssue(issue);
    setEditTitle(issue.title);
    setEditDescription(issue.description ?? "");
    setEditTopicId(issue.topicId ? String(issue.topicId) : "");
    setEditPriority(issue.priority);
  };

  const saveEdit = async () => {
    if (!editingIssue || !editTitle.trim()) return;
    setEditSaving(true);
    await fetch(`/api/issues/${editingIssue.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription || null,
        topicId: editTopicId ? parseInt(editTopicId) : null,
        priority: editPriority,
      }),
    });
    const topic = topics.find((t) => t.id === (editTopicId ? parseInt(editTopicId) : null));
    setIssues((prev) =>
      prev.map((i) =>
        i.id === editingIssue.id
          ? { ...i, title: editTitle.trim(), description: editDescription || null, topicId: editTopicId ? parseInt(editTopicId) : null, topicName: topic?.name ?? null, topicColor: topic?.color ?? null, priority: editPriority }
          : i
      )
    );
    setEditSaving(false);
    setEditingIssue(null);
  };

  const filtered = filterStatus === "all" ? issues : issues.filter((i) => i.status === filterStatus);
  const counts = {
    all: issues.length,
    open: issues.filter((i) => i.status === "open").length,
    in_progress: issues.filter((i) => i.status === "in_progress").length,
    resolved: issues.filter((i) => i.status === "resolved").length,
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Probleme</h1>
          <p className="text-slate-500 mt-1">Schwierigkeiten und Verbesserungsbereiche erfassen.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Neues Problem
        </button>
      </div>

      {/* Create modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Neues Problem</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Titel *</label>
                <input
                  type="text"
                  placeholder="z.B. Probleme mit dem Dativ"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Beschreibung</label>
                <textarea
                  placeholder="Was genau ist das Problem? Kontext…"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Thema</label>
                  <Select value={newTopicId} onChange={(e) => setNewTopicId(e.target.value)}>
                    <option value="">Kein Thema</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Priorität</label>
                  <Select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={createIssue}
                  disabled={saving || !newTitle.trim()}
                  className="flex-1 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  {saving ? "Wird erstellt…" : "Problem erstellen"}
                </button>
                <button
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingIssue && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Problem bearbeiten</h2>
              <button onClick={() => setEditingIssue(null)} className="text-slate-400 hover:text-slate-600">
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Titel *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Beschreibung</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Thema</label>
                  <Select value={editTopicId} onChange={(e) => setEditTopicId(e.target.value)}>
                    <option value="">Kein Thema</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Priorität</label>
                  <Select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high")}
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={editSaving || !editTitle.trim()}
                  className="flex-1 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  {editSaving ? "Wird gespeichert…" : "Speichern"}
                </button>
                <button
                  onClick={() => setEditingIssue(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-lg border border-slate-100 p-1 w-fit">
        {(["all", "open", "in_progress", "resolved"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterStatus === status ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {status === "all" ? "Alle" : STATUS_LABELS[status]}{" "}
            {counts[status] > 0 && (
              <span className={filterStatus === status ? "text-slate-300" : "text-slate-400"}>({counts[status]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Issue list */}
      <div className="bg-white rounded-xl border border-slate-100">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">
              {filterStatus === "all"
                ? "Noch keine Probleme. Oben ein Problem erstellen."
                : `Keine ${STATUS_LABELS[filterStatus as keyof typeof STATUS_LABELS]} Probleme.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((issue) => (
              <div key={issue.id} className="group">
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[issue.priority]}`} title={PRIORITY_LABELS[issue.priority]} />
                    <div className="min-w-0">
                      <p className={`text-sm text-slate-900 ${issue.status === "resolved" ? "line-through text-slate-400" : ""}`}>
                        {issue.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{fmtDate(issue.createdAt)}</span>
                        {issue.topicName && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            {issue.topicName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[issue.status]}`}>
                      {STATUS_LABELS[issue.status]}
                    </span>
                  </div>
                </div>

                {expandedId === issue.id && (
                  <div className="px-6 pb-4 border-t border-slate-50 bg-slate-50/30">
                    {issue.description && (
                      <p className="text-sm text-slate-600 mt-3 mb-4 leading-relaxed">{issue.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-slate-400 mr-1">Verschieben nach:</span>
                      {(["open", "in_progress", "resolved"] as const)
                        .filter((s) => s !== issue.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(issue.id, s)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${STATUS_STYLES[s]} hover:opacity-80`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      <div className="ml-auto flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(issue); }}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteIssue(issue.id)}
                          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
