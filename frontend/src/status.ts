export const PIPELINE = ["received", "washing", "drying", "ironing", "packing", "ready", "completed"] as const;

export const STAGE: Record<string, { label: string; icon: string; tone: "neutral" | "azure" | "brand" | "warning" | "success" }> = {
  received: { label: "Diterima", icon: "tray-arrow-down", tone: "azure" },
  washing: { label: "Cuci", icon: "washing-machine", tone: "brand" },
  drying: { label: "Pengering", icon: "tumble-dryer", tone: "brand" },
  ironing: { label: "Setrika", icon: "iron", tone: "warning" },
  packing: { label: "Lipat & Packing", icon: "package-variant-closed", tone: "warning" },
  ready: { label: "Siap Diambil", icon: "check-circle-outline", tone: "success" },
  completed: { label: "Selesai", icon: "check-decagram", tone: "success" },
  cancelled: { label: "Dibatalkan", icon: "close-circle-outline", tone: "error" as any },
};

export const NEXT_LABEL: Record<string, string> = {
  received: "Mulai Cuci",
  washing: "Ke Pengering",
  drying: "Ke Setrika",
  ironing: "Ke Packing",
  packing: "Tandai Siap",
  ready: "Selesai (Diambil)",
};

export function nextStage(status: string): string | null {
  const i = (PIPELINE as readonly string[]).indexOf(status);
  if (i < 0 || i >= PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}
