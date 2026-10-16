import type { ReactNode } from 'react';

export interface RevealProps { children: ReactNode; d?: number; className?: string }
export interface ChildrenProps { children: ReactNode }
export interface DemoTask { t: string; k: 'task' | 'event' | 'note'; p?: 1 | 2 | 3; done?: boolean }
export interface BulletProps { k: DemoTask['k']; done?: boolean }
export interface DailyListProps { compact?: boolean; interactive?: boolean }
export interface LogoProps { className?: string }
export interface LaptopProps { interactive?: boolean }
export interface HabitsProps { small?: boolean }
