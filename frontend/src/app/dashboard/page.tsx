"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { crm, pages } from "@/lib/api";
import { formatRelative, formatCurrency, getStatusBadgeClass } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  FileText,
  Users,
  FolderKanban,
  TrendingUp,
  ArrowRight,
  Activity,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";

const stagger = {
  container: { transition: { staggerChildren: 0.05 } },
  item: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: statsData } = useQuery({
    queryKey: ["crm-stats"],
    queryFn: () => crm.stats(),
  });
  const { data: pagesData } = useQuery({
    queryKey: ["pages"],
    queryFn: () => pages.list({ limit: "5" }),
  });
  const { data: contactsData } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => crm.contacts.list(),
  });

  const stats = statsData?.data;
  const recentPages = pagesData?.data?.slice(0, 5) ?? [];
  const recentContacts = contactsData?.data?.slice(0, 5) ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <Header
        title="Dashboard"
        subtitle={`${greeting}, ${user?.name?.split(" ")[0] ?? "Stella"}`}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-8">
          {/* Stats */}
          <motion.div
            variants={stagger.container}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              {
                label: "Total Pages",
                value: pagesData?.total ?? 0,
                icon: FileText,
                href: "/builder",
                color: "text-blue-500",
                bg: "bg-blue-50 dark:bg-blue-950",
              },
              {
                label: "Contacts",
                value: stats?.contacts.total ?? 0,
                icon: Users,
                href: "/crm/contacts",
                color: "text-violet-500",
                bg: "bg-violet-50 dark:bg-violet-950",
              },
              {
                label: "Active Projects",
                value: stats?.projects.activeCount ?? 0,
                icon: FolderKanban,
                href: "/crm/projects",
                color: "text-emerald-500",
                bg: "bg-emerald-50 dark:bg-emerald-950",
              },
              {
                label: "Pipeline Value",
                value: formatCurrency(stats?.projects.totalBudget ?? 0),
                icon: TrendingUp,
                href: "/crm/projects",
                color: "text-amber-500",
                bg: "bg-amber-50 dark:bg-amber-950",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} variants={stagger.item}>
                  <Link
                    href={stat.href}
                    className="block bg-card border border-border rounded-xl p-5 card-hover group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${stat.bg}`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Contact pipeline */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Contact Pipeline</h2>
                <Link
                  href="/crm/contacts"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(["lead", "prospect", "client", "inactive"] as const).map((status) => {
                  const count = stats.contacts.byStatus[status] ?? 0;
                  const total = stats.contacts.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={status} className="text-center">
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground capitalize mb-1.5">{status}</div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-stella-900 dark:bg-stella-50 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent pages */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Recent Pages</h2>
                <Link
                  href="/builder"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  All pages <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {recentPages.length === 0 ? (
                  <div className="py-8 text-center">
                    <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No pages yet</p>
                    <Link
                      href="/builder/new"
                      className="inline-block mt-2 text-xs font-medium hover:underline"
                    >
                      Create your first page →
                    </Link>
                  </div>
                ) : (
                  recentPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/builder/${page.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{page.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={getStatusBadgeClass(page.status)}>{page.status}</span>
                        <span className="text-xs text-muted-foreground">{formatRelative(page.updatedAt)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </motion.div>

            {/* Recent contacts */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Recent Contacts</h2>
                <Link
                  href="/crm/contacts"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  All contacts <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {recentContacts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No contacts yet</p>
                    <Link
                      href="/crm/contacts"
                      className="inline-block mt-2 text-xs font-medium hover:underline"
                    >
                      Add your first contact →
                    </Link>
                  </div>
                ) : (
                  recentContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-stella-200 dark:bg-stella-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold">
                            {contact.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.company ?? contact.email}
                          </p>
                        </div>
                      </div>
                      <span className={getStatusBadgeClass(contact.status)}>{contact.status}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
