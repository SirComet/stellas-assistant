"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { digitalocean, settings, type DoDroplet } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Cloud,
  Loader2,
  Server,
  Globe,
  ExternalLink,
  Save,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

type Tab = "droplets" | "apps" | "domains";

/** DigitalOcean integration page — droplets, apps, domains tabs with API token setup. */
export default function DigitalOceanPage() {
  const [activeTab, setActiveTab] = useState<Tab>("droplets");
  const [token, setToken] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);

  // Check if token is configured via settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settings.get(),
    staleTime: 60_000,
  });

  const hasToken = !!settingsData?.data?.["do_api_token"];

  const { data: dropletsData, isLoading: dropletsLoading, error: dropletsError } = useQuery({
    queryKey: ["do-droplets"],
    queryFn: () => digitalocean.droplets(),
    enabled: hasToken && activeTab === "droplets",
    staleTime: 60_000,
    retry: false,
  });

  const saveTokenMutation = useMutation({
    mutationFn: (t: string) => settings.update({ do_api_token: t }),
    onSuccess: () => {
      toast.success("API token saved");
      setShowTokenForm(false);
      setToken("");
      window.location.reload();
    },
    onError: () => toast.error("Failed to save token"),
  });

  if (settingsLoading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Header
        title="DigitalOcean"
        subtitle="Manage your cloud infrastructure"
        actions={
          <button
            onClick={() => setShowTokenForm(!showTokenForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {hasToken ? "Update Token" : "Setup Token"}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-5">
          {/* Token setup */}
          {(showTokenForm || !hasToken) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 space-y-4"
            >
              {!hasToken && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      DigitalOcean API token required
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Add your Personal Access Token from the DigitalOcean control panel to enable cloud management.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="field flex-1">
                  <label>Personal Access Token</label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="dop_v1_…"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => saveTokenMutation.mutate(token)}
                    disabled={!token.trim() || saveTokenMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50 h-[38px]"
                  >
                    {saveTokenMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                  {showTokenForm && hasToken && (
                    <button
                      onClick={() => setShowTokenForm(false)}
                      className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent h-[38px]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          {hasToken && (
            <>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted w-fit">
                {(["droplets", "apps", "domains"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-all capitalize ${
                      activeTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Droplets tab */}
              {activeTab === "droplets" && (
                <div>
                  {dropletsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : dropletsError ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        Failed to load droplets
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check your API token and permissions
                      </p>
                    </div>
                  ) : (dropletsData?.data ?? []).length === 0 ? (
                    <div className="text-center py-16">
                      <Server className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium">No droplets found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create droplets in your DigitalOcean dashboard
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(dropletsData?.data ?? []).map((droplet: DoDroplet, i: number) => {
                        const publicIp = droplet.networks?.v4?.find((n) => n.type === "public")?.ip_address;
                        return (
                          <motion.div
                            key={droplet.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="bg-card border border-border rounded-xl p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    droplet.status === "active"
                                      ? "bg-emerald-500"
                                      : droplet.status === "off"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                  }`}
                                />
                                <span className="text-sm font-semibold">{droplet.name}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              {droplet.region?.name && (
                                <div className="flex items-center gap-2">
                                  <Globe className="w-3 h-3" />
                                  <span>{droplet.region.name}</span>
                                </div>
                              )}
                              {droplet.size?.slug && (
                                <div className="flex items-center gap-2">
                                  <Server className="w-3 h-3" />
                                  <span>{droplet.size.slug}</span>
                                </div>
                              )}
                              {publicIp && (
                                <div className="flex items-center gap-2">
                                  <Cloud className="w-3 h-3" />
                                  <span className="font-mono">{publicIp}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Apps tab */}
              {activeTab === "apps" && (
                <div className="text-center py-16">
                  <Cloud className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Apps Platform</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    App Platform management coming soon
                  </p>
                  <a
                    href="https://cloud.digitalocean.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open in DigitalOcean <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Domains tab */}
              {activeTab === "domains" && (
                <div className="text-center py-16">
                  <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Domains</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Domain management coming soon
                  </p>
                  <a
                    href="https://cloud.digitalocean.com/networking/domains"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open in DigitalOcean <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
