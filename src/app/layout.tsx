import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGate from "@/components/AuthGate";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestox - Gestion locative",
  description: "Logiciel de gestion locative",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 min-h-screen">
        <AuthProvider>
          <AuthGate>
            <AppShell>
              {children}
            </AppShell>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
