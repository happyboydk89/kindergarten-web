import Link from 'next/link';

export default function ParentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Phụ huynh</h1>
        <p className="mt-2 text-muted-foreground">Trang dành cho phụ huynh đang được xây dựng.</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Đăng xuất
        </Link>
      </div>
    </div>
  );
}
