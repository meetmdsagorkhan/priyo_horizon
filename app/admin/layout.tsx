import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="launch-shell min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-tight text-white">Priyo Admin</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
