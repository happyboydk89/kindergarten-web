'use client';

/**
 * =====================================================================================
 * SHARED: CreateCampusDialog
 * =====================================================================================
 *
 * Dialog dùng chung để tạo mới Campus. Được embed trong DashboardHeader và có thể
 * được trigger từ bất kỳ trang nào trong /dashboard.
 *
 * Business rule:
 *   - `campusId` của user tạo sẽ được set làm `selectedCampusId` (qua onCreated callback)
 *   - Sau khi tạo xong → đóng dialog
 * =====================================================================================
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { campusService, type Campus } from '@/services/campus.service';

// ---------- Schema validate ----------
const createCampusSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên cơ sở phải có ít nhất 2 ký tự')
    .max(100, 'Tên cơ sở quá dài'),
  address: z
    .string()
    .min(5, 'Địa chỉ phải có ít nhất 5 ký tự')
    .max(200, 'Địa chỉ quá dài'),
});
type CreateCampusFormValues = z.infer<typeof createCampusSchema>;

/**
 * Dialog tạo mới Campus — dùng chung cho toàn bộ dashboard.
 * Component cha điều khiển open/close qua `open` + `onOpenChange`.
 */
export function CreateCampusDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campus: Campus) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateCampusFormValues>({
    resolver: zodResolver(createCampusSchema),
    defaultValues: { name: '', address: '' },
  });

  // Reset form mỗi khi đóng Dialog
  useEffect(() => {
    if (!open) {
      form.reset({ name: '', address: '' });
    }
  }, [open, form]);

  const onSubmit = async (values: CreateCampusFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await campusService.create({
        name: values.name.trim(),
        address: values.address.trim(),
      });
      if (res?.success && res.data) {
        toast.success(`Đã tạo cơ sở "${res.data.name}"`);
        onCreated(res.data);
        onOpenChange(false);
      } else {
        toast.error(res?.message ?? 'Tạo cơ sở thất bại');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Có lỗi xảy ra khi tạo cơ sở';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Trigger ẩn — mở qua state từ component cha */}
        <span className="hidden" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Thêm cơ sở mới
          </DialogTitle>
          <DialogDescription>
            Tạo một cơ sở mới để bắt đầu quản lý học sinh, lớp học và giáo viên tại đây.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên cơ sở</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Cơ sở Quận 1"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa chỉ</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: 12 Nguyễn Huệ, Quận 1, TP.HCM"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tạo cơ sở
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
