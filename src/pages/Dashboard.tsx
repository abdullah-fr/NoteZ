import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/lib/timer";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Calendar,
  Timer,
  LogOut,
  Menu,
  GraduationCap,
  LayoutDashboard,
  Folder,
  MessageSquare,
  Search,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

import CalendarView from "@/components/dashboard/CalendarView";
import FocusTimerView from "@/components/dashboard/FocusTimerView";
import FloatingTimer from "@/components/dashboard/FloatingTimer";
import ExamView from "@/components/dashboard/ExamView";
import ProgressDashboardView from "@/components/dashboard/ProgressDashboardView";
import FolderView from "@/components/dashboard/FolderView";
import ChatView from "@/components/dashboard/ChatView";

type View = "dashboard" | "calendar" | "timer" | "exam" | "folder" | "chat";
type NavItem = {
  id: View;
  label: string;
  icon: any;
  group: "Study" | "Practice" | "Tools";
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Study" },
  { id: "folder", label: "Folders", icon: Folder, group: "Study" },
  { id: "exam", label: "Exam", icon: GraduationCap, group: "Practice" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "Tools" },
  { id: "calendar", label: "Calendar", icon: Calendar, group: "Tools" },
  { id: "timer", label: "Timer", icon: Timer, group: "Tools" },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { hasActiveSession, hasTaskSession, hasExamSession } = useTimer();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timerWidgetClosed, setTimerWidgetClosed] = useState(false);

  // Show the floating timer whenever any timer is active and we're off the Timer page.
  const anyActiveSession = hasActiveSession || hasTaskSession || hasExamSession;
  const floatingTimerVisible =
    activeView !== "timer" && anyActiveSession && !timerWidgetClosed;

  // Cmd+K palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, NavItem[]> = { Study: [], Practice: [], Tools: [] };
    NAV.forEach((i) => g[i.group].push(i));
    return g;
  }, []);

  const activeItem = NAV.find((n) => n.id === activeView)!;

  const handleNavigate = (view: View) => {
    if (view === "timer") {
      setTimerWidgetClosed(false);
    }
    // Re-show widget if any timer is still active when navigating away
    if (view !== "timer" && anyActiveSession) {
      setTimerWidgetClosed(false);
    }
    setActiveView(view);
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <ProgressDashboardView />;
      case "chat":
        return <ChatView />;
      case "folder":
        return <FolderView />;
      case "exam":
        return <ExamView />;
      case "calendar":
        return <CalendarView />;
      case "timer":
        return <FocusTimerView />;
    }
  };

  const Brand = () => (
    <div className="flex items-center gap-2 select-none">
      <div className="w-7 h-7 rounded-sm border border-border flex items-center justify-center bg-secondary">
        <span className="font-serif text-[15px] leading-none text-foreground">
          N
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[16px] tracking-tight">NoteZ</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          studio
        </span>
      </div>
    </div>
  );

  const SideNavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-5">
      {(["Study", "Practice", "Tools"] as const).map((group) => (
        <div key={group}>
          {!sidebarCollapsed && (
            <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {group}
            </div>
          )}
          <div className="space-y-0.5">
            {grouped[group].map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigate(item.id);
                    onNavigate?.();
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] transition-colors ${
                    sidebarCollapsed ? "justify-center" : ""
                  } ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const MobileNavList = () => (
    <div className="space-y-5">
      {(["Study", "Practice", "Tools"] as const).map((group) => (
        <div key={group}>
          <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {group}
          </div>
          <div className="space-y-0.5">
            {grouped[group].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  handleNavigate(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] transition-colors ${
                  activeView === item.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Floating timer — persists across views */}
      {floatingTimerVisible && (
        <FloatingTimer onClose={() => setTimerWidgetClosed(true)} />
      )}

      {/* Left sidebar */}
      <aside
        className={`hidden md:flex sticky top-0 h-screen flex-col border-r border-border bg-background/85 backdrop-blur-md transition-[width] duration-200 ${
          sidebarCollapsed ? "w-14" : "w-60"
        }`}
      >
        <div
          className={`h-11 flex items-center border-b border-border ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-3"}`}
        >
          {!sidebarCollapsed && <Brand />}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="p-2 border-b border-border">
          {sidebarCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 mx-auto"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          ) : (
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 h-8 px-2.5 rounded-sm border border-border bg-secondary/60 hover:bg-secondary text-left text-[12px] text-muted-foreground transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search…</span>
              <span className="ml-auto flex items-center gap-0.5">
                <span className="kbd">⌘</span>
                <span className="kbd">K</span>
              </span>
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <SideNavList />
        </nav>

        <div
          className={`border-t border-border p-2 ${sidebarCollapsed ? "flex justify-center" : "flex items-center gap-2"}`}
        >
          {!sidebarCollapsed && (
            <span className="text-[11px] text-muted-foreground font-mono truncate flex-1">
              {user?.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Sign out"
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex items-center justify-between h-11 px-3">
            <div className="flex items-center gap-2">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 bg-card border-border p-4"
                >
                  <div className="mb-5">
                    <Brand />
                  </div>
                  <MobileNavList />
                </SheetContent>
              </Sheet>
              <Brand />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                aria-label="Sign out"
                className="h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Desktop breadcrumb */}
        <div className="hidden md:flex items-center h-9 px-5 border-b border-border bg-background/60">
          <nav className="flex items-center gap-1 text-[12px] text-muted-foreground font-mono">
            <span>workspace</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground">
              {activeItem?.label.toLowerCase()}
            </span>
          </nav>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="px-3 md:px-6 py-5 md:py-6 pb-10 max-w-[1400px] mx-auto w-full">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Command palette */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a section, run a command…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {(["Study", "Practice", "Tools"] as const).map((group, gi) => (
            <div key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {grouped[group].map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${group} ${item.label}`}
                    onSelect={() => {
                      handleNavigate(item.id);
                      setPaletteOpen(false);
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem
              onSelect={() => {
                signOut();
                setPaletteOpen(false);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
