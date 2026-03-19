"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pages } from "@/lib/api";
import { formatRelative, getStatusBadgeClass, slugify } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Globe,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function BuilderPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pages", search],
    queryFn: () => pages.list({ search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pages.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Page deleted");
    },
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await pages.create({
        title: newTitle,
        slug: slugify(newTitle),
      });
      if (res.success && res.data) {
        void queryClient.invalidateQueries({ queryKey: ["pages"] });
        setShowNew(false);
        setNewTitle("");
        toast.success("Page created");
      }
    } catch {
      toast.error("Failed to create page");
    } finally {
      setCreating(false);
    }
  };

  const allPages = data?.data ?? [];

  return (
    <AppShell>
      <Header
        title="Pages"
        subtitle={`${data?.total ?? 0} pages`}
        actions={
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Page
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* New page modal */}
          {showNew && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold">Create new page</h3>
              <input
                type="text"
                placeholder="Page title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                autoFocus
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {newTitle && (
                <p className="text-xs text-muted-foreground">
                  Slug: <span className="font-mono">/{slugify(newTitle)}</span>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={creating || !newTitle.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create
                </button>
                <button
                  onClick={() => { setShowNew(false); setNewTitle(""); }}
                  className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* Pages list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : allPages.length === 0 ? (
            <div className="text-center py-16">
              <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No pages yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create your first page and use AI to build it fast
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
              >
                <Plus className="w-3.5 h-3.5" />
                Create first page
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Slug</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {allPages.map((page, i) => (
                    <motion.tr
                      key={page.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{page.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">/{page.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadgeClass(page.status)}>{page.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatRelative(page.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <a
                            href={`/api/pages/${page.id}/export`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                          <Link
                            href={`/builder/${page.id}`}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${page.title}"?`)) {
                                deleteMutation.mutate(page.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete"
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
          )}
        </div>
      </div>
    </AppShell>
  );
}
