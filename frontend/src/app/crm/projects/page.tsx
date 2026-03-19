"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crm, type Project, type Contact, type Milestone } from "@/lib/api";
import { cn, formatDate, formatCurrency, getStatusBadgeClass } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FolderKanban,
  Loader2,
  X,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
} from "lucide-react";
import toast from "react-hot-toast";

const COLUMNS: { status: Project["status"]; label: string }[] = [
  { status: "planning", label: "Planning" },
  { status: "active", label: "Active" },
  { status: "review", label: "Review" },
  { status: "completed", label: "Completed" },
  { status: "paused", label: "Paused" },
];

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

/** CRM Projects kanban with slide-out drawer for project detail and milestones. */
export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [drawerProject, setDrawerProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Project>>(emptyForm);
  const [newMilestone, setNewMilestone] = useState("");

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => crm.projects.list(),
    staleTime: 30_000,
  });

  const { data: contactsData } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => crm.contacts.list(),
    staleTime: 60_000,
  });

  const { data: milestonesData } = useQuery({
    queryKey: ["milestones", drawerProject?.id],
    queryFn: () => crm.milestones.list(drawerProject!.id),
    enabled: !!drawerProject,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<Project>) => crm.projects.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      handleCloseForm();
      toast.success("Project created");
    },
    onError: () => toast.error("Failed to create project"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Partial<Project> }) =>
      crm.projects.update(id, d),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      handleCloseForm();
      if (drawerProject && res.data) setDrawerProject(res.data);
      toast.success("Project updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crm.projects.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      setDrawerProject(null);
      toast.success("Project deleted");
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: ({ projectId, title }: { projectId: string; title: string }) =>
      crm.milestones.create(projectId, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["milestones", drawerProject?.id] });
      setNewMilestone("");
      toast.success("Milestone added");
    },
    onError: () => toast.error("Failed to add milestone"),
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: ({ projectId, milestone }: { projectId: string; milestone: Milestone }) =>
      crm.milestones.update(projectId, milestone.id, {
        status: milestone.status === "done" ? "pending" : "done",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["milestones", drawerProject?.id] });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      crm.milestones.delete(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["milestones", drawerProject?.id] });
      toast.success("Milestone removed");
    },
  });

  const handleCloseForm = () => {
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

  const handleAddMilestone = () => {
    if (!newMilestone.trim() || !drawerProject) return;
    addMilestoneMutation.mutate({ projectId: drawerProject.id, title: newMilestone });
  };

  const projects = projectsData?.data ?? [];
  const contacts = contactsData?.data ?? [];
  const milestones = milestonesData?.data ?? [];

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    return contacts.find((c) => c.id === clientId)?.name ?? null;
  };

  const grouped = COLUMNS.reduce<Record<string, Project[]>>((acc, col) => {
    acc[col.status] = projects.filter((p) => p.status === col.status);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <AppShell>
      <Header
        title="Projects"
        subtitle={`${projects.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5 bg-muted">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  view === "kanban"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("table")}
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  view === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Table"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 && view === "kanban" ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FolderKanban className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No projects yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent mt-3"
              >
                <Plus className="w-3.5 h-3.5" />
                Create first project
              </button>
            </div>
          </div>
        ) : view === "kanban" ? (
          /* Kanban board */
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 p-6 min-w-max h-full">
              {COLUMNS.map((col) => {
                const colProjects = grouped[col.status] ?? [];
                return (
                  <div key={col.status} className="w-64 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className={getStatusBadgeClass(col.status)}>{col.label}</span>
                      <span className="text-xs text-muted-foreground">{colProjects.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto pb-4">
                      {colProjects.length === 0 && (
                        <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                          <p className="text-xs text-muted-foreground">Empty</p>
                        </div>
                      )}
                      {colProjects.map((project, i) => {
                        const clientName = getClientName(project.clientId);
                        return (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setDrawerProject(project)}
                            className="bg-card border border-border rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all"
                          >
                            <h3 className="text-sm font-medium mb-1 line-clamp-2">{project.name}</h3>
                            {clientName && (
                              <p className="text-xs text-muted-foreground mb-2">{clientName}</p>
                            )}
                            <div className="flex items-center justify-between">
                              {project.budget && (
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(project.budget)}
                                </p>
                              )}
                              {project.dueDate && (
                                <p className="text-xs text-muted-foreground ml-auto">
                                  {formatDate(project.dueDate)}
                                </p>
                              )}
                            </div>
                            {(project.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {project.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Table view */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Budget</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, i) => (
                    <motion.tr
                      key={project.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => setDrawerProject(project)}
                    >
                      <td className="px-4 py-3 font-medium">{project.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {getClientName(project.clientId) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadgeClass(project.status)}>{project.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {project.budget ? formatCurrency(project.budget) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {project.dueDate ? formatDate(project.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleEdit(project)}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${project.name}"?`)) deleteMutation.mutate(project.id);
                            }}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Project detail drawer */}
      <AnimatePresence>
        {drawerProject && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerProject(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[420px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div>
                  <h2 className="text-sm font-semibold">{drawerProject.name}</h2>
                  {getClientName(drawerProject.clientId) && (
                    <p className="text-xs text-muted-foreground">
                      {getClientName(drawerProject.clientId)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { handleEdit(drawerProject); setDrawerProject(null); }}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${drawerProject.name}"?`)) deleteMutation.mutate(drawerProject.id);
                    }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDrawerProject(null)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Project info */}
                <div className="space-y-2">
                  <span className={getStatusBadgeClass(drawerProject.status)}>{drawerProject.status}</span>
                  {drawerProject.description && (
                    <p className="text-sm text-muted-foreground">{drawerProject.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {drawerProject.budget && (
                      <div>
                        <span className="text-xs text-muted-foreground">Budget</span>
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(drawerProject.budget)}
                        </p>
                      </div>
                    )}
                    {drawerProject.dueDate && (
                      <div>
                        <span className="text-xs text-muted-foreground">Due date</span>
                        <p className="font-medium">{formatDate(drawerProject.dueDate)}</p>
                      </div>
                    )}
                    {drawerProject.startDate && (
                      <div>
                        <span className="text-xs text-muted-foreground">Start date</span>
                        <p className="font-medium">{formatDate(drawerProject.startDate)}</p>
                      </div>
                    )}
                  </div>
                  {(drawerProject.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {drawerProject.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                {/* Milestones */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Milestones
                  </h3>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Add a milestone…"
                      value={newMilestone}
                      onChange={(e) => setNewMilestone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      onClick={handleAddMilestone}
                      disabled={!newMilestone.trim() || addMilestoneMutation.isPending}
                      className="px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-xs font-medium disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {milestones.map((milestone: Milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center gap-2.5 group py-1"
                      >
                        <button
                          onClick={() =>
                            toggleMilestoneMutation.mutate({
                              projectId: drawerProject.id,
                              milestone,
                            })
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          {milestone.status === "done" ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span
                          className={cn(
                            "text-sm flex-1",
                            milestone.status === "done" && "line-through text-muted-foreground"
                          )}
                        >
                          {milestone.title}
                        </span>
                        {milestone.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(milestone.dueDate)}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            deleteMilestoneMutation.mutate({
                              projectId: drawerProject.id,
                              id: milestone.id,
                            })
                          }
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {milestones.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No milestones yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Project form modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">{editId ? "Edit Project" : "New Project"}</h2>
                <button onClick={handleCloseForm} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="field">
                  <label>Name *</label>
                  <input
                    required
                    value={form.name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Project name"
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    rows={2}
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What is this project about?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={form.status ?? "planning"}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Project["status"] }))}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Client</label>
                    <select
                      value={form.clientId ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value || undefined }))}
                    >
                      <option value="">No client</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Budget</label>
                    <input
                      type="number"
                      value={form.budget ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budget: e.target.value ? parseFloat(e.target.value) : undefined }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="field">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={form.dueDate ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={form.startDate ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {editId ? "Save" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
