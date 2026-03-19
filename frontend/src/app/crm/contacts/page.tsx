"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crm, type Contact } from "@/lib/api";
import { formatRelative, getStatusBadgeClass, debounce } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Loader2,
  X,
  Mail,
  Phone,
  Building2,
} from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["lead", "prospect", "client", "inactive"] as const;
type Status = typeof STATUS_OPTIONS[number];

const emptyForm: Partial<Contact> = {
  name: "",
  email: "",
  phone: "",
  company: "",
  role: "",
  status: "lead",
  notes: "",
  source: "",
  tags: [],
};

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contact>>(emptyForm);

  const debouncedSearch = debounce((v: string) => setSearch(v), 300);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => crm.contacts.list({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Contact>) => crm.contacts.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      handleClose();
      toast.success("Contact created");
    },
    onError: () => toast.error("Failed to create contact"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      crm.contacts.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      handleClose();
      toast.success("Contact updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crm.contacts.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      toast.success("Contact deleted");
    },
  });

  const handleClose = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleEdit = (contact: Contact) => {
    setEditId(contact.id);
    setForm(contact);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const contacts = data?.data ?? [];

  return (
    <AppShell>
      <Header
        title="Contacts"
        subtitle={`${data?.total ?? 0} total`}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
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
              placeholder="Search contacts…"
              onChange={(e) => debouncedSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {/* Contacts */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">No contacts yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Add your first client or lead
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contacts.map((contact, i) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-xl p-4 card-hover group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-stella-100 dark:bg-stella-800 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-stella-700 dark:text-stella-200">
                          {contact.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{contact.name}</p>
                        {contact.company && (
                          <p className="text-xs text-muted-foreground">{contact.company}</p>
                        )}
                      </div>
                    </div>
                    <span className={getStatusBadgeClass(contact.status)}>
                      {contact.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    {contact.role && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span>{contact.role}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(contact.updatedAt)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${contact.name}?`)) {
                            deleteMutation.mutate(contact.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">
                {editId ? "Edit Contact" : "New Contact"}
              </h2>
              <button onClick={handleClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="field col-span-2">
                  <label>Name *</label>
                  <input
                    required
                    value={form.name ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="field col-span-2">
                  <label>Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@company.com"
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 555 0100"
                  />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select
                    value={form.status ?? "lead"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Company</label>
                  <input
                    value={form.company ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Company name"
                  />
                </div>
                <div className="field">
                  <label>Role</label>
                  <input
                    value={form.role ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    placeholder="CEO, Director…"
                  />
                </div>
                <div className="field col-span-2">
                  <label>Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes about this contact…"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  {editId ? "Save changes" : "Create contact"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
