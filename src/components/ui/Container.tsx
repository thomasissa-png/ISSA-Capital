import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Width = 'content' | 'editorial' | 'narrow';

type ContainerProps = {
  width?: Width;
  children: ReactNode;
  className?: string;
};

const widthClasses: Record<Width, string> = {
  content: 'max-w-content',
  editorial: 'max-w-editorial',
  narrow: 'max-w-narrow',
};

export function Container({
  width = 'content',
  children,
  className,
}: ContainerProps): JSX.Element {
  return (
    <div className={cn('mx-auto w-full px-md md:px-xl', widthClasses[width], className)}>
      {children}
    </div>
  );
}
