"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";

const ADMIN_EMAILS = ["lucieob29@gmail.com", "sci.lpm.37@gmail.com"];
const INVITE_TOKEN = process.env.NEXT_PUBLIC_INVITE_TOKEN ?? "";

interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email ?? "");
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/onboarding?invite=${INVITE_TOKEN}`
    : "";

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/");
    }
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchUsers() {
      try {
        const sb = getSupabase();
        const { data, error } = await sb.auth.admin.listUsers();
        if (!error && data) {
          setUsers(data.users.map(u => ({
            id: u.id,
            email: u.email ?? "—",
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
          })));
        }
      } catch {
        // admin API non disponible côté client
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [isAdmin]);

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fmtDate(d: string | null) {
    if (!d) return "Jamais";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Administration</h1>

      {/* Lien d'invitation */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Lien d'invitation</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Envoyez ce lien aux personnes que vous souhaitez inviter.
            Seules les personnes ayant ce lien peuvent créer un compte.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
          <span className="text-xs text-gray-600 flex-1 truncate font-mono">{inviteUrl}</span>
          <button
            onClick={copyLink}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              copied
                ? "bg-green-100 text-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied ? "✓ Copié !" : "Copier"}
          </button>
        </div>

        <div className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ Ce lien est permanent. Pour le changer, modifiez la variable{" "}
          <span className="font-mono">NEXT_PUBLIC_INVITE_TOKEN</span> dans Vercel et redéployez.
        </div>
      </div>

      {/* Administrateurs */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Administrateurs</h2>
        <div className="space-y-2">
          {ADMIN_EMAILS.map(email => (
            <div key={email} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-gray-700">{email}</span>
              {email === user?.email && (
                <span className="text-xs text-blue-600 font-medium">(vous)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Utilisateurs inscrits */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Utilisateurs inscrits</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pour supprimer un compte, rendez-vous dans le{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              tableau de bord Supabase
            </a>{" "}
            → Authentication → Users.
          </p>
        </div>

        {loadingUsers ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            La liste des utilisateurs n'est pas accessible depuis le navigateur
            (API admin Supabase requise côté serveur).
            Consultez le tableau de bord Supabase pour voir les comptes inscrits.
          </p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{u.email}</p>
                  <p className="text-xs text-gray-400">
                    Inscrit le {fmtDate(u.created_at)} · Dernière connexion : {fmtDate(u.last_sign_in_at)}
                  </p>
                </div>
                {ADMIN_EMAILS.includes(u.email) && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
