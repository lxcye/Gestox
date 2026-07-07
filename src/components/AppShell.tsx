"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";

const PUBLIC_PATHS = ["/login", "/onboarding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Navigation />
      <main className="flex-1 p-4 md:p-8 mt-14 md:mt-0">
        {children}
      </main>
    </div>
  );
}
