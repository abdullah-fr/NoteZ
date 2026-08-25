import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isSameDay, isToday, isTomorrow, differenceInCalendarDays, format } from 'date-fns';

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
  const d1 = new Date(today);
  d1.setDate(d1.getDate() + 2);
  const d2 = new Date(today);
  d2.setDate(d2.getDate() + 3);
  const d3 = new Date(today);
  d3.setDate(d3.getDate() + 5);

  return [
    {
      id: 'sample-1',
      date: today,
      type: 'task',
      title: 'Physics — Chapter 4 Revision',
      subject: 'Physics Notes',
      priority: 'high',
      focusDurationMins: 60,
      hour: 7,
      minute: 0,
      ampm: 'PM',
      completed: true,
    },
    {
      id: 'sample-2',
      date: today,
      type: 'deadline',
      title: 'Math Assignment Problems',
      subject: 'Maths Folder',
      priority: 'medium',
      focusDurationMins: 45,
      hour: 11,
      minute: 59,
      ampm: 'PM',
      completed: false,
    },
    {
      id: 'sample-3',
      date: d1,
      type: 'deadline',
      title: 'Physics Midterm Exam',
      subject: 'Physics Notes',
      priority: 'high',
      focusDurationMins: 90,
      hour: 9,
      minute: 0,
      ampm: 'AM',
      completed: false,
    },
    {
      id: 'sample-4',
      date: d2,
      type: 'task',
      title: 'Chemistry Lab Report',
      subject: 'Chemistry',
      priority: 'medium',
      focusDurationMins: 60,
      hour: 2,
      minute: 30,
      ampm: 'PM',
      completed: false,
    },
    {
      id: 'sample-5',
      date: d3,
      type: 'event',
      title: 'Group Study & Project Sync',
      subject: 'Computer Science',
      priority: 'low',
      focusDurationMins: 45,
      hour: 4,
      minute: 0,
      ampm: 'PM',
      link: 'https://meet.google.com/abc-defg-hij',
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

  const updateEvent = useCallback((id: string, partial: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...partial } : e));
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
