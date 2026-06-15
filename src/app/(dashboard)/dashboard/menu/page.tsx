'use client';

import { MenuTab } from '@/app/(dashboard)/dashboard/_components/menu-tab';
import { useSelectedCampus } from '@/components/shared/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function MenuPage() {
  const { selectedCampusId, campuses, isLoading } = useSelectedCampus();

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

  return <MenuTab campusId={selectedCampusId} />;
}
