"use client";

import Link from "next/link";
import type { Bail } from "@/lib/types";

interface Props { bail: Bail; onSave: (b: Bail) => void; }

export default function TabRegistres({ bail, onSave: _onSave }: Props) {
  return (
    <div className="space-y-6">
      {/* Registre des paiements */}
      {bail.locataire.locataire_id && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Registre des paiements</h3>
              <p className="text-sm text-gray-500 mt-0.5">Historique des loyers, paiements et soldes.</p>
            </div>
            <Link href={`/locataires/${bail.locataire.locataire_id}/registre`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
              Ouvrir le registre →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
