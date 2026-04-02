"use client";

import { useState } from "react";
import type { Topic } from "@/lib/schema";
import Select from "@/components/select";

type ResourceRow = {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  type: "link" | "kurs" | "buch" | "video" | "sonstiges";
  createdAt: string;
  topicId: number | null;
  topicName: string | null;
};

const TYPE_LABELS = {
  link: "Link",
  kurs: "Kurs",
  buch: "Buch",
  video: "Video",
  sonstiges: "Sonstiges",
};

const TYPE_ICONS: Record<string, string> = {
  link: "🔗",
  kurs: "🎓",
  buch: "📚",
  video: "▶️",
  sonstiges: "📌",
};

const TYPE_STYLES: Record<string, string> = {
  link: "bg-blue-50 text-blue-700",
  kurs: "bg-purple-50 text-purple-700",
  buch: "bg-amber-50 text-amber-700",
  video: "bg-red-50 text-red-700",
  sonstiges: "bg-slate-100 text-slate-600",
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

export default function ResourcesClient({
  initialResources,
  topics,
}: {
  initialResources: ResourceRow[];
  topics: Topic[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [filterType, setFilterType] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<ResourceRow["type"]>("link");
  const [newTopicId, setNewTopicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Edit modal state
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<ResourceRow["type"]>("link");
  const [editTopicId, setEditTopicId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const createResource = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const res = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        url: newUrl || null,
        description: newDescription || null,
        type: newType,
        topicId: newTopicId ? parseInt(newTopicId) : null,
      }),
    });
    const resource = await res.json();
    const topic = topics.find((t) => t.id === resource.topicId);
    setResources((prev) => [{ ...resource, topicName: topic?.name ?? null }, ...prev]);
    setShowNew(false);
    setNewTitle("");
    setNewUrl("");
    setNewDescription("");
    setNewType("link");
    setNewTopicId("");
    setSaving(false);
  };

  const deleteResource = async (id: number) => {
    await fetch(`/api/resources/${id}`, { method: "DELETE" });
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const openEdit = (resource: ResourceRow) => {
    setEditingResource(resource);
    setEditTitle(resource.title);
    setEditUrl(resource.url ?? "");
    setEditDescription(resource.description ?? "");
    setEditType(resource.type);
    setEditTopicId(resource.topicId ? String(resource.topicId) : "");
  };

  const saveEdit = async () => {
    if (!editingResource || !editTitle.trim()) return;
    setEditSaving(true);
    await fetch(`/api/resources/${editingResource.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        url: editUrl || null,
        description: editDescription || null,
        type: editType,
        topicId: editTopicId ? parseInt(editTopicId) : null,
      }),
    });
    const topic = topics.find((t) => t.id === (editTopicId ? parseInt(editTopicId) : null));
    setResources((prev) =>
      prev.map((r) =>
        r.id === editingResource.id
          ? { ...r, title: editTitle.trim(), url: editUrl || null, description: editDescription || null, type: editType, topicId: editTopicId ? parseInt(editTopicId) : null, topicName: topic?.name ?? null }
          : r
      )
    );
    setEditSaving(false);
    setEditingResource(null);
  };

  const filtered = filterType === "all" ? resources : resources.filter((r) => r.type === filterType);

  const counts: Record<string, number> = { all: resources.length };
  for (const t of Object.keys(TYPE_LABELS)) {
    counts[t] = resources.filter((r) => r.type === t).length;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ressourcen</h1>
          <p className="text-slate-500 mt-1">Links, Kurse, Bücher und mehr speichern.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Neue Ressource
        </button>
      </div>

      {/* Create modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Neue Ressource</h2>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Titel *</label>
                <input
                  type="text"
                  placeholder="z.B. Deutsche Grammatik A2"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Beschreibung</label>
                <textarea
                  placeholder="Worum geht es?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Typ</label>
                  <Select value={newType} onChange={(e) => setNewType(e.target.value as ResourceRow["type"])}>
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Thema</label>
                  <Select value={newTopicId} onChange={(e) => setNewTopicId(e.target.value)}>
                    <option value="">Kein Thema</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={createResource}
                  disabled={saving || !newTitle.trim()}
                  className="flex-1 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  {saving ? "Wird gespeichert…" : "Ressource speichern"}
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
      {editingResource && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Ressource bearbeiten</h2>
              <button onClick={() => setEditingResource(null)} className="text-slate-400 hover:text-slate-600">
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
                <label className="text-xs text-slate-500 mb-1.5 block">URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Beschreibung</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Typ</label>
                  <Select value={editType} onChange={(e) => setEditType(e.target.value as ResourceRow["type"])}>
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Thema</label>
                  <Select value={editTopicId} onChange={(e) => setEditTopicId(e.target.value)}>
                    <option value="">Kein Thema</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
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
                  onClick={() => setEditingResource(null)}
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
      <div className="flex gap-1 mb-4 bg-white rounded-lg border border-slate-100 p-1 w-fit flex-wrap">
        {(["all", ...Object.keys(TYPE_LABELS)] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterType === type ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {type === "all" ? "Alle" : TYPE_LABELS[type as keyof typeof TYPE_LABELS]}{" "}
            {counts[type] > 0 && (
              <span className={filterType === type ? "text-slate-300" : "text-slate-400"}>({counts[type]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Resource list */}
      <div className="bg-white rounded-xl border border-slate-100">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">
              {filterType === "all"
                ? "Noch keine Ressourcen. Oben eine Ressource hinzufügen."
                : `Keine ${TYPE_LABELS[filterType as keyof typeof TYPE_LABELS]} Ressourcen.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((resource) => (
              <div key={resource.id} className="group">
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === resource.id ? null : resource.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-base shrink-0">{TYPE_ICONS[resource.type]}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 truncate">{resource.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{fmtDate(resource.createdAt)}</span>
                        {resource.topicName && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            {resource.topicName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[resource.type]}`}>
                      {TYPE_LABELS[resource.type]}
                    </span>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                        title="Öffnen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>

                {expandedId === resource.id && (
                  <div className="px-6 pb-4 border-t border-slate-50 bg-slate-50/30">
                    {resource.description && (
                      <p className="text-sm text-slate-600 mt-3 mb-3 leading-relaxed">{resource.description}</p>
                    )}
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline break-all block mb-3 mt-3"
                      >
                        {resource.url}
                      </a>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(resource); }}
                        className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => deleteResource(resource.id)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Löschen
                      </button>
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
