"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bail } from "@/lib/types";
import { getBaux } from "@/lib/store";

export default function ContratsPage() {
  const [baux, setBaux] = useState<Bail[]>([]);

  useEffect(() => {
    setBaux(getBaux());
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bail et contrats</h1>

      {baux.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          <p className="text-lg mb-2">Aucun bail enregistré.</p>
          <Link href="/baux/nouveau" className="text-blue-600 hover:underline">
            Créer un bail
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {baux.map((bail) => (
            <Link
              key={bail.id}
              href={`/contrats/${bail.id}`}
              className="bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow border border-transparent hover:border-blue-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="bg-blue-100 text-blue-700 rounded-lg p-2 text-xl">📝</div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${bail.locataire.en_place ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {bail.locataire.en_place ? "En cours" : "Terminé"}
                </span>
              </div>
              <p className="font-semibold text-gray-800">{bail.logement.adresse}</p>
              <p className="text-sm text-gray-500">{bail.logement.code_postal} {bail.logement.ville}</p>
              {bail.locataire.nom && (
                <p className="text-sm text-gray-600 mt-2">
                  {bail.locataire.prenom} {bail.locataire.nom.toUpperCase()}
                </p>
              )}
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-gray-500">
                <span>📄 Contrat de bail</span>
                <span>🤝 Cautionnement</span>
                <span>🔑 État des lieux</span>
                <span>💰 Dépôt garantie</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
