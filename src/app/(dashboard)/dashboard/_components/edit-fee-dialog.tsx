'use client';

/**
 * =====================================================================================
 * DIALOG: Chỉnh sửa học phí riêng của lớp
 * =====================================================================================
 *
 * Khi mở:
 *   - Pre-fill với `currentBaseFee` (có thể null = dùng FeeConfig chung).
 *   - Nút "Reset về FeeConfig" set null.
 *
 * Khi submit:
 *   - PUT /api/v1/classes/:id/fee { baseFee: number | null }
 *   - Gọi onSaved() để parent refetch.
 * =====================================================================================
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';
import { extractApiError } from '@/lib/api-helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { classService } from '@/services/class.service';
import { formatVND } from '@/lib/utils';

const editFeeSchema = z.object({
  baseFee: z
    .union([z.coerce.number().int().nonnegative('Học phí phải ≥ 0'), z.nan()])
    .refine((v) => !Number.isNaN(v), {
      message: 'Vui lòng nhập số hợp lệ',
    }),
});

type EditFeeFormValues = z.infer<typeof editFeeSchema>;

export function EditFeeDialog({
  open,
  onOpenChange,
  classId,
  className,
  currentBaseFee,
  effectiveBaseFee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  className: string;
  currentBaseFee: number | null;
  effectiveBaseFee: number | null;
  onSaved: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFeeFormValues>({
    resolver: zodResolver(editFeeSchema),
    defaultValues: {
      baseFee: currentBaseFee ?? 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ baseFee: currentBaseFee ?? 0 });
    }
  }, [open, currentBaseFee, form]);

  const onSubmit = async (values: EditFeeFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await classService.updateFee(classId, values.baseFee);
      if (res.success) {
        toast.success('Đã cập nhật học phí lớp');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(res.message ?? 'Cập nhật học phí thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Cập nhật học phí thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setIsSubmitting(true);
    try {
      const res = await classService.updateFee(classId, null);
      if (res.success) {
        toast.success('Đã reset về FeeConfig mặc định');
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(res.message ?? 'Reset thất bại');
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Reset thất bại'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-600" />
            Học phí lớp {className}
          </DialogTitle>
          <DialogDescription>
            Đặt mức học phí riêng cho lớp này. Nếu không đặt, hệ thống sẽ dùng{' '}
            <strong>FeeConfig mặc định theo khối</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 text-sm">
          <p className="text-slate-600">Học phí hiện tại áp dụng:</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {effectiveBaseFee !== null ? formatVND(effectiveBaseFee) : 'Chưa cấu hình'}
          </p>
          {currentBaseFee === null && effectiveBaseFee !== null && (
            <p className="mt-1 text-xs text-slate-500">
              (Đang dùng FeeConfig mặc định — bấm Reset bên dưới để chuyển sang sửa trực tiếp)
            </p>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="baseFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Học phí riêng (VND / tháng)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="Vd: 3500000"
                      disabled={isSubmitting}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    Để trống hoặc bấm "Reset" nếu muốn dùng FeeConfig theo khối.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleReset()}
                disabled={isSubmitting || currentBaseFee === null}
                title="Xoá override, dùng FeeConfig mặc định theo khối"
              >
                Reset về FeeConfig
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  'Lưu'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
