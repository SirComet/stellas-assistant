"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { admin, type ActivityLogEntry } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";
import { Activity, Loader2, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const RESOURCE_TYPES = [
  "blog",
  "case_study",
  "page",
  "contact",
  "project",
  "service",
  "user",
  "deployment",
];

/** Admin: Activity log with pagination, resource filter, and 30-second auto-refresh. */
export default function ActivityPage() {
  const { user: currentUser } = useAuthStore();
  const [page, setPage] = useState(0);
  const [resourceType, setResourceType] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity", page, resourceType],
    queryFn: () =>
      admin.activity.list({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(resourceType ? { resourceType } : {}),
      }),
    staleTime: 30_000,
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => void refetch(), 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (currentUser?.role !== "admin") {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-1">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              You need admin privileges to view this page.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const entries = data?.data ?? [];
  const hasNextPage = entries.length === PAGE_SIZE;

  return (
    <AppShell>
      <Header
        title="Activity Log"
        subtitle="Platform-wide event history • auto-refreshes every 30s"
        actions={
          <select
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(0); }}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">All resource types</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">No activity yet</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Resource</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: ActivityLogEntry, i: number) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.createdAt, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[160px]">
                        {entry.userEmail}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold">{entry.action}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                          {entry.resourceType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
                        {entry.resourceName}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNextPage}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
