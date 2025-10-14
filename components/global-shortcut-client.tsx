"use client"

import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

export function GlobalShortcutClient() {
  // Este componente simplemente activa el hook de atajos globales.
  useGlobalShortcuts();
  return null; // No renderiza nada en la pantalla.
}