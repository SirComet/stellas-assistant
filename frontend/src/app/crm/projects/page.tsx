"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crm, type Project } from "@/lib/api";
import { formatDate, formatCurrency, getStatusBadgeClass } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, FolderKanban, Loader2, X, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["planning", "active", "review", "completed", "paused"] as const;

const emptyForm: Partial<Project> = {
  name: "",
  description: "",
  status: "planning",
  budget: undefined,
  startDate: "",
  dueDate: "",
  tags: [],
};

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Project>>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => crm.projects.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<Project>) => crm.projects.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      handleClose();
      toast.success("Project created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      crm.projects.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      handleClose();
      toast.success("Project updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crm.projects.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      toast.success("Project deleted");
    },
  });

  const handleClose = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleEdit = (project: Project) => {
    setEditId(project.id);
    setForm(project);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) updateMutation.mutate({ id: editId, data: form });
    else createMutation.mutate(form);
  };

  const projects = data?.data ?? [];

  const grouped = STATUS_OPTIONS.reduce<Record<string, Project[]>>((acc, status) => {
    acc[status] = projects.filter((p) => p.status === status);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <AppShell>
      <Header
        title="Projects"
        subtitle={`${projects.length} total`}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <FolderKanban className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No projects yet</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-4">
              {STATUS_OPTIONS.map((status) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={getStatusBadgeClass(status)}>{status}</span>
                    <span className="text-xs text-muted-foreground">
                      {grouped[status]?.length ?? 0}
                    </span>
                  </div>
                  {(grouped[status] ?? []).map((project, i) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border rounded-xl p-3 card-hover group"
                    >
                      <h3 className="text-sm font-medium mb-1 line-clamp-2">{project.name}</h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      {project.budget && (
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                          {formatCurrency(project.budget)}
                        </p>
                      )}
                      {project.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(project.dueDate)}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(project)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${project.name}"?`)) deleteMutation.mutate(project.id);
                          }}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">{editId ? "Edit Project" : "New Project"}</h2>
              <button onClick={handleClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="field">
                <label>Name *</label>
                <input required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project name" />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What is this project about?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Status</label>
                  <select value={form.status ?? "planning"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Project["status"] }))}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Budget</label>
                  <input type="number" value={form.budget ?? ""} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="0" />
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="date" value={form.startDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Due Date</label>
                  <input type="date" value={form.dueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={handleClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editId ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
