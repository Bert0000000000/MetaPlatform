import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "@/config/menu";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const STORAGE_KEY = "metaplatform.role";

function getInitialRole(): Role {
  if (typeof window === "undefined") return "business";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (
    stored === "executive" ||
    stored === "business" ||
    stored === "developer" ||
    stored === "architect" ||
    stored === "ops"
  ) {
    return stored;
  }
  return "business";
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(getInitialRole);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, newRole);
    }
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}