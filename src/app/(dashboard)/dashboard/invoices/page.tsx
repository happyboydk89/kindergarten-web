'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  FileText,
  Plus,
  CheckCircle2,
  CreditCard,
  AlertCircle,
  Receipt,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import { invoiceService, type InvoiceItem } from '@/services/invoice.service';
import type { InvoiceStatus } from '@/types';
import { INVOICE_STATUS_LABELS } from '@/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}));

function getCurrentYear(): number {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnTime.getFullYear();
}

function getCurrentMonth(): number {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return vnTime.getMonth() + 1;
}

function generateYears(): number[] {
  const years: number[] = [];
  for (let y = getCurrentYear() + 1; y >= 2000; y--) {
    years.push(y);
  }
  return years;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const canModify = user?.role === 'PRINCIPAL' || user?.role === 'STAFF';

  const [month, setMonth] = useState<string>(String(getCurrentMonth()));
  const [year, setYear] = useState<string>(String(getCurrentYear()));

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0 });

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await invoiceService.list({
        month: Number(month),
        year: Number(year),
        page: currentPage,
        limit: 20,
      });
      if (res.success) {
        const data = res.data ?? [];
        setInvoices(data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages);
          setTotalCount(res.meta.total);
        }
      } else {
        toast.error(res.message ?? 'Không thể tải danh sách hóa đơn');
      }
    } catch {
      toast.error('Không thể tải danh sách hóa đơn');
    } finally {
      setIsLoading(false);
    }
  }, [month, year, currentPage]);

  const fetchStats = useCallback(async () => {
    try {
      const paidRes = await invoiceService.list({
        month: Number(month),
        year: Number(year),
        status: 'PAID',
        limit: 1,
      });
      const unpaidRes = await invoiceService.list({
        month: Number(month),
        year: Number(year),
        status: 'UNPAID',
        limit: 1,
      });
      const allRes = await invoiceService.list({
        month: Number(month),
        year: Number(year),
        limit: 1,
      });

      const total = allRes.success && allRes.meta ? allRes.meta.total : 0;
      const paid = paidRes.success && paidRes.meta ? paidRes.meta.total : 0;
      const unpaid = unpaidRes.success && unpaidRes.meta ? unpaidRes.meta.total : 0;

      setStats({ total, paid, unpaid });
    } catch {
      // Stats are non-critical
    }
  }, [month, year]);

  useEffect(() => {
    setCurrentPage(1);
  }, [month, year]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleMonthChange = (value: string) => {
    setMonth(value);
  };

  const handleYearChange = (value: string) => {
    setYear(value);
  };

  const handleGenerate = async () => {
    setShowGenerateDialog(false);
    setIsGenerating(true);
    try {
      const res = await invoiceService.generate(Number(month), Number(year));
      if (res.success) {
        const data = res.data;
        const msgParts: string[] = [];
        if (data?.generatedCount) {
          msgParts.push(`Đã tạo ${data.generatedCount} hóa đơn`);
        }
        if (data?.skippedCount) {
          msgParts.push(`bỏ qua ${data.skippedCount} hóa đơn đã tồn tại`);
        }
        if (data?.noClassStudentIds?.length) {
          msgParts.push(`${data.noClassStudentIds.length} học sinh chưa xếp lớp`);
        }
        toast.success(msgParts.join(', '));
        setCurrentPage(1);
        await fetchInvoices();
        await fetchStats();
      } else {
        toast.error(res.message ?? 'Tạo hóa đơn thất bại');
      }
    } catch {
      toast.error('Tạo hóa đơn thất bại');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      const res = await invoiceService.updatePaymentStatus(invoiceId);
      if (res.success) {
        toast.success('Đã xác nhận thanh toán');
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, status: 'PAID' as InvoiceStatus } : inv,
          ),
        );
        setStats((prev) => ({
          ...prev,
          paid: prev.paid + 1,
          unpaid: Math.max(0, prev.unpaid - 1),
        }));
      } else {
        toast.error(res.message ?? 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Cập nhật trạng thái thất bại');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Quản lý Hóa đơn</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý và theo dõi hóa đơn học phí
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng số hóa đơn
            </CardTitle>
            <FileText className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{stats.total.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted-foreground">
              Tháng {month}/{year}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Đã thanh toán
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats.paid.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0
                ? `${Math.round((stats.paid / stats.total) * 100)}% tổng số`
                : 'Chưa có dữ liệu'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chưa thanh toán
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{stats.unpaid.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0
                ? `${Math.round((stats.unpaid / stats.total) * 100)}% tổng số`
                : 'Chưa có dữ liệu'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="w-36 space-y-1.5">
                <label className="text-sm font-medium">Tháng</label>
                <Select value={month} onValueChange={handleMonthChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-36 space-y-1.5">
                <label className="text-sm font-medium">Năm</label>
                <Select value={year} onValueChange={handleYearChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateYears().map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="default"
                onClick={fetchInvoices}
                disabled={isLoading}
                className="h-9 shrink-0 gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Tải lại
              </Button>
            </div>

            {canModify && (
              <>
                <Button
                  onClick={() => setShowGenerateDialog(true)}
                  disabled={isGenerating}
                  className="h-9 shrink-0 gap-1.5"
                  size="default"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isGenerating ? 'Đang tạo...' : 'Tạo hóa đơn tháng'}
                </Button>

                <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận tạo hóa đơn</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>
                          Hệ thống sẽ quét toàn bộ học sinh có lớp học để tạo biểu phí cho{' '}
                          <span className="font-semibold text-foreground">
                            Tháng {month}/{year}
                          </span>
                          .
                        </p>
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Lưu ý:</span> Những học sinh chưa xếp lớp
                            hoặc thiếu cấu hình biểu phí (FeeConfig) sẽ bị bỏ qua. Hóa đơn đã tồn tại
                            trong tháng sẽ không bị tạo trùng.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={handleGenerate}>
                        Tạo hóa đơn
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách hóa đơn</CardTitle>
            {totalCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {totalCount} hóa đơn
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-slate-100 p-4">
                <Receipt className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-600">Không có hóa đơn nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {canModify
                  ? 'Chưa có hóa đơn cho tháng này. Hãy tạo hóa đơn để bắt đầu.'
                  : 'Chưa có hóa đơn cho tháng này.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Mã hóa đơn</TableHead>
                      <TableHead>Tên học sinh</TableHead>
                      <TableHead>Lớp học</TableHead>
                      <TableHead className="text-right">Tổng số tiền</TableHead>
                      <TableHead className="text-center">Tháng/Năm</TableHead>
                      <TableHead className="text-center">Trạng thái</TableHead>
                      {canModify && <TableHead className="w-32 text-center">Thao tác</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">
                          {invoice.invoiceCode ?? invoice.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-medium">{invoice.studentName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.className ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatVnd(invoice.totalAmount)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {invoice.month}/{invoice.year}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={invoice.status === 'PAID' ? 'success' : 'warning'}>
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </Badge>
                        </TableCell>
                        {canModify && (
                          <TableCell className="text-center">
                            {invoice.status === 'UNPAID' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkPaid(invoice.id)}
                                disabled={updatingId === invoice.id}
                                className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              >
                                {updatingId === invoice.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CreditCard className="h-3 w-3" />
                                )}
                                Đã đóng tiền
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {currentPage} / {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
