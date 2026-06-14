"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadPermissionMatrix } from "@/lib/queries";
import { canWith, DEFAULT_MATRIX, type Capability, type PermissionMatrix } from "@/lib/permissions";
import type { Role } from "@/lib/types";

type Ctx = {
  can: (role: Role | null | undefined, cap: Capability) => boolean;
  reload: () => Promise<void>;
};

// Default to the built-in matrix so gating is correct on first paint (the seed === the
// defaults; an edited matrix swaps in after the load).
const PermissionsContext = createContext<Ctx>({
  can: (role, cap) => canWith(DEFAULT_MATRIX, role, cap),
  reload: async () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(DEFAULT_MATRIX);

  const reload = useCallback(async () => {
    setMatrix(await loadPermissionMatrix());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { reload(); }, [reload]);

  const can = useCallback((role: Role | null | undefined, cap: Capability) => canWith(matrix, role, cap), [matrix]);

  return <PermissionsContext.Provider value={{ can, reload }}>{children}</PermissionsContext.Provider>;
}

/** The matrix-aware `can(role, cap)` — replaces importing `can` from lib/permissions in components. */
export function useCan() {
  return useContext(PermissionsContext).can;
}

/** Re-fetch the matrix (call after editing it so the UI re-gates live). */
export function usePermReload() {
  return useContext(PermissionsContext).reload;
}
