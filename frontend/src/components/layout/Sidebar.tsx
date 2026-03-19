"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUiStore, useAuthStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  Server,
  GitBranch,
  Settings,
  Sparkles,
  ChevronLeft,
  LogOut,
  FolderKanban,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Pages",
    href: "/builder",
    icon: FileText,
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Users,
    children: [
      { label: "Contacts", href: "/crm/contacts" },
      { label: "Projects", href: "/crm/projects" },
    ],
  },
  {
    label: "Deploy",
    href: "/deploy",
    icon: Server,
  },
  {
    label: "Git",
    href: "/git",
    icon: GitBranch,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, toggleAiPanel } = useUiStore();
  const { user, clearAuth } = useAuthStore();

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col h-screen bg-card border-r border-border shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
        <motion.div
          animate={{ opacity: sidebarCollapsed ? 0 : 1, width: sidebarCollapsed ? 0 : "auto" }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-6 h-6 rounded-md gold-accent flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">Stella's Assistant</span>
          </div>
        </motion.div>
        {sidebarCollapsed && (
          <div className="w-6 h-6 rounded-md gold-accent flex items-center justify-center mx-auto">
            <span className="text-white text-xs font-bold">S</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "nav-item",
                  isActive && "active",
                  sidebarCollapsed && "justify-center px-2"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm">{item.label}</span>
                )}
              </Link>

              {/* Sub-items */}
              {!sidebarCollapsed && item.children && isActive && (
                <div className="ml-7 mt-0.5 space-y-0.5">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        pathname === child.href
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* AI Assistant toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={toggleAiPanel}
          className={cn(
            "nav-item w-full",
            sidebarCollapsed && "justify-center px-2"
          )}
          title={sidebarCollapsed ? "AI Assistant" : undefined}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-stella-gold" />
          {!sidebarCollapsed && (
            <span className="text-sm">AI Assistant</span>
          )}
        </button>
      </div>

      {/* User + collapse */}
      <div className="p-2 border-t border-border space-y-1">
        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-stella-200 dark:bg-stella-700 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-stella-700 dark:text-stella-200">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={clearAuth}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={cn(
            "nav-item w-full",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          <motion.div animate={{ rotate: sidebarCollapsed ? 180 : 0 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
          {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
