import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { AuthGuard } from '@/components/layout/auth-guard';
import { RouteGuard } from '@/components/layout/route-guard';
import { MenuCountsSync } from '@/components/layout/menu-counts-sync';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <RouteGuard>
        <MenuCountsSync />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <Topbar />
            {children}
          </main>
        </div>
        <CommandPalette />
      </RouteGuard>
    </AuthGuard>
  );
}
