"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { CalendarIcon, ListIcon, TodayIcon, UserIcon } from "@/components/ui/icons";

const tabs: { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/today", label: "Today", icon: TodayIcon },
  { href: "/tasks", label: "Tasks", icon: ListIcon },
  { href: "/week", label: "Week", icon: CalendarIcon },
  { href: "/me", label: "Me", icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Laptop: sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
        <Link href="/today" className="mb-8 px-3 font-serif text-[22px] leading-none">
          Daily Planner
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sheet font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto truncate px-3 text-xs text-faint">{userName}</p>
      </aside>

      {/* Phone and tablet: bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 pb-1.5 pt-2.5 text-[11px] ${
                  active ? "font-semibold text-ink" : "text-faint"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
