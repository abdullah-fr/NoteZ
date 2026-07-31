import { createContext, useContext, useState, ReactNode } from 'react';
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

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const addEvent    = (e: CalendarEvent) => setEvents(prev => [...prev, e]);
  const removeEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
  const toggleEvent = (id: string) => setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  const getEventsForDate = (date: Date) => events.filter(e => isSameDay(e.date, date));

  // Returns events within the next `days` days, sorted by date then time, not yet completed
  const getUpcoming = (days = 7) => {
    const now = new Date();
    return events
      .filter(e => {
        if (e.completed) return false;
        const diff = differenceInCalendarDays(e.date, now);
        return diff >= 0 && diff <= days;
      })
      .sort((a, b) => {
        const da = differenceInCalendarDays(a.date, new Date());
        const db = differenceInCalendarDays(b.date, new Date());
        if (da !== db) return da - db;
        // same day: sort by time
        const ta = toMinutes(a); const tb = toMinutes(b);
        return ta - tb;
      });
  };

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

export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const diff = differenceInCalendarDays(date, new Date());
  if (diff <= 6) return format(date, 'EEEE'); // "Monday"
  return format(date, 'MMM d');
}
