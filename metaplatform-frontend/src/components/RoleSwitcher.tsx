import { ChevronDown, User } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { ROLES, type Role } from "@/config/menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RoleSwitcher() {
  const { role, setRole } = useRole();
  const current = ROLES.find((r) => r.id === role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="hidden md:inline">
            {current?.label}
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>切换角色</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLES.map((r) => (
          <DropdownMenuItem
            key={r.id}
            onClick={() => setRole(r.id as Role)}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {r.label}
                {role === r.id && <span className="ml-2 text-xs text-primary">✓</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}