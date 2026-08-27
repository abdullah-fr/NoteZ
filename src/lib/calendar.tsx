import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { isSameDay, isToday, isTomorrow, differenceInCalendarDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export type EventType = 'task' | 'deadline' | 'event';
export type EventPriority = 'low' | 'medium' | 'high';

export interface CalendarEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  subject?: string;
  priority?: EventPriority;
  note?: string;
  link?: string;
  focusDurationMins?: number;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  completed?: boolean;
}

interface CalendarContextType {
  events: CalendarEvent[];
  addEvent: (e: CalendarEvent) => void;
  updateEvent: (id: string, partial: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  toggleEvent: (id: string) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getUpcoming: (days?: number) => CalendarEvent[];
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

/* ── Storage helpers ─────────────────────────────────────────────── */

const LS_KEY = 'notez_calendar_events';

function deserialize(raw: unknown[]): CalendarEvent[] {
  return raw.map((e) => ({ ...(e as CalendarEvent), date: new Date((e as Record<string, unknown>).date as string) }));
}

function readLocal(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return deserialize(parsed);
    }
  } catch {}
  return sampleEvents();
}

function writeLocal(events: CalendarEvent[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(events)); } catch {}
}

async function readCloud(userId: string): Promise<CalendarEvent[] | null> {
  try {
    const { data, error } = await supabase
      .from('notez_calendar_events')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data?.data) return null;
    return deserialize(data.data as unknown[]);
  } catch { return null; }
}

async function writeCloud(userId: string, events: CalendarEvent[]): Promise<void> {
  await supabase
    .from('notez_calendar_events')
    .upsert({ user_id: userId, data: JSON.parse(JSON.stringify(events)) }, { onConflict: 'user_id' });
}

function sampleEvents(): CalendarEvent[] {
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() + 2);
  const d2 = new Date(today); d2.setDate(d2.getDate() + 3);
  const d3 = new Date(today); d3.setDate(d3.getDate() + 5);
  return [
    { id: 'sample-1', date: today, type: 'task',     title: 'Physics — Chapter 4 Revision', subject: 'Physics Notes',    priority: 'high',   focusDurationMins: 60, hour: 7,  minute: 0,  ampm: 'PM', completed: true  },
    { id: 'sample-2', date: today, type: 'deadline', title: 'Math Assignment Problems',      subject: 'Maths Folder',     priority: 'medium', focusDurationMins: 45, hour: 11, minute: 59, ampm: 'PM', completed: false },
    { id: 'sample-3', date: d1,    type: 'deadline', title: 'Physics Midterm Exam',           subject: 'Physics Notes',    priority: 'high',   focusDurationMins: 90, hour: 9,  minute: 0,  ampm: 'AM', completed: false },
    { id: 'sample-4', date: d2,    type: 'task',     title: 'Chemistry Lab Report',           subject: 'Chemistry',        priority: 'medium', focusDurationMins: 60, hour: 2,  minute: 30, ampm: 'PM', completed: false },
    { id: 'sample-5', date: d3,    type: 'event',    title: 'Group Study & Project Sync',     subject: 'Computer Science', priority: 'low',    focusDurationMins: 45, hour: 4,  minute: 0,  ampm: 'PM', link: 'https://meet.google.com/abc-defg-hij', completed: false },
  ];
}

/* ── Provider ────────────────────────────────────────────────────── */

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEventsRaw] = useState<CalendarEvent[]>(readLocal);
  const userIdRef = useRef<string | null>(null);
  const cloudLoadedRef = useRef(false);

  // Get userId once and watch for auth changes
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const newId = session?.user?.id ?? null;
      if (newId !== userIdRef.current) {
        userIdRef.current = newId;
        cloudLoadedRef.current = false; // trigger reload for new user
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load from Supabase when userId is available (cloud always wins)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Poll briefly for userId if not set yet (auth loads async)
      let uid = userIdRef.current;
      if (!uid) {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id ?? null;
        userIdRef.current = uid;
      }
      if (!uid || cloudLoadedRef.current) return;
      cloudLoadedRef.current = true;

      const cloud = await readCloud(uid);
      if (cancelled) return;

      if (cloud !== null) {
        setEventsRaw(cloud);
        writeLocal(cloud);
      } else {
        // No cloud row — migrate local data up (skip sample events)
        const local = readLocal();
        const isOnlySamples = local.every(e => e.id.startsWith('sample-'));
        if (!isOnlySamples) void writeCloud(uid, local);
      }
    }
    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist: write localStorage + Supabase together
  function persist(next: CalendarEvent[]) {
    writeLocal(next);
    if (userIdRef.current) void writeCloud(userIdRef.current, next);
  }

  function setEvents(updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
    setEventsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }

  const addEvent    = useCallback((e: CalendarEvent) => setEvents(prev => [...prev, e]), []);
  const updateEvent = useCallback((id: string, partial: Partial<CalendarEvent>) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...partial } : e)), []);
  const removeEvent = useCallback((id: string) => setEvents(prev => prev.filter(e => e.id !== id)), []);
  const toggleEvent = useCallback((id: string) => setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e)), []);

  const getEventsForDate = useCallback((date: Date) =>
    events.filter(e => isSameDay(e.date instanceof Date ? e.date : new Date(e.date), date)),
  [events]);

  const getUpcoming = useCallback((days = 14) => {
    const now = new Date();
    return events
      .filter(e => {
        if (e.completed) return false;
        const d = e.date instanceof Date ? e.date : new Date(e.date);
        const diff = differenceInCalendarDays(d, now);
        return diff >= 0 && diff <= days;
      })
      .sort((a, b) => {
        const da = differenceInCalendarDays(a.date instanceof Date ? a.date : new Date(a.date), new Date());
        const db = differenceInCalendarDays(b.date instanceof Date ? b.date : new Date(b.date), new Date());
        if (da !== db) return da - db;
        return toMinutes(a) - toMinutes(b);
      });
  }, [events]);

  return (
    <CalendarContext.Provider value={{ events, addEvent, updateEvent, removeEvent, toggleEvent, getEventsForDate, getUpcoming }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}

function toMinutes(e: CalendarEvent): number {
  let h = e.hour % 12;
  if (e.ampm === 'PM') h += 12;
  return h * 60 + e.minute;
}

export function dayLabel(dateInput: Date | string): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff >= 0 && diff <= 6) return format(date, 'EEEE');
  return format(date, 'MMM d');
}
