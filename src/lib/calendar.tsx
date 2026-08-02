import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isSameDay, isToday, isTomorrow, differenceInCalendarDays, format } from 'date-fns';

export type EventType = 'task' | 'deadline' | 'event';

export interface CalendarEvent {
  id: string;
  date: Date;
  type: EventType;
  title: string;
  note?: string;
  link?: string;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  completed?: boolean;
}

interface CalendarContextType {
  events: CalendarEvent[];
  addEvent: (e: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  toggleEvent: (id: string) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getUpcoming: (days?: number) => CalendarEvent[];
}

const STORAGE_KEY = 'notez_calendar_events';

function loadInitialEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          ...e,
          date: new Date(e.date),
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load calendar events from storage', err);
  }

  // Default sample events if none exist
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    {
      id: 'sample-1',
      date: today,
      type: 'task',
      title: 'Review Chapter 4 Algorithms',
      hour: 3,
      minute: 0,
      ampm: 'PM',
      completed: false,
    },
    {
      id: 'sample-2',
      date: tomorrow,
      type: 'deadline',
      title: 'Linear Algebra Problem Set Due',
      hour: 11,
      minute: 59,
      ampm: 'PM',
      completed: false,
    },
  ];
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>(loadInitialEvents);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
      console.error('Failed to save calendar events', err);
    }
  }, [events]);

  const addEvent = useCallback((e: CalendarEvent) => {
    setEvents(prev => [...prev, e]);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const toggleEvent = useCallback((id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  }, []);

  const getEventsForDate = useCallback((date: Date) => {
    return events.filter(e => {
      const d = e.date instanceof Date ? e.date : new Date(e.date);
      return isSameDay(d, date);
    });
  }, [events]);

  // Returns events within the next `days` days, sorted by date then time, not yet completed
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
        const daDate = a.date instanceof Date ? a.date : new Date(a.date);
        const dbDate = b.date instanceof Date ? b.date : new Date(b.date);
        const da = differenceInCalendarDays(daDate, new Date());
        const db = differenceInCalendarDays(dbDate, new Date());
        if (da !== db) return da - db;
        // same day: sort by time
        const ta = toMinutes(a);
        const tb = toMinutes(b);
        return ta - tb;
      });
  }, [events]);

  return (
    <CalendarContext.Provider value={{ events, addEvent, removeEvent, toggleEvent, getEventsForDate, getUpcoming }}>
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
