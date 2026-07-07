"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Quittance, Locataire } from "@/lib/types";
import { getQuittances, getLocataires, deleteQuittance, getParametres, getPaiements, savePaiement } from "@/lib/store";
import { generateQuittancePDF } from "@/lib/generate-pdf";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function QuittancesPage() {
  const [quittances, setQuittances] = useState<Quittance[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);

  useEffect(() => {
    setQuittances(getQuittances().sort((a, b) => {
      if (a.annee !== b.annee) return b.annee - a.annee;
      return b.mois - a.mois;
    }));
    setLocataires(getLocataires());
  }, []);

  function getLocataireNom(id: string): string {
    const loc = locataires.find((l) => l.id === id);
    return loc ? `${loc.prenom} ${loc.nom.toUpperCase()}` : "Inconnu";
  }

  function getLocataire(id: string): Locataire | undefined {
    return locataires.find((l) => l.id === id);
  }

  function handleDownload(q: Quittance) {
    const loc = getLocataire(q.locataire_id);
    if (!loc) return;
    const params = getParametres();
    const doc = generateQuittancePDF(q, loc, params);
    doc.save(`Quittance_${MOIS_FR[q.mois - 1]}_${q.annee}_${loc.nom}.pdf`);
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette quittance ? Le paiement associé sera conservé mais délié.")) return;
    deleteQuittance(id);
    // Délie tout paiement lié à cette quittance
    const paies = getPaiements().filter(p => p.quittance_id === id);
    for (const p of paies) savePaiement({ ...p, quittance_id: null });
    setQuittances(getQuittances());
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quittances</h1>
        <Link
          href="/quittances/nouvelle"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nouvelle quittance
        </Link>
      </div>

      <div className="space-y-3">
        {quittances.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            Aucune quittance émise.
          </div>
        ) : (
          quittances.map((q) => (
            <div key={q.id} className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {MOIS_FR[q.mois - 1]} {q.annee} - {getLocataireNom(q.locataire_id)}
                </p>
                <p className="text-sm text-gray-500">
                  Loyer : {q.loyer} € + {q.charges} € = {q.loyer + q.charges} €
                </p>
                <p className="text-xs text-gray-400">
                  {q.signature_data ? "✓ Signée" : "✗ Non signée"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(q)}
                  className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
                >
                  Télécharger PDF
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
