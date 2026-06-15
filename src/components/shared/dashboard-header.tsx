'use client';

/**
 * =====================================================================================
 * HEADER (Top bar) — Campus Switcher + breadcrumb placeholder
 * =====================================================================================
 *
 * Header này được render phía trên main content (dưới Navbar), trong (dashboard)/layout.tsx.
 * Nhiệm vụ chính:
 *   - Hiển thị Campus Switcher (Select dropdown) để Hiệu trưởng chọn cơ sở đang quản lý.
 *   - State `selectedCampusId` được lưu trong localStorage (key: 'kindergarten.selectedCampusId')
 *     để duy trì khi điều hướng giữa các route con.
 *   - Nút "Thêm cơ sở" mở Dialog CreateCampusDialog.
 *   - Khi chưa có campus nào → hiển thị EmptyState kèm CTA mở Dialog tạo nhanh.
 *
 * Mọi route con của /dashboard (vd /dashboard/classes, /dashboard/students...) sẽ
 * đọc `selectedCampusId` từ localStorage qua hook `useSelectedCampusId` (xem bên dưới)
 * để gọi API filter theo campus.
 * =====================================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, ChevronRight, Plus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { campusService, type Campus } from '@/services/campus.service';
import { CreateCampusDialog } from './create-campus-dialog';

const STORAGE_KEY = 'kindergarten.selectedCampusId';

// =====================================================================================
// CONTEXT: share selectedCampusId giữa Header (write) và các page con (read)
// =====================================================================================

interface CampusContextValue {
  campuses: Campus[];
  selectedCampusId: string;
  setSelectedCampusId: (id: string) => void;
  isLoading: boolean;
  /** Trigger refresh danh sách campus (vd: sau khi tạo xong). */
  refreshCampuses: () => Promise<void>;
}

const CampusContext = createContext<CampusContextValue | null>(null);

export function useSelectedCampus(): CampusContextValue {
  const ctx = useContext(CampusContext);
  if (!ctx) {
    throw new Error('useSelectedCampus must be used within <CampusProvider>');
  }
  return ctx;
}

/**
 * Provider đặt NGAY TRONG (dashboard)/layout.tsx — bao bọc cả Navbar + Main.
 * Header sẽ write (setSelectedCampusId), các page con sẽ read (selectedCampusId).
 */
export function CampusProvider({ children }: { children: ReactNode }) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCampuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await campusService.list();
      if (res?.success && Array.isArray(res.data)) {
        setCampuses(res.data);
        // Nếu đã có lựa chọn trong localStorage và còn tồn tại → giữ; ngược lại chọn campus đầu tiên
        const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (saved && res.data.some((c) => c.id === saved)) {
          setSelectedCampusIdState(saved);
        } else if (res.data.length > 0) {
          setSelectedCampusIdState(res.data[0].id);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Không thể tải danh sách cơ sở',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampuses();
  }, [fetchCampuses]);

  const setSelectedCampusId = useCallback((id: string) => {
    setSelectedCampusIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  return (
    <CampusContext.Provider
      value={{
        campuses,
        selectedCampusId,
        setSelectedCampusId,
        isLoading,
        refreshCampuses: fetchCampuses,
      }}
    >
      {children}
    </CampusContext.Provider>
  );
}

// =====================================================================================
// HEADER component — render Switcher + nút Thêm cơ sở
// =====================================================================================
export function DashboardHeader() {
  const router = useRouter();
  const { campuses, selectedCampusId, setSelectedCampusId, isLoading, refreshCampuses } =
    useSelectedCampus();
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreated = useCallback(
    (c: Campus) => {
      setSelectedCampusId(c.id);
      // refresh lại danh sách để đảm bảo đồng bộ
      void refreshCampuses();
    },
    [setSelectedCampusId, refreshCampuses],
  );

  const currentCampus = campuses.find((c) => c.id === selectedCampusId);

  return (
    <>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Cơ sở đang quản lý:</span>
            {currentCampus ? (
              <Badge variant="secondary" className="font-medium">
                {currentCampus.name}
              </Badge>
            ) : (
              <span className="text-slate-400">Chưa chọn</span>
            )}
            <ChevronRight className="hidden h-3 w-3 text-slate-300 sm:inline" />
            <span className="hidden text-xs text-slate-400 sm:inline">
              Dữ liệu bên dưới sẽ lọc theo cơ sở này
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Switcher */}
            <div className="w-full sm:w-64">
              {isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : campuses.length > 0 ? (
                <Select value={selectedCampusId} onValueChange={setSelectedCampusId}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                      <SelectValue placeholder="Chọn cơ sở" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Chưa có cơ sở — tạo ngay</span>
                </button>
              )}
            </div>

            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Thêm cơ sở
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              title="Về trang Tổng quan"
            >
              Tổng quan
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateCampusDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
