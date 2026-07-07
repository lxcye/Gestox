"use client";

import { useState } from "react";
import SignaturePad from "./SignaturePad";

interface SignatureSelectorProps {
  signatureEnregistree: string | null;
  signatureActive: string | null;
  onSignatureChange: (dataUrl: string | null) => void;
}

/**
 * Affiche la signature propriétaire enregistrée avec :
 * - bouton "Utiliser ma signature enregistrée" (si disponible)
 * - option de signer différemment pour ce document (sans écraser la sauvegardée)
 */
export default function SignatureSelector({
  signatureEnregistree,
  signatureActive,
  onSignatureChange,
}: SignatureSelectorProps) {
  const [modeManuel, setModeManuel] = useState(false);

  // Si aucune signature enregistrée : afficher directement le pad
  if (!signatureEnregistree) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-amber-600 font-medium">
          Aucune signature enregistrée — allez dans{" "}
          <a href="/parametres" className="underline hover:text-amber-700">Informations personnelles</a>{" "}
          pour en enregistrer une.
        </p>
        <SignaturePad onSave={onSignatureChange} initialData={signatureActive} />
      </div>
    );
  }

  // Signature enregistrée disponible
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Signature</label>

      {!modeManuel ? (
        <div className="space-y-2">
          {/* Aperçu de la signature enregistrée */}
          <div
            className={`border-2 rounded-lg p-3 bg-gray-50 flex items-center gap-4 cursor-pointer transition-colors ${
              signatureActive === signatureEnregistree
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => onSignatureChange(signatureEnregistree)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signatureEnregistree}
              alt="Signature enregistrée"
              className="max-h-16 object-contain"
            />
            <div className="flex-1">
              {signatureActive === signatureEnregistree ? (
                <span className="text-sm text-blue-600 font-medium">✓ Signature utilisée</span>
              ) : (
                <span className="text-sm text-gray-500">Cliquer pour utiliser cette signature</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setModeManuel(true);
              onSignatureChange(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Signer différemment pour ce document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <SignaturePad onSave={onSignatureChange} initialData={signatureActive} />
          <button
            type="button"
            onClick={() => {
              setModeManuel(false);
              onSignatureChange(signatureEnregistree);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Utiliser ma signature enregistrée
          </button>
        </div>
      )}

      {signatureActive && signatureActive !== signatureEnregistree && !modeManuel && (
        <p className="text-sm text-green-600">✓ Signature personnalisée enregistrée</p>
      )}
    </div>
  );
}
