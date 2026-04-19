import { Toaster } from 'sonner';

export const metadata = {
  title: 'JPK 렌터카 · 고객 조회',
};

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="my-shell">{children}</div>
      <Toaster position="top-center" richColors />
    </>
  );
}
