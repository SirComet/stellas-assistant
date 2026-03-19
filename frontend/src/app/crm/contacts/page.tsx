"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crm, type Contact, type Activity } from "@/lib/api";
import { cn, formatRelative, getStatusBadgeClass, getInitials, debounce } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Users,
  Loader2,
  X,
  Mail,
  Phone,
  Building2,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  MessageSquare,
  PhoneCall,
  CalendarDays,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

const COLUMNS: { status: Contact["status"]; label: string; color: string }[] = [
  { status: "lead", label: "Leads", color: "text-blue-600 dark:text-blue-400" },
  { status: "prospect", label: "Prospects", color: "text-amber-600 dark:text-amber-400" },
  { status: "client", label: "Clients", color: "text-emerald-600 dark:text-emerald-400" },
  { status: "inactive", label: "Inactive", color: "text-muted-foreground" },
];

const STATUS_OPTIONS = ["lead", "prospect", "client", "inactive"] as const;

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

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  note: <FileText className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
  call: <PhoneCall className="w-3 h-3" />,
  meeting: <CalendarDays className="w-3 h-3" />,
  status_change: <MessageSquare className="w-3 h-3" />,
};

/** CRM Contacts page with kanban and table views, slide-out detail drawer. */
export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contact>>(emptyForm);
  const [newActivity, setNewActivity] = useState("");
  const [activityType, setActivityType] = useState("note");

  const debouncedSearch = debounce((v: string) => setSearch(v), 300);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => crm.contacts.list({ search: search || undefined }),
    staleTime: 30_000,
  });

  const { data: activitiesData } = useQuery({
    queryKey: ["contact-activities", drawerContact?.id],
    queryFn: () => crm.activities.list(drawerContact!.id),
    enabled: !!drawerContact,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (d: Partial<Contact>) => crm.contacts.create(d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      handleCloseForm();
      toast.success("Contact created");
    },
    onError: () => toast.error("Failed to create contact"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Partial<Contact> }) =>
      crm.contacts.update(id, d),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      handleCloseForm();
      if (drawerContact && res.data) {
        setDrawerContact(res.data);
      }
      toast.success("Contact updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crm.contacts.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      setDrawerContact(null);
      toast.success("Contact deleted");
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: ({ contactId, data: d }: { contactId: string; data: { type: string; title: string } }) =>
      crm.activities.create(contactId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-activities", drawerContact?.id] });
      setNewActivity("");
      toast.success("Activity logged");
    },
    onError: () => toast.error("Failed to log activity"),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: ({ contactId, id }: { contactId: string; id: string }) =>
      crm.activities.delete(contactId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-activities", drawerContact?.id] });
      toast.success("Activity removed");
    },
  });

  const handleCloseForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const handleOpenEdit = (contact: Contact) => {
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

  const handleAddActivity = () => {
    if (!newActivity.trim() || !drawerContact) return;
    addActivityMutation.mutate({
      contactId: drawerContact.id,
      data: { type: activityType, title: newActivity },
    });
  };

  const contacts = data?.data ?? [];
  const grouped = COLUMNS.reduce<Record<string, Contact[]>>((acc, col) => {
    acc[col.status] = contacts.filter((c) => c.status === col.status);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <AppShell>
      <Header
        title="Contacts"
        subtitle={`${data?.total ?? 0} total`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5 bg-muted">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  view === "kanban"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("table")}
                className={cn(
                  "p-1.5 rounded text-xs transition-all",
                  view === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Table"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-sm font-medium hover:opacity-90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Contact
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search bar */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contacts…"
              onChange={(e) => debouncedSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : view === "kanban" ? (
          /* Kanban board */
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 p-6 min-w-max h-full">
              {COLUMNS.map((col) => {
                const colContacts = grouped[col.status] ?? [];
                return (
                  <div key={col.status} className="w-72 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold uppercase tracking-wide", col.color)}>
                        {col.label}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {colContacts.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto pb-4">
                      {colContacts.length === 0 && (
                        <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                          <p className="text-xs text-muted-foreground">No {col.label.toLowerCase()}</p>
                        </div>
                      )}
                      {colContacts.map((contact, i) => (
                        <motion.div
                          key={contact.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setDrawerContact(contact)}
                          className="bg-card border border-border rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all group"
                        >
                          <div className="flex items-start gap-2.5 mb-2">
                            <div className="w-8 h-8 rounded-full bg-stella-100 dark:bg-stella-800 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-stella-700 dark:text-stella-200">
                                {getInitials(contact.name)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{contact.name}</p>
                              {contact.company && (
                                <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-2">{contact.email}</p>
                          {(contact.tags ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Table view */
          <div className="flex-1 overflow-y-auto p-6">
            {contacts.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No contacts yet</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Updated</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact, i) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => setDrawerContact(contact)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-stella-100 dark:bg-stella-800 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold">{getInitials(contact.name)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">{contact.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{contact.company ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadgeClass(contact.status)}>{contact.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatRelative(contact.updatedAt)}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleOpenEdit(contact)}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${contact.name}?`)) deleteMutation.mutate(contact.id);
                              }}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
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
        )}
      </div>

      {/* Slide-out drawer */}
      <AnimatePresence>
        {drawerContact && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerContact(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stella-100 dark:bg-stella-800 flex items-center justify-center">
                    <span className="text-sm font-semibold text-stella-700 dark:text-stella-200">
                      {getInitials(drawerContact.name)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{drawerContact.name}</h2>
                    {drawerContact.company && (
                      <p className="text-xs text-muted-foreground">{drawerContact.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { handleOpenEdit(drawerContact); setDrawerContact(null); }}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${drawerContact.name}?`)) deleteMutation.mutate(drawerContact.id);
                    }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDrawerContact(null)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Contact details */}
                <div className="space-y-2">
                  <span className={getStatusBadgeClass(drawerContact.status)}>{drawerContact.status}</span>

                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <a href={`mailto:${drawerContact.email}`} className="hover:underline truncate">
                      {drawerContact.email}
                    </a>
                  </div>
                  {drawerContact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{drawerContact.phone}</span>
                    </div>
                  )}
                  {drawerContact.role && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{drawerContact.role}</span>
                    </div>
                  )}
                  {(drawerContact.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {drawerContact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {drawerContact.notes && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 mt-2">
                      {drawerContact.notes}
                    </p>
                  )}
                </div>

                <div className="section-divider" />

                {/* Activity timeline */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Activity Timeline
                  </h3>

                  {/* Add activity */}
                  <div className="flex gap-2 mb-4">
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="note">Note</option>
                      <option value="email">Email</option>
                      <option value="call">Call</option>
                      <option value="meeting">Meeting</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Log an activity…"
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddActivity()}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      onClick={handleAddActivity}
                      disabled={!newActivity.trim() || addActivityMutation.isPending}
                      className="px-3 py-1.5 rounded-md bg-stella-900 dark:bg-stella-50 text-stella-50 dark:text-stella-900 text-xs font-medium disabled:opacity-50"
                    >
                      Log
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activitiesData?.data ?? []).map((activity: Activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-2.5 group"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                          {ACTIVITY_ICONS[activity.type] ?? <MessageSquare className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelative(activity.occurredAt)}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            deleteActivityMutation.mutate({
                              contactId: drawerContact.id,
                              id: activity.id,
                            })
                          }
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {(activitiesData?.data ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No activities logged yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contact form modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">
                  {editId ? "Edit Contact" : "New Contact"}
                </h2>
                <button onClick={handleCloseForm} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
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
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Contact["status"] }))}
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
                    onClick={handleCloseForm}
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
      </AnimatePresence>
    </AppShell>
  );
}
