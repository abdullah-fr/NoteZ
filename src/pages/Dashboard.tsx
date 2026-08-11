import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/lib/timer";
import { useDueCardsCount } from "@/hooks/use-due-cards";
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
  Archive,
  LogOut,
  Menu,
  GraduationCap,
  LayoutDashboard,
  Folder,
  MessageSquare,
  Search,
  Settings,
  Play,
  FolderPlus,
  MessageSquarePlus,
  FileQuestion,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";

import CalendarView from "@/components/dashboard/CalendarView";
import FocusTimerView from "@/components/dashboard/FocusTimerView";
import FloatingTimer from "@/components/dashboard/widgets/FloatingTimer";
import ExamView from "@/components/dashboard/ExamView";
import ProgressDashboardView from "@/components/dashboard/ProgressDashboardView";
import FolderView from "@/components/dashboard/FolderView";
import ChatView from "@/components/dashboard/ChatView";
import AccountView from "@/components/dashboard/AccountView";

type View = "dashboard" | "calendar" | "timer" | "exam" | "folder" | "archived" | "chat" | "account";
type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
  group: "Study" | "Practice" | "Tools";
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Study" },
  { id: "folder", label: "Folders", icon: Folder, group: "Study" },
  { id: "archived", label: "Archived", icon: Archive, group: "Study" },
  { id: "exam", label: "Exam", icon: GraduationCap, group: "Practice" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "Tools" },
  { id: "calendar", label: "Calendar", icon: Calendar, group: "Tools" },
  { id: "timer", label: "Timer", icon: Timer, group: "Tools" },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { hasActiveSession, hasTaskSession, hasExamSession, selectMinutes, start: startFocusTimer } = useTimer();
  const dueCardsCount = useDueCardsCount(user?.id);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timerWidgetClosed, setTimerWidgetClosed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('notez_sidebar') !== 'closed');
  const [folderResetKey, setFolderResetKey] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const closeSidebarForFolder = useCallback(() => setSidebarOpen(false), []);
  const reopenSidebarForFolderList = useCallback(() => setSidebarOpen(true), []);

  useEffect(() => {
    localStorage.setItem('notez_sidebar', sidebarOpen ? 'open' : 'closed');
  }, [sidebarOpen]);

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

  const handleNavigate = (view: View) => {
    // A collapsed workspace rail is a focused folder-reading state. Starting
    // any primary section should restore the full navigation rail.
    setSidebarOpen(true);
    if (view === "timer") {
      setTimerWidgetClosed(false);
    }
    // Re-show widget if any timer is still active when navigating away
    if (view !== "timer" && anyActiveSession) {
      setTimerWidgetClosed(false);
    }
    if (view === 'folder') {
      setSelectedFolderId(null);
      setFolderResetKey(key => key + 1);
    }
    setActiveView(view);
  };

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <ProgressDashboardView
            onNavigate={(view) => {
              const map: Record<string, View> = {
                folders: 'folder',
                exam: 'exam',
                focus: 'timer',
              };
              const target = map[view] as View | undefined;
              if (target) handleNavigate(target);
            }}
          />
        );
      case "chat":
        return <ChatView />;
      case "folder":
        return <FolderView key={folderResetKey} initialFolderId={selectedFolderId ?? undefined} onFolderOpen={closeSidebarForFolder} onFolderList={reopenSidebarForFolderList} />;
      case "archived":
        return <FolderView key={folderResetKey} initialScope="archived" onFolderOpen={closeSidebarForFolder} onFolderList={reopenSidebarForFolderList} />;
      case "exam":
        return <ExamView />;
      case "calendar":
        return <CalendarView />;
      case "timer":
        return <FocusTimerView />;
      case "account":
        return <AccountView />;
    }
  };

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-2 select-none ${compact ? 'justify-center' : ''}`}>
      <img src="/favicon.svg" alt="NoteZ" className="h-7 w-7 rounded-sm object-cover shrink-0" />
      {!compact && <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[16px] tracking-tight">NoteZ</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          studio
        </span>
      </div>}
    </div>
  );

  const SideNavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-4">
      {(["Study", "Practice", "Tools"] as const).map((group) => (
        <div key={group}>
          {sidebarOpen && <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{group}</div>}
          <div className="space-y-0.5">
            {grouped[group].map((item) => {
              const active = activeView === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => { handleNavigate(item.id); onNavigate?.(); }}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`w-full flex items-center ${sidebarOpen ? 'justify-start gap-1.5' : 'justify-center'} px-2.5 py-1.5 rounded-sm text-[13px] transition-colors ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {sidebarOpen && item.id === "exam" && dueCardsCount > 0 && (
                      <span className="flex items-center justify-center rounded-full bg-destructive text-white font-mono font-bold leading-none h-4 min-w-[1rem] px-1 text-[9px]">{dueCardsCount > 99 ? "99+" : dueCardsCount}</span>
                    )}
                  </button>
                </div>
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
                className={`w-full flex items-center justify-start gap-1.5 px-2.5 py-2 rounded-sm text-[13px] transition-colors ${activeView === item.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Floating timer — persists across views */}
      {floatingTimerVisible && (
        <FloatingTimer onClose={() => setTimerWidgetClosed(true)} />
      )}

      {/* Left sidebar */}
      <aside className={`hidden md:flex sticky top-0 h-screen flex-col border-r border-border bg-background/85 backdrop-blur-md transition-[width] duration-200 ${sidebarOpen ? 'w-44' : 'w-20'}`}>
        <div className={`h-11 flex items-center border-b border-border ${sidebarOpen ? 'justify-between px-3' : 'justify-center gap-1 px-1.5'}`}>
          <Brand compact={!sidebarOpen} />
          <button onClick={() => setSidebarOpen(open => !open)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'} title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'} className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground">
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        <div className={`p-2 border-b border-border ${sidebarOpen ? '' : 'flex justify-center'}`}>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            title={!sidebarOpen ? 'Search' : undefined}
            className={`${sidebarOpen ? 'w-full' : 'w-8'} flex items-center justify-center ${sidebarOpen ? 'gap-2 px-2.5' : 'px-0'} h-8 rounded-sm border border-border bg-secondary/60 hover:bg-secondary text-left text-[12px] text-muted-foreground transition-colors`}
          >
            <Search className="h-3.5 w-3.5" />
            {sidebarOpen && <span>Search…</span>}
            {sidebarOpen && <span className="ml-auto flex items-center gap-0.5">
              <span className="kbd">⌘</span>
              <span className="kbd">K</span>
            </span>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <SideNavList />
        </nav>

        <div className={`border-t border-border p-2 flex items-center ${sidebarOpen ? 'gap-2' : 'justify-center'}`}>
          <button
            onClick={() => handleNavigate("account")}
            title={!sidebarOpen ? 'Account settings' : undefined}
            className={`${sidebarOpen ? 'flex-1' : 'w-8'} flex items-center ${sidebarOpen ? 'gap-2 px-2' : 'justify-center px-0'} py-1.5 rounded-sm transition-colors min-w-0 ${activeView === "account"
                ? "bg-secondary text-foreground"
                : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
          >
            <div className="w-5 h-5 rounded-sm bg-secondary border border-border flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold font-mono text-foreground">
                {(user?.user_metadata?.full_name || user?.email || "?")
                  .split(/[\s@]/).filter(Boolean).map((s: string) => s[0].toUpperCase()).slice(0, 2).join("")}
              </span>
            </div>
            {sidebarOpen && <span className="text-[11px] font-mono truncate flex-1 text-left">
              {user?.user_metadata?.full_name || user?.email}
            </span>}
            {sidebarOpen && <Settings className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          </button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className={`${sidebarOpen ? '' : 'hidden'} h-8 w-8 shrink-0`}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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

        {/* Content */}
        <main className="flex-1 overflow-auto overflow-x-hidden paper-texture min-w-0">
          <div className={activeView === 'folder' ? 'h-full w-full' : 'px-3 md:px-6 py-5 md:py-6 pb-10 max-w-[1400px] mx-auto w-full'}>
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
        <CommandInput placeholder="Go to a page or run an action…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>

          {/* ── Do — quick actions ── */}
          <CommandGroup heading="Do">
            <CommandItem
              value="do start focus timer 25 minutes pomodoro deep work"
              onSelect={() => {
                selectMinutes(25);
                setTimeout(() => startFocusTimer(), 50);
                handleNavigate("timer");
                setPaletteOpen(false);
              }}
            >
              <Play className="h-4 w-4 mr-2 text-muted-foreground" />
              Start Focus Timer
              <span className="ml-auto text-[11px] font-mono text-muted-foreground">25m</span>
            </CommandItem>
            <CommandItem
              value="do new folder create folder study notes subject"
              onSelect={() => {
                handleNavigate("folder");
                setTimeout(() => window.dispatchEvent(new CustomEvent("notez:new-folder")), 80);
                setPaletteOpen(false);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2 text-muted-foreground" />
              New Folder
            </CommandItem>
            <CommandItem
              value="do new chat tutor ai assistant conversation ask"
              onSelect={() => {
                handleNavigate("chat");
                setTimeout(() => window.dispatchEvent(new CustomEvent("notez:new-chat-tutor")), 80);
                setPaletteOpen(false);
              }}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2 text-muted-foreground" />
              New Chat with Tutor
            </CommandItem>
            <CommandItem
              value="do generate ai exam quiz practice test subject"
              onSelect={() => {
                handleNavigate("exam");
                setTimeout(() => window.dispatchEvent(new CustomEvent("notez:focus-exam-input")), 80);
                setPaletteOpen(false);
              }}
            >
              <FileQuestion className="h-4 w-4 mr-2 text-muted-foreground" />
              Generate AI Exam
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* ── Go to — navigation ── */}
          {(["Study", "Practice", "Tools"] as const).map((group, gi) => (
            <div key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={`Go to · ${group}`}>
                {grouped[group].map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`go to ${group} ${item.label}`}
                    onSelect={() => {
                      handleNavigate(item.id);
                      setPaletteOpen(false);
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}

          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem
              value="account settings profile password"
              onSelect={() => {
                handleNavigate("account");
                setPaletteOpen(false);
              }}
            >
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" /> Account Settings
            </CommandItem>
            <CommandItem
              value="sign out log out"
              onSelect={() => {
                signOut();
                setPaletteOpen(false);
              }}
            >
              <LogOut className="h-4 w-4 mr-2 text-muted-foreground" /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
