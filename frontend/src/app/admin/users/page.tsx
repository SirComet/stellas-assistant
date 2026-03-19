"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin, type AdminUser } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn, formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCog,
  Plus,
  Loader2,
  X,
  Trash2,
  Shield,
  ShieldAlert,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";

const ROLES = ["admin", "editor", "viewer"] as const;
type Role = typeof ROLES[number];

/** Admin: User management — list, invite, change role, toggle active, delete. */
export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "editor" as Role,
  });

  // Show 403 if not admin
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => admin.users.list(),
    staleTime: 30_000,
  });

  const inviteMutation = useMutation({
    mutationFn: (d: typeof inviteForm) => admin.users.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowInvite(false);
      setInviteForm({ email: "", name: "", password: "", role: "editor" });
      toast.success("User invited");
    },
    onError: () => toast.error("Failed to create user"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => admin.users.updateRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      admin.users.toggleActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to update user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => admin.users.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const users = data?.data ?? [];

  const getRoleBadge = (role: string) => {
    if (role === "admin") return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
    if (role === "editor") return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <AppShell>
      <Header
        title="User Management"
        subtitle={`${users.length} users`}
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Invite User
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <UserCog className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">No users found</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: AdminUser, i: number) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-stella-100 dark:bg-stella-800 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold">
                              {user.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.id === currentUser?.id ? (
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", getRoleBadge(user.role))}>
                            {user.role === "admin" && <Shield className="w-3 h-3" />}
                            {user.role === "viewer" && <Eye className="w-3 h-3" />}
                            {user.role}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) =>
                              updateRoleMutation.mutate({ id: user.id, role: e.target.value })
                            }
                            className="text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring/30"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            toggleActiveMutation.mutate({ id: user.id, active: !user.active })
                          }
                          disabled={user.id === currentUser?.id}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                            user.active ? "bg-emerald-500" : "bg-muted"
                          )}
                          title={user.active ? "Deactivate" : "Activate"}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                              user.active ? "translate-x-4" : "translate-x-1"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete user ${user.name}? This cannot be undone.`)) {
                                deleteMutation.mutate(user.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite user modal */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">Invite User</h2>
                <button
                  onClick={() => setShowInvite(false)}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(inviteForm); }}
                className="space-y-4"
              >
                <div className="field">
                  <label>Name *</label>
                  <input
                    required
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="field">
                  <label>Email *</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="field">
                  <label>Password *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={inviteForm.password}
                    onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as Role }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="px-4 py-2 rounded-md border border-border text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium disabled:opacity-50"
                  >
                    {inviteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create User
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
