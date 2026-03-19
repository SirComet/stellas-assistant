"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { content, type SiteService } from "@/lib/api";
import { cn, slugify } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Briefcase,
  Loader2,
  Pencil,
  Trash2,
  X,
  GripVertical,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

const emptyForm: Partial<SiteService> = {
  title: "",
  slug: "",
  description: "",
  features: [],
  price: "",
  duration: "",
  status: "active",
  sortOrder: 0,
};

/** Services management page with inline create/edit form and sort order control. */
export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SiteService>>(emptyForm);
  const [featuresInput, setFeaturesInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: () => content.services.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<SiteService>) => content.services.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      handleClose();
      toast.success("Service created");
    },
    onError: () => toast.error("Failed to create service"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Partial<SiteService> }) =>
      content.services.update(id, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      handleClose();
      toast.success("Service updated");
    },
    onError: () => toast.error("Failed to update service"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => content.services.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service deleted");
    },
    onError: () => toast.error("Failed to delete service"),
  });

  const handleClose = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setFeaturesInput("");
  };

  const handleEdit = (service: SiteService) => {
    setEditId(service.id);
    setForm(service);
    setFeaturesInput((service.features ?? []).join(", "));
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<SiteService> = {
      ...form,
      features: featuresInput
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    };
    if (!payload.slug && payload.title) {
      payload.slug = slugify(payload.title);
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const services = data?.data ?? [];

  return (
    <AppShell>
      <Header
        title="Services"
        subtitle={`${services.length} services`}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Service
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          {/* Inline form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card border border-border rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">
                    {editId ? "Edit Service" : "New Service"}
                  </h2>
                  <button onClick={handleClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="field col-span-2">
                      <label>Title *</label>
                      <input
                        required
                        value={form.title ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                        placeholder="Service title"
                      />
                    </div>
                    <div className="field">
                      <label>Slug</label>
                      <input
                        value={form.slug ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                        placeholder="auto-generated"
                        className="font-mono"
                      />
                    </div>
                    <div className="field">
                      <label>Status</label>
                      <select
                        value={form.status ?? "active"}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SiteService["status"] }))}
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Price</label>
                      <input
                        value={form.price ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="$500 / month"
                      />
                    </div>
                    <div className="field">
                      <label>Duration</label>
                      <input
                        value={form.duration ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                        placeholder="3 months, ongoing…"
                      />
                    </div>
                    <div className="field col-span-2">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        value={form.description ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Describe what this service includes…"
                      />
                    </div>
                    <div className="field col-span-2">
                      <label>Features (comma-separated)</label>
                      <input
                        value={featuresInput}
                        onChange={(e) => setFeaturesInput(e.target.value)}
                        placeholder="Logo design, Brand guidelines, Social kit"
                      />
                    </div>
                    <div className="field">
                      <label>Sort Order</label>
                      <input
                        type="number"
                        value={form.sortOrder ?? 0}
                        onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) }))}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
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
                      <Save className="w-3.5 h-3.5" />
                      {editId ? "Save changes" : "Create service"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Services list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 && !showForm ? (
            <div className="text-center py-16">
              <Briefcase className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No services yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Add your consulting and design services
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
              >
                <Plus className="w-3.5 h-3.5" />
                Add first service
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service: SiteService, i: number) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-muted-foreground cursor-grab mt-0.5 shrink-0" title="Sort order: edit to change">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{service.title}</span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            service.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {service.status}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">#{service.sortOrder}</span>
                      </div>
                      {service.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {service.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {service.price && (
                          <span className="font-medium text-foreground">{service.price}</span>
                        )}
                        {service.duration && <span>{service.duration}</span>}
                        {(service.features ?? []).length > 0 && (
                          <span>{service.features.length} features</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleEdit(service)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${service.title}"?`)) {
                            deleteMutation.mutate(service.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
