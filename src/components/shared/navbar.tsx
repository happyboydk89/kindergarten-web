'use client';

import { useAuth } from '@/hooks/use-auth';
import { USER_ROLE_LABELS } from '@/types';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Menu, PanelLeftClose, PanelLeft, KeyRound, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';

interface NavbarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMobileMenuOpen: () => void;
}

export function Navbar({ collapsed, onToggleCollapse, onMobileMenuOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setChangingPw(true);
    try {
      const res = await authService.changePassword(oldPassword, newPassword, confirmPassword);
      if (res.success) {
        toast.success('Đổi mật khẩu thành công');
        setChangePwOpen(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.message ?? 'Đổi mật khẩu thất bại');
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setChangingPw(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .slice(-2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <>
      <header className="flex h-14 items-center gap-4 border-b bg-white px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuOpen}>
          <Menu className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="hidden lg:flex" onClick={onToggleCollapse}>
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        <Breadcrumb className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline font-medium text-slate-700">
                {user?.fullName ?? 'Người dùng'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span>{user?.fullName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.role ? USER_ROLE_LABELS[user.role] : ''}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePwOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Đổi mật khẩu
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Dialog open={changePwOpen} onOpenChange={setChangePwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="old-pw">Mật khẩu hiện tại</Label>
              <Input
                id="old-pw"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">Mật khẩu mới</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePwOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPw}>
              {changingPw ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
