"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, ChartNoAxesCombined, LayoutDashboard, ListChecks } from "lucide-react"

import { cn } from "@/lib/utils"

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/indicators", label: "Indicators", icon: ChartNoAxesCombined },
  { href: "/conditions", label: "Conditions", icon: ListChecks },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:flex lg:flex-col">
        <div className="flex h-18 items-center gap-3 border-b px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Macro Monitor</p>
            <p className="text-xs text-muted-foreground">Local market signals</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4 text-xs leading-relaxed text-muted-foreground">
          Local Supabase data<br />No external feeds connected
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Activity className="size-4" />
            </span>
            Macro Monitor
          </Link>
        </div>
        <nav className="grid grid-cols-3 border-t px-2">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
