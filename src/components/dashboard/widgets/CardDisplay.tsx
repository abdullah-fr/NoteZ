import React from 'react';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type IconType = React.ElementType;

export interface CardDisplayItem {
  id: string;
  title: string;
  value: string;
  description: string;
  icon?: IconType;
  actionLabel?: string;
  isDisabled?: boolean;
  onActionClick?: (id: string) => void;
  trend?: 'up' | 'down' | 'flat';
}

export interface CardDisplayProps {
  items: CardDisplayItem[];
  className?: string;
  columns?: 2 | 3 | 4;
}

const colsClass = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

const CardDisplay: React.FC<CardDisplayProps> = ({ items, className, columns = 4 }) => {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No display items configured.</p>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4', colsClass[columns], className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const isClickable = Boolean(item.onActionClick) && !item.isDisabled;
        return (
          <Card
            key={item.id}
            onClick={isClickable ? () => item.onActionClick?.(item.id) : undefined}
            onKeyDown={isClickable ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                item.onActionClick?.(item.id);
              }
            } : undefined}
            tabIndex={isClickable ? 0 : undefined}
            role={isClickable ? 'button' : undefined}
            aria-label={isClickable ? `Open ${item.title}` : undefined}
            className={cn(
              'group relative overflow-hidden',
              'border-border/80 bg-card',
              'transition-all duration-300 ease-out',
              isClickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_10px_40px_-12px_hsl(var(--foreground)/0.6)]',
            )}
          >
            <span
              aria-hidden
              className="absolute left-0 top-0 h-px w-8 bg-foreground/40 transition-all duration-500 group-hover:w-full group-hover:bg-foreground/60"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-foreground/[0.03] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
                {item.title}
              </CardTitle>
              {Icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border/60 bg-secondary/40 transition-all duration-300 group-hover:border-foreground/40 group-hover:bg-secondary/80">
                  <Icon className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-foreground" />
                </div>
              )}
            </CardHeader>

            <CardContent className="relative pb-3">
              <p className="text-3xl font-serif font-semibold tracking-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </CardContent>

            {item.actionLabel && (
              <CardFooter className="relative pt-0">
                <div
                  aria-hidden="true"
                  className={cn(
                    'inline-flex h-9 w-full items-center justify-between rounded-md px-3 text-xs font-mono uppercase tracking-[0.16em]',
                    'border border-border/60 bg-transparent text-muted-foreground',
                    'transition-all duration-200',
                    'group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary',
                  )}
                >
                  <span>{item.actionLabel}</span>
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </div>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default CardDisplay;
