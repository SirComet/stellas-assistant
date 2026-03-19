"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { git, type GitConfig } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  GitBranch,
  Plus,
  X,
  Loader2,
  GitCommit,
  RefreshCw,
  Send,
  Github,
  Folder,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";

export default function GitPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showCommit, setShowCommit] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [repoForm, setRepoForm] = useState({ token: "", name: "", description: "", isPrivate: false });

  const [form, setForm] = useState({
    name: "",
    repoUrl: "",
    branch: "main",
    token: "",
    localPath: "",
    autoPush: false,
  });

  const { data: configsData } = useQuery({
    queryKey: ["git-configs"],
    queryFn: () => git.configs.list(),
  });

  const { data: statusData } = useQuery({
    queryKey: ["git-status", selectedConfigId],
    queryFn: () => git.configs.status(selectedConfigId!),
    enabled: !!selectedConfigId,
  });

  const { data: commitsData } = useQuery({
    queryKey: ["git-commits", selectedConfigId],
    queryFn: () => git.configs.commits(selectedConfigId!),
    enabled: !!selectedConfigId,
  });

  const createConfigMutation = useMutation({
    mutationFn: () => git.configs.create(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["git-configs"] });
      setShowForm(false);
      toast.success("Git config added");
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      git.configs.commit(id, { message, push: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["git-status", selectedConfigId] });
      void queryClient.invalidateQueries({ queryKey: ["git-commits", selectedConfigId] });
      setShowCommit(null);
      setCommitMsg("");
      toast.success("Committed and pushed!");
    },
    onError: () => toast.error("Commit failed"),
  });

  const createRepoMutation = useMutation({
    mutationFn: () => git.github.createRepo(repoForm),
    onSuccess: (res) => {
      if (res.success && res.data) {
        toast.success("GitHub repo created!");
        setShowCreateRepo(false);
        // Auto-fill the form
        setForm((f) => ({ ...f, repoUrl: res.data.cloneUrl }));
        setShowForm(true);
      }
    },
    onError: () => toast.error("Failed to create repo"),
  });

  const configs = configsData?.data ?? [];
  const status = statusData?.data;
  const commits = commitsData?.data ?? [];

  const hasChanges = status && (
    status.modified.length > 0 ||
    status.added.length > 0 ||
    status.deleted.length > 0 ||
    status.untracked.length > 0
  );

  return (
    <AppShell>
      <Header
        title="Git"
        subtitle="Repository management"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateRepo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
            >
              <Github className="w-3.5 h-3.5" />
              New Repo
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Config
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Configs list */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Repositories</h2>
              {configs.length === 0 ? (
                <div className="text-center py-8 bg-card border border-border rounded-xl">
                  <GitBranch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No repos configured</p>
                </div>
              ) : (
                configs.map((config) => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfigId(config.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedConfigId === config.id
                        ? "border-foreground/20 bg-accent"
                        : "border-border bg-card hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{config.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {config.branch}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Status + commits */}
            <div className="lg:col-span-2 space-y-4">
              {selectedConfigId && status ? (
                <>
                  {/* Status */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold font-mono">{status.branch}</span>
                        {status.ahead > 0 && (
                          <span className="text-xs text-emerald-600">↑{status.ahead}</span>
                        )}
                        {status.behind > 0 && (
                          <span className="text-xs text-red-500">↓{status.behind}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {hasChanges && (
                          <button
                            onClick={() => setShowCommit(selectedConfigId)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-xs font-medium"
                          >
                            <Send className="w-3 h-3" />
                            Commit & Push
                          </button>
                        )}
                        <button
                          onClick={() => void queryClient.invalidateQueries({ queryKey: ["git-status", selectedConfigId] })}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {hasChanges ? (
                      <div className="space-y-1">
                        {status.modified.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs">
                            <span className="text-amber-500 font-mono w-4">M</span>
                            <span className="font-mono text-muted-foreground">{f}</span>
                          </div>
                        ))}
                        {status.added.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-500 font-mono w-4">A</span>
                            <span className="font-mono text-muted-foreground">{f}</span>
                          </div>
                        ))}
                        {status.deleted.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs">
                            <span className="text-red-500 font-mono w-4">D</span>
                            <span className="font-mono text-muted-foreground">{f}</span>
                          </div>
                        ))}
                        {status.untracked.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs">
                            <span className="text-stella-400 font-mono w-4">?</span>
                            <span className="font-mono text-muted-foreground">{f}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Working tree clean</p>
                    )}

                    {/* Commit dialog */}
                    {showCommit === selectedConfigId && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <input
                          type="text"
                          value={commitMsg}
                          onChange={(e) => setCommitMsg(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitMutation.mutate({ id: selectedConfigId, message: commitMsg })}
                          placeholder="Commit message…"
                          autoFocus
                          className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => commitMutation.mutate({ id: selectedConfigId, message: commitMsg })}
                            disabled={!commitMsg.trim() || commitMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-xs disabled:opacity-50"
                          >
                            {commitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Push
                          </button>
                          <button onClick={() => setShowCommit(null)} className="px-3 py-1.5 rounded border border-border text-xs hover:bg-accent">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Commits */}
                  {commits.length > 0 && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold">Recent Commits</h3>
                      </div>
                      {commits.map((commit) => (
                        <div key={commit.hash} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
                          <GitCommit className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{commit.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {commit.author} · {formatRelative(commit.date)}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {commit.hash}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-48 bg-card border border-border rounded-xl">
                  <p className="text-sm text-muted-foreground">Select a repository to view status</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Config Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Add Git Config</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createConfigMutation.mutate(); }} className="space-y-3">
              <div className="field">
                <label>Name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Website" />
              </div>
              <div className="field">
                <label>Repository URL *</label>
                <input required value={form.repoUrl} onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))} placeholder="https://github.com/user/repo.git" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Branch</label>
                  <input value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Local Path *</label>
                  <input required value={form.localPath} onChange={(e) => setForm((f) => ({ ...f, localPath: e.target.value }))} placeholder="/app/sites/my-site" />
                </div>
              </div>
              <div className="field">
                <label>GitHub Token (for push)</label>
                <input type="password" value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} placeholder="ghp_…" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.autoPush} onChange={(e) => setForm((f) => ({ ...f, autoPush: e.target.checked }))} className="rounded" />
                Auto-push on save
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent">Cancel</button>
                <button type="submit" disabled={createConfigMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50">
                  {createConfigMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add Config
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create GitHub Repo Modal */}
      {showCreateRepo && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Create GitHub Repository</h2>
              <button onClick={() => setShowCreateRepo(false)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createRepoMutation.mutate(); }} className="space-y-3">
              <div className="field">
                <label>GitHub Token *</label>
                <input required type="password" value={repoForm.token} onChange={(e) => setRepoForm((f) => ({ ...f, token: e.target.value }))} placeholder="ghp_…" />
              </div>
              <div className="field">
                <label>Repository Name *</label>
                <input required value={repoForm.name} onChange={(e) => setRepoForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-website" />
              </div>
              <div className="field">
                <label>Description</label>
                <input value={repoForm.description} onChange={(e) => setRepoForm((f) => ({ ...f, description: e.target.value }))} placeholder="Website for Stella Jimenez" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={repoForm.isPrivate} onChange={(e) => setRepoForm((f) => ({ ...f, isPrivate: e.target.checked }))} />
                Private repository
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateRepo(false)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent">Cancel</button>
                <button type="submit" disabled={createRepoMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50">
                  {createRepoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Repo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
