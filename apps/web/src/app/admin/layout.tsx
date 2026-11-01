import { AdminShell } from '@/components/admin/AdminShell';

export const metadata = { title: 'لوحة التحكم | الأمان للمصاعد' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
