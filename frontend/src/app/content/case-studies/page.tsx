"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { content, type ContentPost } from "@/lib/api";
import { formatRelative, getStatusBadgeClass } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Trophy,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

/** Case studies list page with search, status filter, and delete. */
export default function CaseStudiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["content-posts", "case_study", search, statusFilter],
    queryFn: () =>
      content.posts.list({
        type: "case_study",
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => content.posts.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["content-posts"] });
      toast.success("Case study deleted");
    },
    onError: () => toast.error("Failed to delete case study"),
  });

  const posts = data?.data ?? [];

  return (
    <AppShell>
      <Header
        title="Case Studies"
        subtitle={`${data?.total ?? posts.length} case studies`}
        actions={
          <Link
            href="/content/case-studies/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Case Study
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search case studies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No case studies yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Showcase your client success stories with detailed case studies
              </p>
              <Link
                href="/content/case-studies/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
              >
                <Plus className="w-3.5 h-3.5" />
                Create first case study
              </Link>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tags</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post: ContentPost, i: number) => (
                    <motion.tr
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Trophy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium line-clamp-1">{post.title}</span>
                        </div>
                        {post.excerpt && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 ml-6">
                            {post.excerpt}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {post.client ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadgeClass(post.status)}>{post.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(post.tags ?? []).slice(0, 3).map((tag: string) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatRelative(post.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/content/case-studies/${post.id}`}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${post.title}"?`)) {
                                deleteMutation.mutate(post.id);
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
