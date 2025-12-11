"use client";

import { LogOut, User } from "lucide-react";

import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DashboardHeaderProps = {
  email?: string | null;
  signOutAction: () => Promise<void>;
};

export function DashboardHeader({
  email,
  signOutAction,
}: DashboardHeaderProps) {
  const displayEmail = email || "Account";

  return (
    <header className="flex w-full items-center justify-between gap-4 border-b p-4">
      <h1 className="flex items-center">
        <span className="sr-only">abode</span>
        <AbodeLogo className="h-6 w-auto text-foreground" aria-hidden />
      </h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <User className="size-4" />
            <span className="max-w-[180px] truncate">{displayEmail}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="justify-between">
            <span className="truncate">{displayEmail}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem asChild>
              <Button
                type="submit"
                variant="ghost"
                className="h-auto w-full justify-start gap-2 px-2 py-1.5"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
