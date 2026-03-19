"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { AiPanel } from "../ai/AiPanel";
import { useAuthStore, useUiStore } from "@/lib/store";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuthStore();
  const { aiPanelOpen } = useUiStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <motion.main
        animate={{ marginRight: aiPanelOpen ? 380 : 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {children}
      </motion.main>

      <AiPanel />
    </div>
  );
}
