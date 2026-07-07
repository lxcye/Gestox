"use client";

import { useEffect, useRef, useState } from "react";
import type { Parametres, BailleurSignataire } from "@/lib/types";
import { getParametres, saveParametres } from "@/lib/store";
import SignaturePad from "@/components/SignaturePad";

type ModeSaisie = "dessiner" | "importer";

const FORMES_JURIDIQUES = [
  "SCI",
  "SARL de famille",
  "SAS ou SARL",
  "Société d'investissement immobilier",
  "SEM",
] as const;

export default function BailleursPage() {
  const [params, setParams] = useState<Parametres | null>(null);
  const [saved, setSaved] = useState(false);
  const [sigSaved, setSigSaved] = useState(false);
  const [modeSaisie, setModeSaisie] = useState<ModeSaisie>("dessiner");
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setParams(getParametres());
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function update(field: keyof Parametres, value: any) {
    if (!params) return;
    setParams({ ...params, [field]: value });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!params) return;
    saveParametres(params);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function saveSignature(dataUrl: string) {
    if (!params) return;
    const updated = { ...params, signature_proprietaire: dataUrl };
    saveParametres(updated);
    setParams(updated);
    setSigSaved(true);
    setTimeout(() => setSigSaved(false), 3000);
  }

  function handleDeleteSignature() {
    if (!params) return;
    const updated = { ...params, signature_proprietaire: null };
    saveParametres(updated);
    setParams(updated);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErreurImport(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErreurImport("Le fichier doit être une image (PNG, JPG, etc.)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErreurImport("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      saveSignature(ev.target?.result as string);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  if (!params) return null;

  const isSociete = params.type_bailleur === "societe";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bailleur</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

        {/* Type de bailleur */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Type de bailleur</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update("type_bailleur", "particulier")}
              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                !isSociete
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              Particulier
            </button>
            <button
              type="button"
              onClick={() => update("type_bailleur", "societe")}
              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                isSociete
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              Société
            </button>
          </div>
        </div>

        {/* Identité */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {isSociete ? "Informations de la société" : "Informations du propriétaire"}
          </h2>

          {isSociete ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forme juridique</label>
                  <select
                    value={params.forme_juridique}
                    onChange={e => update("forme_juridique", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">— Choisir —</option>
                    {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dénomination sociale</label>
                  <input
                    value={params.denomination_sociale}
                    onChange={e => update("denomination_sociale", e.target.value)}
                    placeholder="Ex : SCI Dupont"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du siège social</label>
                <input
                  value={params.adresse_siege}
                  onChange={e => update("adresse_siege", e.target.value)}
                  placeholder="Adresse complète du siège"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
                  <input
                    value={params.siret}
                    onChange={e => update("siret", e.target.value)}
                    placeholder="14 chiffres"
                    maxLength={14}
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qualité du signataire</label>
                  <select
                    value={params.qualite_signataire}
                    onChange={e => update("qualite_signataire", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">— Choisir —</option>
                    <option value="Gérant">Gérant</option>
                    <option value="Président">Président</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              {params.qualite_signataire === "Autre" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Préciser la qualité</label>
                  <input
                    value={params.qualite_signataire_autre}
                    onChange={e => update("qualite_signataire_autre", e.target.value)}
                    placeholder="Ex : Directeur général, Mandataire..."
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Représentant légal (signataire)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Civilité</label>
                    <select
                      value={params.civilite}
                      onChange={e => update("civilite", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="Monsieur">Monsieur</option>
                      <option value="Madame">Madame</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      value={params.nom}
                      onChange={e => update("nom", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input
                      value={params.prenom}
                      onChange={e => update("prenom", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Civilité</label>
                <select
                  value={params.civilite}
                  onChange={e => update("civilite", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Monsieur">Monsieur</option>
                  <option value="Madame">Madame</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  value={params.nom}
                  onChange={e => update("nom", e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  value={params.prenom}
                  onChange={e => update("prenom", e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Signataires supplémentaires */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Signataires supplémentaires</h2>
              <p className="text-sm text-gray-500 mt-0.5">Co-bailleurs ou autres personnes habilitées à signer.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nouveau: BailleurSignataire = {
                  id: crypto.randomUUID(), type_bailleur: params!.type_bailleur,
                  civilite: "Monsieur", nom: "", prenom: "",
                  denomination_sociale: "", forme_juridique: "", adresse_siege: "",
                  siret: "", qualite_signataire: "", qualite_signataire_autre: "",
                  adresse: "", code_postal: "", ville: "", pays: "France", telephone: "", email: "",
                };
                update("co_bailleurs", [...(params!.co_bailleurs ?? []), nouveau]);
              }}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
            >
              + Ajouter
            </button>
          </div>

          {(params?.co_bailleurs ?? []).length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucun signataire supplémentaire.</p>
          )}

          {(params?.co_bailleurs ?? []).map((co, idx) => (
            <div key={co.id} className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Signataire {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => update("co_bailleurs", (params!.co_bailleurs ?? []).filter(c => c.id !== co.id))}
                  className="text-red-500 hover:underline text-sm"
                >
                  Supprimer
                </button>
              </div>

              {/* Qualité — seulement pour société */}
              {isSociete && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Qualité du signataire</label>
                    <select
                      value={co.qualite_signataire}
                      onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, qualite_signataire: e.target.value } : c))}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">— Choisir —</option>
                      <option value="Gérant">Gérant</option>
                      <option value="Président">Président</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  {co.qualite_signataire === "Autre" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Préciser</label>
                      <input
                        value={co.qualite_signataire_autre}
                        onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, qualite_signataire_autre: e.target.value } : c))}
                        placeholder="Ex : Mandataire…"
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Civilité / Nom / Prénom */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Civilité</label>
                  <select
                    value={co.civilite}
                    onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, civilite: e.target.value as "Monsieur" | "Madame" } : c))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                  <input
                    value={co.nom}
                    onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, nom: e.target.value } : c))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prénom</label>
                  <input
                    value={co.prenom}
                    onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, prenom: e.target.value } : c))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Téléphone / Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                  <input
                    value={co.telephone}
                    onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, telephone: e.target.value } : c))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={co.email}
                    onChange={e => update("co_bailleurs", (params!.co_bailleurs ?? []).map(c => c.id === co.id ? { ...c, email: e.target.value } : c))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coordonnées */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Coordonnées</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              value={params.adresse}
              onChange={e => update("adresse", e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input
                value={params.code_postal}
                onChange={e => update("code_postal", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input
                value={params.ville}
                onChange={e => update("ville", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
              <input
                value={params.pays}
                onChange={e => update("pays", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                value={params.telephone}
                onChange={e => update("telephone", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={params.email ?? ""}
                onChange={e => update("email", e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu de signature des quittances
            </label>
            <input
              value={params.lieu_signature}
              onChange={e => update("lieu_signature", e.target.value)}
              required
              placeholder="Ex : Paris"
              className="w-full border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Apparaîtra sur les quittances : "Fait à [lieu], le ..."</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Enregistrer
          </button>
          {saved && <span className="text-green-600 text-sm">Enregistré !</span>}
        </div>
      </form>

      {/* Signature */}
      <div className="bg-white rounded-xl shadow p-6 max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Signature</h2>
          <p className="text-sm text-gray-500 mt-1">
            Proposée par défaut sur toutes les quittances et documents.
          </p>
        </div>

        {params.signature_proprietaire && (
          <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={params.signature_proprietaire} alt="Signature" className="max-h-20 object-contain" />
            <div className="flex-1 space-y-1">
              <p className="text-sm text-green-600 font-medium">✓ Signature enregistrée</p>
              <button type="button" onClick={handleDeleteSignature} className="text-sm text-red-500 hover:underline">
                Supprimer
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600 mb-2 font-medium">
            {params.signature_proprietaire ? "Remplacer la signature :" : "Ajouter une signature :"}
          </p>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit mb-4">
            <button
              type="button"
              onClick={() => setModeSaisie("dessiner")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                modeSaisie === "dessiner" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Dessiner
            </button>
            <button
              type="button"
              onClick={() => setModeSaisie("importer")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                modeSaisie === "importer" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Importer une image
            </button>
          </div>

          {modeSaisie === "dessiner" ? (
            <SignaturePad onSave={saveSignature} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Formats acceptés : PNG, JPG, GIF — max 2 Mo.</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 space-y-1">
                <p className="font-medium">Taille recommandée : <span className="font-semibold">650 × 450 px</span></p>
                <p className="text-blue-600">Pour un rendu optimal, utilisez un PNG avec fond transparent.</p>
              </div>
              <label className="flex items-center justify-center gap-3 w-full border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <span className="text-3xl">📎</span>
                <span className="text-sm text-gray-600">Cliquer pour choisir un fichier</span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              {erreurImport && <p className="text-sm text-red-600">{erreurImport}</p>}
            </div>
          )}

          {sigSaved && <p className="text-sm text-green-600 mt-3">Signature enregistrée !</p>}
        </div>
      </div>
    </div>
  );
}
