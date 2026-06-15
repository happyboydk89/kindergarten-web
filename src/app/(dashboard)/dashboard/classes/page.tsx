'use client';

import { ClassesTab } from '@/app/(dashboard)/dashboard/_components/classes-tab';
import { useSelectedCampus } from '@/components/shared/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function ClassesPage() {
  const { selectedCampusId, campuses, isLoading } = useSelectedCampus();

  // Nếu chưa chọn campus và cũng không có campus nào → hiển thị hướng dẫn
  if (!isLoading && campuses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Building2 className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            Bạn chưa có cơ sở nào. Hãy bấm <strong>Thêm cơ sở</strong> ở Header trên để bắt đầu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ClassesTab campusId={selectedCampusId} />;
}
