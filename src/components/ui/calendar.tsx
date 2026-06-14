import 'react-day-picker/style.css';

import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  return (
    <DayPicker
      classNames={{
        ...defaultClassNames,
        root: cn(
          'rdp-root bg-popover text-popover-foreground',
          className,
        ),
        selected: cn(defaultClassNames.selected, 'bg-indigo-600 text-white hover:bg-indigo-700'),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
