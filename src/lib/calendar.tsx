import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { isSameDay, isToday, isTomorrow, differenceInCalendarDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  dispatchUserStorageEvent,
  getUserStorageKey,
  isUserStorageEventFor,
  readUserStorage,
  writeUserStorage,
} from '@/lib/user-storage';

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

function deserialize(raw: unknown[]): CalendarEvent[] {
  return raw.map((e) => ({ ...(e as CalendarEvent), date: new Date((e as Record<string, unknown>).date as string) }));
}

function readScopedEvents(userId: string | null | undefined): CalendarEvent[] {
  try {
    const parsed = readUserStorage<unknown[]>(userId, 'calendar-events', []);
    return Array.isArray(parsed) ? deserialize(parsed) : [];
  } catch {
    return [];
  }
}

function writeScopedEvents(userId: string, events: CalendarEvent[]): void {
  writeUserStorage(userId, 'calendar-events', events);
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

/* ── Provider ────────────────────────────────────────────────────── */

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const loadRequestRef = useRef(0);
  const [events, setEventsRaw] = useState<CalendarEvent[]>([]);

  // Reset immediately on identity changes, then load only the new user's data.
  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    setEventsRaw([]);
    if (!userId) return;

    let cancelled = false;
    async function load() {
      const cloud = await readCloud(userId);
      if (cancelled || requestId !== loadRequestRef.current || userIdRef.current !== userId) return;

      if (cloud !== null) {
        setEventsRaw(cloud);
        writeScopedEvents(userId, cloud);
        dispatchUserStorageEvent('notez:calendar-updated', userId);
      } else {
        // A local cache can only belong to this exact authenticated ID.
        setEventsRaw(readScopedEvents(userId));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const storageKey = getUserStorageKey(userId, 'calendar-events');
    const reload = (event?: Event) => {
      if (event?.type === 'storage' && (event as StorageEvent).key !== storageKey) return;
      if (event?.type !== 'storage' && event && !isUserStorageEventFor(event, userId)) return;
      setEventsRaw(readScopedEvents(userId));
    };
    window.addEventListener('notez:calendar-updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('notez:calendar-updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, [userId]);

  // Persist only under the current account's cache key and database row.
  function persist(next: CalendarEvent[]) {
    const uid = userIdRef.current;
    if (!uid) return;
    writeScopedEvents(uid, next);
    dispatchUserStorageEvent('notez:calendar-updated', uid);
    void writeCloud(uid, next);
  }

  function setEvents(updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
    setEventsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!userIdRef.current) return prev;
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
