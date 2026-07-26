import { useEffect, useRef, useState, type ReactNode } from 'react';

interface VirtualDayProps {
  date: string;
  children: ReactNode;
  keepMounted?: boolean;
  className?: string;
}

const DEFAULT_DAY_HEIGHT = 72;

export function VirtualDay({ date, children, keepMounted = false, className = '' }: VirtualDayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(DEFAULT_DAY_HEIGHT);
  const [isNearViewport, setIsNearViewport] = useState(true);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const scrollRoot = element.closest('.app-shell-main-content');
    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { root: scrollRoot, rootMargin: '720px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || (!isNearViewport && !keepMounted)) return;

    const measure = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height > 0) setMeasuredHeight(height);
    };
    const frame = requestAnimationFrame(measure);

    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children, isNearViewport, keepMounted]);

  const shouldRender = keepMounted || isNearViewport;

  return (
    <div
      ref={rootRef}
      id={`daily-day-${date}`}
      data-day-date={date}
      data-virtualized={shouldRender ? 'false' : 'true'}
      className={className}
      style={shouldRender ? undefined : { height: measuredHeight }}
    >
      {shouldRender ? children : <span className="sr-only">{date}</span>}
    </div>
  );
}
