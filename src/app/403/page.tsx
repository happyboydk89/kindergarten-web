import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
          <ShieldX className="h-10 w-10 text-rose-500" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-800">
          Không có quyền truy cập
        </h1>
        <p className="mb-8 text-slate-500">
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị
          viên nếu bạn cho rằng đây là sự nhầm lẫn.
        </p>
        <Link href="/dashboard">
          <Button>Về trang chủ</Button>
        </Link>
      </div>
    </div>
  );
}
