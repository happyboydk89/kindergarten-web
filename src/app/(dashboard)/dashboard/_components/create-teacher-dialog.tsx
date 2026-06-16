'use client';

/**
 * =====================================================================================
 * DIALOG: Tạo mới giáo viên
 * =====================================================================================
 *
 * Form fields:
 *   - Họ tên (bắt buộc, 1-100 ký tự)
 *   - Số điện thoại (bắt buộc, regex 0-9+)
 *   - Email (tùy chọn, phải hợp lệ nếu có)
 *   - Mật khẩu (tùy chọn, ≥6 ký tự nếu có) — nếu bỏ trống, BE tự sinh random 8 ký tự
 *
 * Sau khi tạo thành công:
 *   - Nếu BE tự sinh mật khẩu (do user không nhập) → show Alert với mật khẩu đó
 *     + nút "Sao chép". Principal copy mật khẩu đưa cho GV (sau này GV tự đổi).
 *   - Gọi `onCreated(teacher)` để parent refresh list.
 * =====================================================================================
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, KeyRound, Loader2, UserCog } from 'lucide-react';

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

import { teacherService, type TeacherBrief } from '@/services/teacher.service';

const createTeacherSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Họ tên không được để trống')
    .max(100, 'Họ tên quá dài (tối đa 100 ký tự)'),
  phoneNumber: z
    .string()
    .regex(/^[0-9+]+$/, 'Số điện thoại chỉ được chứa chữ số và dấu +')
    .min(9, 'Số điện thoại phải có ít nhất 9 ký tự')
    .max(15, 'Số điện thoại quá dài (tối đa 15 ký tự)'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  password: z
    .string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
    .max(64, 'Mật khẩu quá dài (tối đa 64 ký tự)')
    .optional()
    .or(z.literal('')),
});
type CreateTeacherFormValues = z.infer<typeof createTeacherSchema>;

export function CreateTeacherDialog({
  open,
  onOpenChange,
  campusId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campusId: string;
  onCreated: (teacher: TeacherBrief) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Mật khẩu tự sinh từ BE — hiển thị cho principal copy.
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [createdTeacher, setCreatedTeacher] = useState<TeacherBrief | null>(null);

  const form = useForm<CreateTeacherFormValues>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: {
      fullName: '',
      phoneNumber: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ fullName: '', phoneNumber: '', email: '', password: '' });
      setGeneratedPassword(null);
      setCreatedTeacher(null);
    }
  }, [open, form]);

  const onSubmit = async (values: CreateTeacherFormValues) => {
    if (!campusId) {
      toast.error('Vui lòng chọn cơ sở trước khi tạo giáo viên');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: {
        phoneNumber: string;
        fullName: string;
        email?: string;
        password?: string;
        campusId: string;
      } = {
        phoneNumber: values.phoneNumber,
        fullName: values.fullName.trim(),
        campusId,
      };
      if (values.email) payload.email = values.email;
      if (values.password) payload.password = values.password;

      const res = await teacherService.create(payload);
      if (res.success && res.data) {
        // Nếu user không nhập password → BE tự sinh. Hiển thị để copy.
        const generated = (res.data as { generatedPassword?: string }).generatedPassword;
        if (generated) {
          setGeneratedPassword(generated);
          setCreatedTeacher(res.data);
          toast.success('Tạo giáo viên thành công — BE đã tự sinh mật khẩu');
        } else {
          toast.success('Tạo giáo viên thành công');
          onCreated(res.data);
          onOpenChange(false);
        }
      } else {
        toast.error(res.message ?? 'Tạo giáo viên thất bại');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tạo giáo viên thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success('Đã sao chép mật khẩu vào clipboard');
    } catch {
      toast.error('Không thể sao chép — hãy copy thủ công');
    }
  };

  const handleCloseAfterCreate = () => {
    if (createdTeacher) onCreated(createdTeacher);
    onOpenChange(false);
  };

  // Sau khi tạo xong + có mật khẩu tự sinh → show panel "copy mật khẩu" thay vì form
  if (generatedPassword && createdTeacher) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <KeyRound className="h-5 w-5" />
              Tạo giáo viên thành công
            </DialogTitle>
            <DialogDescription>
              Hệ thống đã tự sinh mật khẩu cho <strong>{createdTeacher.fullName}</strong>.
              Hãy sao chép và gửi cho giáo viên — sau đó họ có thể tự đổi mật khẩu trong phần cài đặt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <KeyRound className="h-4 w-4 shrink-0" />
              <span className="font-medium">Mật khẩu tạm thời:</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded border border-amber-300 bg-white px-3 py-2 font-mono text-base text-slate-900">
                {generatedPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleCopyPassword()}
                title="Sao chép mật khẩu"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-700">
              ⚠️ Mật khẩu chỉ hiển thị 1 lần. Nếu quên, vui lòng reset qua API sau.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <Button type="button" onClick={handleCloseAfterCreate}>
              Đã sao chép — đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-600" />
            Tạo mới giáo viên
          </DialogTitle>
          <DialogDescription>
            Tạo tài khoản giáo viên cho cơ sở đang chọn. Giáo viên sẽ dùng số điện thoại +
            mật khẩu để đăng nhập.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vd: Nguyễn Thị Hoa"
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
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số điện thoại *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Vd: 0901234567"
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Số này sẽ là tên đăng nhập của giáo viên.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (tùy chọn)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="vd: hoa@school.vn"
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu (tùy chọn)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Để trống để hệ thống tự sinh"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Tối thiểu 6 ký tự. Nếu bỏ trống, hệ thống tự sinh 8 ký tự và hiển thị cho bạn copy.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting || !campusId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  'Tạo giáo viên'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
