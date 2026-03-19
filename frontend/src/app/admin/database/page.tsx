"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { admin } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Database, Loader2, ShieldAlert, HardDrive } from "lucide-react";

const TABLE_LABELS: Record<string, string> = {
  users: "Users",
  pages: "Pages",
  contacts: "Contacts",
  projects: "Projects",
  content_posts: "Content Posts",
  site_services: "Services",
  deployments: "Deployments",
  ai_sessions: "AI Sessions",
  media: "Media",
};

/** Admin: Database statistics — row counts per table and DB file size. */
export default function DatabasePage() {
  const { user: currentUser } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-db-stats"],
    queryFn: () => admin.dbStats(),
    staleTime: 60_000,
  });

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

  const counts = data?.data?.counts ?? {};
  const fileSizeBytes = data?.data?.fileSizeBytes ?? 0;
  const fileSizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  return (
    <AppShell>
      <Header
        title="Database"
        subtitle="Row counts and storage stats"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* DB size card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5 flex items-center gap-4"
          >
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950">
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{fileSizeMb} MB</p>
              <p className="text-xs text-muted-foreground">Database file size</p>
            </div>
          </motion.div>

          {/* Row counts */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(TABLE_LABELS).map(([key, label], i) => {
                const count = counts[key] ?? 0;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">rows</p>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Raw table (all keys) */}
          {!isLoading && Object.keys(counts).length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Table</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(counts).map(([key, count]) => (
                    <tr key={key} className="border-b border-border last:border-0 hover:bg-accent/20">
                      <td className="px-4 py-2.5 font-mono text-xs">{key}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-sm">
                        {(count as number).toLocaleString()}
                      </td>
                    </tr>
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
