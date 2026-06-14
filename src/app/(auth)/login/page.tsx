'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/hooks/use-auth';
import { getRoleHomePath } from '@/lib/role-utils';

const loginSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Vui lòng nhập số điện thoại')
    .regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    try {
      const user = await login(values.phoneNumber, values.password);
      toast.success('Đăng nhập thành công');
      router.push(getRoleHomePath(user.role));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Đăng nhập thất bại';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left: Illustration */}
      <div className="hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-100 p-12 lg:flex">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100">
            <GraduationCap className="h-10 w-10 text-indigo-600" />
          </div>
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-800">
            Kindergarten CRM
          </h1>
          <p className="text-base leading-relaxed text-slate-500">
            Hệ thống Quản lý Mầm non — Điểm danh, Học phí, Sức khỏe và
            Lịch học trong một nền tảng duy nhất.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-white/60 p-4 shadow-sm">
              <div className="text-lg font-semibold text-indigo-600">4</div>
              <div className="text-xs text-slate-500">Phân hệ quản lý</div>
            </div>
            <div className="rounded-lg bg-white/60 p-4 shadow-sm">
              <div className="text-lg font-semibold text-indigo-600">24/7</div>
              <div className="text-xs text-slate-500">Truy cập dữ liệu</div>
            </div>
            <div className="rounded-lg bg-white/60 p-4 shadow-sm">
              <div className="text-lg font-semibold text-indigo-600">VNĐ</div>
              <div className="text-xs text-slate-500">Học phí minh bạch</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 lg:hidden">
              <GraduationCap className="h-6 w-6 text-indigo-600" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">
              Đăng nhập
            </CardTitle>
            <CardDescription>
              Nhập số điện thoại và mật khẩu để truy cập hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số điện thoại</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0900000001"
                          inputMode="numeric"
                          autoComplete="username"
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
                      <FormLabel>Mật khẩu</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </form>
            </Form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Liên hệ Ban Giám hiệu nếu bạn quên mật khẩu hoặc cần hỗ trợ
              tài khoản.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
