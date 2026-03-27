"use client";

import { useState } from "react";
import type { Topic } from "@/lib/schema";

export default function TopicsClient({ initialTopics }: { initialTopics: Topic[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const addTopic = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const topic = await res.json();
    setTopics((prev) => [topic, ...prev]);
    setNewName("");
    setSaving(false);
  };

  const startEdit = (topic: Topic) => {
    setEditingId(topic.id);
    setEditName(topic.name);
  };

  const saveEdit = async (id: number) => {
    await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setTopics((prev) => prev.map((t) => t.id === id ? { ...t, name: editName } : t));
    setEditingId(null);
  };

  const deleteTopic = async (id: number) => {
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Themen</h1>
        <p className="text-slate-500 mt-1">Lernbereiche verwalten. Themen können Einheiten und Problemen zugeordnet werden.</p>
      </div>

      {/* Add topic */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Neues Thema</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="z.B. Grammatik, Vokabeln, Hören…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            onClick={addTopic}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Topic list */}
      <div className="bg-white rounded-xl border border-slate-100">
        {topics.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">Noch keine Themen. Oben ein Thema hinzufügen.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {topics.map((topic) => (
              <div key={topic.id} className="px-6 py-4 flex items-center justify-between group">
                {editingId === topic.id ? (
                  <div className="flex items-center gap-3 flex-1 mr-4">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(topic.id)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 flex-1"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(topic.id)} className="text-xs text-slate-900 font-medium hover:underline">Speichern</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:underline">Abbrechen</button>
                  </div>
                ) : (
                  <span className="text-sm text-slate-900">{topic.name}</span>
                )}
                {editingId !== topic.id && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(topic)}
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => deleteTopic(topic.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                      title="Löschen"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
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
