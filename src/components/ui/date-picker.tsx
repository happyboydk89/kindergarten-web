'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  /**
   * Khoảng năm cho phép chọn trong dropdown. Mặc định phù hợp với
   * tiếp nhận học sinh mầm non: từ 2015 (các bé ~10 tuổi đổ xuống)
   * đến năm hiện tại (các bé sơ sinh).
   */
  fromYear?: number;
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder,
  fromYear = 2015,
  toYear = new Date().getFullYear(),
}: DatePickerProps) {
  const date = value ? new Date(value + 'T12:00:00') : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy') : placeholder ?? 'Chọn ngày'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, 'yyyy-MM-dd'));
            }
          }}
          // Dropdown chọn năm/tháng trên header thay vì chỉ mũi tên next/prev.
          // Phù hợp với việc nhập ngày sinh các bé (sinh trước đó 1-6 năm),
          // nếu chỉ có nút next/prev phải bấm rất nhiều lần mới tới được năm cũ.
          // react-day-picker v10 dùng `startMonth` / `endMonth` (Date) thay vì fromYear/toYear.
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
