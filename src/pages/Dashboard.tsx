import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/lib/timer";

import { useTranslation } from "react-i18next";
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
  MessageCircleHeart,
  Trash2,
  Globe,
  Layers,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import CalendarView from "@/components/dashboard/CalendarView";
import FocusTimerView from "@/components/dashboard/FocusTimerView";
import FloatingTimer from "@/components/dashboard/widgets/FloatingTimer";
import ExamView from "@/components/dashboard/ExamView";
import FlashcardsView from "@/components/dashboard/FlashcardsView";
import ActivitiesView from "@/components/dashboard/ActivitiesView";
import ProgressDashboardView from "@/components/dashboard/ProgressDashboardView";
import FolderView from "@/components/dashboard/FolderView";
import ChatView from "@/components/dashboard/ChatView";
import AccountView from "@/components/dashboard/AccountView";
import FeedbackView from "@/components/dashboard/FeedbackView";
import TrashView from "@/components/dashboard/TrashView";

type View = "dashboard" | "calendar" | "timer" | "exam" | "flashcards" | "activities" | "folder" | "archived" | "chat" | "account" | "feedback" | "trash";
type NavItem = {
  id: View;
  labelKey: string;
  icon: LucideIcon;
  group: "Study" | "Practice" | "Tools" | "Utilities";
};

const NAV: NavItem[] = [
  { id: "dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard, group: "Study" },
  { id: "folder", labelKey: "sidebar.folders", icon: Folder, group: "Study" },
  { id: "exam", labelKey: "sidebar.exam", icon: GraduationCap, group: "Practice" },
  { id: "flashcards", labelKey: "sidebar.flashcards", icon: Layers, group: "Practice" },
  { id: "activities", labelKey: "sidebar.activities", icon: ListChecks, group: "Practice" },
  { id: "chat", labelKey: "sidebar.chat", icon: MessageSquare, group: "Tools" },
  { id: "calendar", labelKey: "sidebar.calendar", icon: Calendar, group: "Tools" },
  { id: "timer", labelKey: "sidebar.pomodoro", icon: Timer, group: "Tools" },
  { id: "feedback", labelKey: "sidebar.feedback", icon: MessageCircleHeart, group: "Utilities" },
];

const GROUPS = ["Study", "Practice", "Tools", "Utilities"] as const;

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { hasActiveSession, hasTaskSession, hasExamSession, selectMinutes, start: startFocusTimer } = useTimer();

  const { t, i18n } = useTranslation();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timerWidgetClosed, setTimerWidgetClosed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('notez_sidebar') !== 'closed');
  const [folderResetKey, setFolderResetKey] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [isInsideEditor, setIsInsideEditor] = useState(false);
  // Track pre-chat sidebar state so we can restore it when leaving chat
  const [preChatSidebarOpen, setPreChatSidebarOpen] = useState<boolean | null>(null);
  const closeSidebarForFolder = useCallback(() => {
    setIsInsideEditor(true);
  }, []);
  const reopenSidebarForFolderList = useCallback(() => {
    setIsInsideEditor(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('notez_sidebar', sidebarOpen ? 'open' : 'closed');
  }, [sidebarOpen]);

  // Listen to open-settings custom event
  useEffect(() => {
    const handleOpenSettings = () => setActiveView("account");
    window.addEventListener("notez:open-settings", handleOpenSettings);
    return () => window.removeEventListener("notez:open-settings", handleOpenSettings);
  }, []);

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

  // Close lang menu on outside click
  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = () => setLangMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [langMenuOpen]);

  const grouped = useMemo(() => {
    const g: Record<string, NavItem[]> = { Study: [], Practice: [], Tools: [], Utilities: [] };
    NAV.forEach((i) => {
      if (g[i.group]) g[i.group].push(i);
    });
    return g;
  }, []);

  const handleNavigate = (view: View) => {
    if (view === "timer") {
      setTimerWidgetClosed(false);
    }
    if (view !== "timer" && anyActiveSession) {
      setTimerWidgetClosed(false);
    }
    if (view === 'folder') {
      setSelectedFolderId(null);
      setFolderResetKey(key => key + 1);
    }
    // Auto-collapse main sidebar & open chat history when entering chat
    if (view === 'chat' && activeView !== 'chat') {
      setPreChatSidebarOpen(sidebarOpen);
      setSidebarOpen(false);
      // Open chat history sidebar after a tick so ChatView is mounted
      setTimeout(() => window.dispatchEvent(new CustomEvent('notez:open-chat-history')), 80);
    }
    // Restore sidebar when leaving chat
    if (view !== 'chat' && activeView === 'chat' && preChatSidebarOpen !== null) {
      setSidebarOpen(preChatSidebarOpen);
      setPreChatSidebarOpen(null);
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
        return <ChatView sidebarOpen={sidebarOpen} onToggleSidebar={() => window.dispatchEvent(new CustomEvent('notez:open-chat-history'))} />;
      case "folder":
        return (
          <FolderView
            key={folderResetKey}
            initialFolderId={selectedFolderId ?? undefined}
            onFolderOpen={closeSidebarForFolder}
            onFolderList={reopenSidebarForFolderList}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        );
      case "archived":
        return (
          <FolderView
            key={folderResetKey}
            initialScope="archived"
            onFolderOpen={closeSidebarForFolder}
            onFolderList={reopenSidebarForFolderList}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
          />
        );
      case "exam":
        return <ExamView />;
      case "flashcards":
        return <FlashcardsView />;
      case "activities":
        return <ActivitiesView />;
      case "calendar":
        return <CalendarView />;
      case "timer":
        return <FocusTimerView />;
      case "feedback":
        return <FeedbackView />;
      case "trash":
        return <TrashView />;
      case "account":
        return <AccountView />;
    }
  };

  const Brand = () => (
    <div className="flex items-center gap-2 select-none">
      <img src="/favicon.svg" alt="NoteZ" className="h-6 w-6 rounded-sm object-cover shrink-0" />
      <div className="flex items-baseline gap-1">
        <span className="font-serif text-[15px] tracking-tight">NoteZ</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          studio
        </span>
      </div>
    </div>
  );

  const groupLabelKey = (group: string) => {
    const map: Record<string, string> = { Main: 'groups.main', Study: 'groups.study', Practice: 'groups.practice', Tools: 'groups.tools', Utilities: 'groups.utilities' };
    return map[group] || group;
  };

  const SideNavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-3.5">
      {GROUPS.map((group) => (
        <div key={group}>
          {group !== "Main" && (
            <div className="px-2 pb-1 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {t(groupLabelKey(group))}
            </div>
          )}
          <div className="space-y-0.5">
            {grouped[group].map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { handleNavigate(item.id); onNavigate?.(); }}
                  className={`w-full flex items-center justify-start gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors ${
                    active ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const CollapsedSideNavList = () => (
    <div className="space-y-2">
      {NAV.map((item) => {
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            title={t(item.labelKey)}
            aria-label={t(item.labelKey)}
            className={`relative w-9 h-9 mx-auto flex items-center justify-center rounded-lg transition-colors ${
              active
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
          </button>
        );
      })}
    </div>
  );

  const MobileNavList = () => (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <div key={group}>
          {group !== "Main" && (
            <div className="px-2 pb-1 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {t(groupLabelKey(group))}
            </div>
          )}
          <div className="space-y-0.5">
            {grouped[group].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  handleNavigate(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-start gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                  activeView === item.id
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-screen w-screen bg-background flex overflow-hidden">
      {/* Floating timer */}
      {floatingTimerVisible && (
        <FloatingTimer onClose={() => setTimerWidgetClosed(true)} />
      )}

      {/* Left sidebar — expanded (w-44) or collapsed icon-only rail (w-14) — hidden in Note Editor */}
      {(!isInsideEditor || activeView !== 'folder') && (
        <aside className={`hidden md:flex h-screen shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-md transition-all duration-200 z-30 ${sidebarOpen ? 'w-44' : 'w-14'}`}>
          {sidebarOpen ? (
            /* Expanded Sidebar */
            <>
              <div className="h-11 flex items-center justify-between border-b border-border px-2.5">
                <Brand />
                <button
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-1.5 border-b border-border">
                <button
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search"
                  className="w-full flex items-center justify-between gap-1 px-2 h-7 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-left text-[11px] text-muted-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Search className="h-3 w-3" />
                    <span>{t('sidebar.search')}</span>
                  </span>
                  <span className="flex items-center gap-0.5">
                    <span className="kbd">⌘</span>
                    <span className="kbd">K</span>
                  </span>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-1.5">
                <SideNavList />
              </nav>

              {/* Language switcher + account footer */}
              <div className="border-t border-border p-1.5 space-y-1">
                {/* Language switcher */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setLangMenuOpen(o => !o); }}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors"
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    <span>{LANGUAGES.find(l => l.code === i18n.language)?.flag || '🌐'} {LANGUAGES.find(l => l.code === i18n.language)?.label || 'English'}</span>
                  </button>
                  {langMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-1 w-full bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          onClick={(e) => { e.stopPropagation(); i18n.changeLanguage(lang.code); setLangMenuOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                            i18n.language === lang.code ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                          }`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Account */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleNavigate("account")}
                    title={t('sidebar.account')}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors min-w-0 ${
                      activeView === "account"
                        ? "bg-secondary text-foreground"
                        : "hover:bg-secondary/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-sm bg-secondary border border-border flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold font-mono text-foreground">
                        {(user?.user_metadata?.full_name || user?.email || "?")
                          .split(/[\s@]/).filter(Boolean).map((s: string) => s[0].toUpperCase()).slice(0, 2).join("")}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono truncate flex-1 text-left">
                      {user?.user_metadata?.full_name || user?.email}
                    </span>
                    <Settings className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                  <Button variant="ghost" size="icon" onClick={signOut} aria-label={t('sidebar.signOut')} className="h-7 w-7 shrink-0">
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Collapsed Icon-Only Navigation Rail */
            <>
              <div className="h-11 flex items-center justify-center border-b border-border">
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </div>

              <div className="p-2 border-b border-border flex justify-center">
                <button
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search"
                  title={t('sidebar.search')}
                  className="h-8 w-8 rounded-lg border border-border bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-3">
                <CollapsedSideNavList />
              </nav>

              <div className="border-t border-border p-2 space-y-2 flex flex-col items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); setLangMenuOpen(o => !o); }}
                  title="Switch Language"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-[12px] hover:bg-secondary transition-colors"
                >
                  {LANGUAGES.find(l => l.code === i18n.language)?.flag || '🌐'}
                </button>

                <button
                  onClick={() => handleNavigate("account")}
                  title={user?.user_metadata?.full_name || user?.email || t('sidebar.account')}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors ${
                    activeView === "account" ? "border-primary bg-primary/10 text-primary font-bold" : "border-border bg-secondary text-foreground"
                  }`}
                >
                  <span className="text-[10px] font-bold font-mono">
                    {(user?.user_metadata?.full_name || user?.email || "?")
                      .split(/[\s@]/).filter(Boolean).map((s: string) => s[0].toUpperCase()).slice(0, 2).join("")}
                  </span>
                </button>

                <button
                  onClick={signOut}
                  title={t('sidebar.signOut')}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Main Content View Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md shrink-0">
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
                  className="w-64 bg-card border-border p-4"
                >
                  <div className="mb-4">
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
                aria-label={t('sidebar.signOut')}
                className="h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>



        {/* Content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden paper-texture min-w-0">
          <div className={activeView === 'folder' ? 'h-full w-full' : 'px-3 md:px-6 py-5 md:py-6 pb-10 max-w-[1400px] mx-auto w-full'}>
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full"
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
              {t('timer.startFocus')}
              <span className="ml-auto text-[11px] font-mono text-muted-foreground">25m</span>
            </CommandItem>
            <CommandItem
              value="do new folder create folder study notes subject workspace"
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

          {GROUPS.map((group, gi) => (
            <div key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={`Go to · ${t(groupLabelKey(group))}`}>
                {grouped[group].map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`go to ${group} ${t(item.labelKey)}`}
                    onSelect={() => {
                      handleNavigate(item.id);
                      setPaletteOpen(false);
                    }}
                  >
                    <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    {t(item.labelKey)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}

          <CommandSeparator />
          <CommandGroup heading={t('sidebar.account')}>
            <CommandItem
              value="account settings profile password"
              onSelect={() => {
                handleNavigate("account");
                setPaletteOpen(false);
              }}
            >
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" /> {t('sidebar.account')}
            </CommandItem>
            <CommandItem
              value="sign out log out"
              onSelect={() => {
                signOut();
                setPaletteOpen(false);
              }}
            >
              <LogOut className="h-4 w-4 mr-2 text-muted-foreground" /> {t('sidebar.signOut')}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
