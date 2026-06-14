import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/use-auth';
import { ToastListener } from '@/components/toast-listener';

export const metadata: Metadata = {
  title: 'Kindergarten CRM',
  description: 'Hệ thống quản lý trường mầm non',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
          <ToastListener />
        </AuthProvider>
      </body>
    </html>
  );
}
