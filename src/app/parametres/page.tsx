"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";

export default function ParametresPage() {
  const { user } = useAuth();

  // ── Mot de passe ──
  const [ancienMdp, setAncienMdp] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmMdp, setConfirmMdp] = useState("");
  const [mdpStatus, setMdpStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ── Email ──
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ── Suggestion ──
  const [sujet, setSujet] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggStatus, setSuggStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [suggLoading, setSuggLoading] = useState(false);

  async function handleChangeMdp(e: React.FormEvent) {
    e.preventDefault();
    setMdpStatus(null);
    if (nouveauMdp !== confirmMdp) {
      setMdpStatus({ type: "err", msg: "Les mots de passe ne correspondent pas." });
      return;
    }
    if (nouveauMdp.length < 6) {
      setMdpStatus({ type: "err", msg: "Le mot de passe doit contenir au moins 6 caractères." });
      return;
    }
    const sb = getSupabase();
    // Re-authenticate then update
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: user?.email ?? "",
      password: ancienMdp,
    });
    if (signInErr) {
      setMdpStatus({ type: "err", msg: "Mot de passe actuel incorrect." });
      return;
    }
    const { error } = await sb.auth.updateUser({ password: nouveauMdp });
    if (error) {
      setMdpStatus({ type: "err", msg: error.message });
    } else {
      setMdpStatus({ type: "ok", msg: "Mot de passe mis à jour." });
      setAncienMdp(""); setNouveauMdp(""); setConfirmMdp("");
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus(null);
    if (!nouvelEmail.trim()) return;
    const sb = getSupabase();
    const { error } = await sb.auth.updateUser({ email: nouvelEmail });
    if (error) {
      setEmailStatus({ type: "err", msg: error.message });
    } else {
      setEmailStatus({ type: "ok", msg: "Un email de confirmation a été envoyé à la nouvelle adresse." });
      setNouvelEmail("");
    }
  }

  async function handleSuggestion(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestion.trim()) return;
    setSuggLoading(true);
    setSuggStatus(null);
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, message: suggestion, userEmail: user?.email }),
      });
      if (res.ok) {
        setSuggStatus({ type: "ok", msg: "Votre suggestion a bien été envoyée. Merci !" });
        setSujet(""); setSuggestion("");
      } else if (res.status === 503) {
        setSuggStatus({ type: "err", msg: "Fonctionnalité non configurée : ajoutez votre clé Resend dans .env.local (RESEND_API_KEY=re_…) puis relancez le serveur." });
      } else {
        setSuggStatus({ type: "err", msg: "Erreur lors de l'envoi. Réessayez plus tard." });
      }
    } catch {
      setSuggStatus({ type: "err", msg: "Erreur réseau. Réessayez plus tard." });
    } finally {
      setSuggLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      {/* Compte — email actuel */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Mon compte</h2>

        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">Adresse email actuelle</p>
          <p className="text-sm font-semibold text-gray-800 bg-gray-50 border rounded-lg px-3 py-2">
            {user?.email ?? "—"}
          </p>
        </div>

        {/* Changer email */}
        <form onSubmit={handleChangeEmail} className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700">Changer l'adresse email</h3>
          <input
            type="email"
            value={nouvelEmail}
            onChange={e => setNouvelEmail(e.target.value)}
            placeholder="Nouvelle adresse email"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              Mettre à jour
            </button>
            {emailStatus && (
              <span className={`text-sm ${emailStatus.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {emailStatus.msg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Changer mot de passe */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Changer le mot de passe</h2>
        <form onSubmit={handleChangeMdp} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={ancienMdp}
              onChange={e => setAncienMdp(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={nouveauMdp}
              onChange={e => setNouveauMdp(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmMdp}
              onChange={e => setConfirmMdp(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              Changer le mot de passe
            </button>
            {mdpStatus && (
              <span className={`text-sm ${mdpStatus.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {mdpStatus.msg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Suggestions */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Suggérer une modification</h2>
          <p className="text-sm text-gray-500 mt-1">
            Une idée d'amélioration ? Décrivez-la ci-dessous. Elle sera transmise au développeur.
          </p>
        </div>
        <form onSubmit={handleSuggestion} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
            <input
              type="text"
              value={sujet}
              onChange={e => setSujet(e.target.value)}
              placeholder="Ex : Améliorer la génération de PDF…"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              rows={5}
              required
              placeholder="Décrivez votre suggestion en détail…"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={suggLoading || !suggestion.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {suggLoading ? "Envoi…" : "Envoyer la suggestion"}
            </button>
            {suggStatus && (
              <span className={`text-sm ${suggStatus.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {suggStatus.msg}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
