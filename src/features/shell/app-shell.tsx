"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ChevronsLeft, ChevronsRight, Keyboard, LogOut, Menu as MenuIcon, Search, Settings, Tags, User, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tooltip } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Logo, LogoMark } from "@/components/shared/logo";
import { DemoInboxButton } from "@/features/demo-inbox/inbox";
import { useNavT } from "@/features/i18n/nav";
import { openOverlay } from "@/features/overlays/store";
import { usePrefs } from "@/features/prefs/store";
import { endSession } from "@/features/session/actions";
import { UserAvatar } from "@/features/session/avatar";
import { useSession } from "@/features/session/store";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { HideValuesToggle } from "./hide-values-toggle";
import { NAV_ITEMS, isActive } from "./nav-items";
import { PullToRefresh } from "./pull-to-refresh";
import { MobileQuickAdd, QuickAddMenu } from "./quick-add";
import { openShortcutsHelp, useGlobalShortcuts } from "./shortcuts";

function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await endSession(qc);
    router.replace("/login");
  };
}

/* ───────────── Desktop / tablet sidebar ───────────── */

function Sidebar({ onSearch }: { onSearch: () => void }) {
  const t = useNavT();
  const pathname = usePathname();
  const collapsedPref = usePrefs((s) => s.sidebarCollapsed);
  const set = usePrefs((s) => s.set);
  const user = useSession((s) => s.user);
  const logout = useLogout();
  const collapsed = collapsedPref;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg px-3 py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-[76px] lg:w-[248px]",
      )}
      aria-label="Navegação principal"
    >
      <div className={cn("flex items-center justify-between px-1.5", collapsed && "justify-center")}>
        <Link href="/home" aria-label="Finax — início" className="rounded-md">
          <span className={cn("hidden", !collapsed && "lg:inline")}>
            <Logo />
          </span>
          <span className={cn(!collapsed && "lg:hidden")}>
            <LogoMark />
          </span>
        </Link>
        {!collapsed && (
          <Tooltip content="Recolher menu">
            <Button variant="ghost" size="icon-xs" className="hidden lg:inline-flex" onClick={() => set({ sidebarCollapsed: true })} aria-label="Recolher menu">
              <ChevronsLeft />
            </Button>
          </Tooltip>
        )}
      </div>

      <div className="mt-6 grid gap-2">
        <QuickAddMenu collapsed={collapsed} />
        <button
          type="button"
          onClick={onSearch}
          className={cn(
            "flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink",
            collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0",
          )}
          aria-label="Abrir comandos (Ctrl K)"
        >
          <Search className="size-4" aria-hidden />
          <span className={cn("flex-1 text-left", collapsed ? "hidden" : "max-lg:hidden")}>Buscar…</span>
          <Kbd className={cn(collapsed ? "hidden" : "max-lg:hidden")}>⌘K</Kbd>
        </button>
      </div>

      <nav className="mt-6 flex-1 overflow-y-auto">
        <ul className="grid gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const label = t(item.key);
            return (
              <li key={item.key}>
                <Tooltip content={label} side="right">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[14px] font-medium transition-colors",
                      active ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                      collapsed ? "justify-center px-0" : "max-lg:justify-center max-lg:px-0",
                    )}
                  >
                    {active && <motion.span layoutId="nav-dot" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand" />}
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    <span className={cn(collapsed ? "sr-only" : "max-lg:sr-only")}>{label}</span>
                  </Link>
                </Tooltip>
                {item.children && active && !collapsed && (
                  <ul className="mb-1 ml-[22px] mt-0.5 hidden gap-0.5 border-l border-line pl-3 lg:grid">
                    {item.children.map((c) => {
                      const childActive = pathname === c.href;
                      return (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            aria-current={childActive ? "page" : undefined}
                            className={cn("flex h-8 items-center rounded-[var(--radius-sm)] px-2 text-[13px]", childActive ? "font-medium text-ink" : "text-ink-3 hover:text-ink")}
                          >
                            {t(c.key)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("flex items-center gap-1 px-0.5 pb-2", collapsed ? "flex-col" : "max-lg:flex-col")}>
        <HideValuesToggle />
        <DemoInboxButton />
        <Tooltip content="Atalhos (?)">
          <Button variant="ghost" size="icon-sm" aria-label="Atalhos de teclado" onClick={openShortcutsHelp}>
            <Keyboard />
          </Button>
        </Tooltip>
        {collapsed && (
          <Tooltip content="Expandir menu">
            <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={() => set({ sidebarCollapsed: false })} aria-label="Expandir menu">
              <ChevronsRight />
            </Button>
          </Tooltip>
        )}
      </div>

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className={cn("flex items-center gap-2.5 rounded-[var(--radius-md)] p-1.5 text-left transition-colors hover:bg-surface-2", collapsed ? "justify-center" : "max-lg:justify-center")}
            aria-label="Menu da conta"
          >
            <UserAvatar size={32} />
            <span className={cn("min-w-0 flex-1", collapsed ? "hidden" : "max-lg:hidden")}>
              <span className="block truncate text-sm font-medium text-ink">{user?.firstName}</span>
              <span className="block truncate text-xs text-ink-3">{user?.email}</span>
            </span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" side="top" className="w-56">
          <MenuItem asChild>
            <Link href="/meu-perfil">
              <User /> {t("profile")}
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/configuracoes">
              <Settings /> {t("settings")}
            </Link>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={logout}>
            <LogOut /> {t("logout")}
          </MenuItem>
        </MenuContent>
      </Menu>
    </aside>
  );
}

/* ───────────── Mobile chrome ───────────── */

function openMoreSheet(t: ReturnType<typeof useNavT>, logout: () => void) {
  openOverlay((close) => (
    <Modal open onOpenChange={(o) => !o && close()} title={t("more")} size="sm">
      <nav className="grid gap-1 pb-2" aria-label="Mais opções">
        {[
          { href: "/contas", label: t("accounts"), icon: Landmark },
          { href: "/categorias", label: t("categories"), icon: Tags },
          { href: "/meu-perfil", label: t("profile"), icon: User },
          { href: "/configuracoes", label: t("settings"), icon: Settings },
        ].map((l) => (
          <Link key={l.href} href={l.href} onClick={close} className="flex h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-base active:bg-surface-2">
            <l.icon className="size-5 text-ink-3" aria-hidden />
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            close();
            logout();
          }}
          className="flex h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-base text-negative active:bg-surface-2"
        >
          <LogOut className="size-5" aria-hidden /> {t("logout")}
        </button>
      </nav>
    </Modal>
  ));
}

function MobileTopBar({ onSearch }: { onSearch: () => void }) {
  const t = useNavT();
  const logout = useLogout();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-3 backdrop-blur-md md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <Link href="/home" aria-label="Finax — início" className="flex items-center gap-2 rounded-md px-1">
        <Logo />
      </Link>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" aria-label="Buscar" onClick={onSearch}>
          <Search />
        </Button>
        <HideValuesToggle size="icon" />
        <DemoInboxButton className="size-10" />
        <Button variant="ghost" size="icon" aria-label={t("more")} onClick={() => openMoreSheet(t, logout)}>
          <MenuIcon />
        </Button>
      </div>
    </header>
  );
}

function BottomTabs() {
  const t = useNavT();
  const pathname = usePathname();
  const tabs = [
    { href: "/home", label: t("home"), icon: NAV_ITEMS[0].icon },
    { href: "/fluxo-de-caixa", label: t("cashflowShort"), icon: NAV_ITEMS[1].icon },
    null,
    { href: "/cartoes-de-credito", label: t("cardsShort"), icon: NAV_ITEMS[3].icon },
    { href: "/relatorios/por-categoria", label: t("reports"), icon: NAV_ITEMS[5].icon, match: ["/relatorios"] },
  ];
  return (
    <nav aria-label="Navegação principal" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md md:hidden">
      <ul className="grid h-16 grid-cols-5 items-center">
        {tabs.map((tab) =>
          tab === null ? (
            <li key="add" className="flex justify-center">
              <MobileQuickAdd />
            </li>
          ) : (
            <li key={tab.href}>
              {(() => {
                const active = isActive(pathname, { href: tab.href, match: tab.match });
                return (
                  <Link href={tab.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-1 text-[11px] font-medium", active ? "text-ink" : "text-ink-3")}>
                    <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
                      <tab.icon className="size-5" aria-hidden />
                    </span>
                    {tab.label}
                  </Link>
                );
              })()}
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

/* ───────────── Shell ───────────── */

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const openPalette = React.useCallback(() => setPaletteOpen(true), []);
  useGlobalShortcuts(openPalette);

  return (
    <div className="flex min-h-dvh">
      <Sidebar onSearch={openPalette} />
      <div className="min-w-0 flex-1">
        <MobileTopBar onSearch={openPalette} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 outline-none sm:px-6 md:pb-12 md:pt-8 lg:px-10 [&_.grid>*]:min-w-0">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      <BottomTabs />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
