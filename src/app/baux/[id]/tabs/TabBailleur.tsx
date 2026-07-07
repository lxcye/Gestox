"use client";

import Link from "next/link";
import { getParametres } from "@/lib/store";

export default function TabBailleur() {
  const p = typeof window !== "undefined" ? getParametres() : null;

  if (!p) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Informations bailleur</h2>
        <Link href="/bailleurs" className="text-sm text-blue-600 hover:underline">
          Modifier →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoField label="Civilité" value={p.civilite} />
        <InfoField label="Nom" value={`${p.prenom} ${p.nom}`} />
        <InfoField label="Adresse" value={p.adresse} />
        <InfoField label="Code postal / Ville" value={`${p.code_postal} ${p.ville}`} />
        <InfoField label="Téléphone" value={p.telephone} />
        <InfoField label="Email" value={p.email} />
        <InfoField label="Lieu de signature" value={p.lieu_signature} />
      </div>

      {p.signature_proprietaire && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Signature enregistrée</p>
          <img src={p.signature_proprietaire} alt="Signature" className="border rounded-lg max-h-20 object-contain" />
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border">
        {value || <span className="text-gray-400 italic">Non renseigné</span>}
      </p>
    </div>
  );
}
