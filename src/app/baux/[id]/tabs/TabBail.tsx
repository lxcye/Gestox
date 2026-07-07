"use client";

import { useState, useEffect } from "react";
import type { Bail } from "@/lib/types";
import { getParametres, saveBail, getBail } from "@/lib/store";
import SignaturePad from "@/components/SignaturePad";

const TYPES_BAIL = ["Meublé", "Vide", "Étudiant", "Mobilité", "Professionnel", "Autre"];
const SITUATIONS = ["Salarié", "Étudiant", "Indépendant", "Retraité", "Sans emploi", "Autre"];
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getDate()} ${MOIS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

interface Props { bail: Bail; onSave: (b: Bail) => void; }

export default function TabBail({ bail: initialBail, onSave }: Props) {
  const [bail, setBail] = useState(initialBail);
  const [saved, setSaved] = useState(false);
  const p = typeof window !== "undefined" ? getParametres() : null;

  useEffect(() => { setBail(initialBail); }, [initialBail.id]);

  function save() {
    let bailToSave = bail;
    // Si les charges ont changé par rapport à ce qui est stocké, on trace l'historique
    const stored = getBail(bail.id);
    if (stored && stored.finances.charges !== bail.finances.charges) {
      const today = new Date().toISOString().split("T")[0];
      bailToSave = {
        ...bail,
        historique_charges: [
          ...(bail.historique_charges ?? []),
          { id: crypto.randomUUID(), date_effet: today, montant: bail.finances.charges, source: "modification_manuelle" as const },
        ],
      };
    }
    saveBail(bailToSave);
    onSave(bailToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function downloadPDF() {
    import("@/lib/generate-contrats-pdf").then(m => {
      if (p) m.generateBailPDF(bail, p);
    });
  }

  const isVide = bail.contrat.type_bail === "Vide";
  const loyerHC = bail.finances?.loyer_hc ?? 0;
  const plafondMois = isVide ? 1 : 2;
  const plafond = loyerHC * plafondMois;
  const depasse = loyerHC > 0 && bail.contrat.depot_garantie > plafond;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Contrat de bail</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {saved && <span className="text-sm text-green-600 font-medium">✓ Enregistré</span>}
          <button onClick={save} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 font-medium">
            Enregistrer
          </button>
          <button onClick={downloadPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium">
            Télécharger le PDF
          </button>
        </div>
      </div>

      {/* ── Récapitulatif ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {[
          ["Type de bail", bail.contrat.type_bail],
          ["Durée", `${bail.contrat.duree_mois} mois`],
          ["Début", formatDate(bail.contrat.date_debut)],
          ["Loyer HC", `${bail.finances.loyer_hc} €`],
          ["Charges", `${bail.finances.charges} €`],
          ["Dépôt de garantie", `${bail.contrat.depot_garantie} €`],
        ].map(([label, val]) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 border">
            <p className="text-gray-500 text-xs">{label}</p>
            <p className="font-semibold text-gray-800">{val}</p>
          </div>
        ))}
      </div>

      {/* ── Type et dates ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Conditions générales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de bail</label>
            <select value={bail.contrat.type_bail}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, type_bail: e.target.value as typeof bail.contrat.type_bail } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {TYPES_BAIL.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de signature</label>
            <input type="date" value={bail.contrat.date_signature}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, date_signature: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input type="date" value={bail.contrat.date_debut}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, date_debut: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée (mois)</label>
            <input type="number" value={bail.contrat.duree_mois}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, duree_mois: parseInt(e.target.value) || 0 } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input type="date" value={bail.contrat.date_fin}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, date_fin: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={bail.contrat.reconduction_tacite}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, reconduction_tacite: e.target.checked } })}
              className="rounded" />
            <span className="text-sm text-gray-700">Reconduction tacite</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={bail.contrat.indexation_irl}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, indexation_irl: e.target.checked } })}
              className="rounded" />
            <span className="text-sm text-gray-700">Indexation IRL</span>
          </label>
        </div>
      </div>

      {/* ── Loyer et dépôt ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Loyer et dépôt de garantie</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyer hors charges (€)</label>
            <input type="number" step="0.01" value={bail.finances.loyer_hc}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setBail({ ...bail, finances: { ...bail.finances, loyer_hc: v, loyer_total: v + bail.finances.charges } });
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charges (€)</label>
            <input type="number" step="0.01" value={bail.finances.charges}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                setBail({ ...bail, finances: { ...bail.finances, charges: v, loyer_total: bail.finances.loyer_hc + v } });
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyer total</label>
            <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 font-semibold text-blue-600 text-sm">
              {bail.finances.loyer_total.toFixed(2)} €
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dépôt de garantie (€)</label>
          <input type="number" step="0.01" value={bail.contrat.depot_garantie}
            onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, depot_garantie: parseFloat(e.target.value) || 0 } })}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${depasse ? "bg-red-50 border-red-300 text-red-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
          <p className="font-semibold">{depasse ? "⚠ Plafond légal dépassé" : "ℹ Plafond légal applicable"}</p>
          <p>{isVide ? "Logement vide — maximum 1 mois de loyer HC (art. 22, loi 89-462)." : "Logement meublé — maximum 2 mois de loyer HC (art. 22, loi 89-462)."}</p>
          {loyerHC > 0 && <p>Plafond calculé : <strong>{plafond.toFixed(2)} €</strong>{depasse && <span className="ml-2 font-medium"> — excédent : {(bail.contrat.depot_garantie - plafond).toFixed(2)} €</span>}</p>}
        </div>
      </div>

      {/* ── Locataire ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Locataire</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Civilité</label>
            <select value={bail.locataire.civilite ?? "Monsieur"}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, civilite: e.target.value as typeof bail.locataire.civilite } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="Monsieur">Monsieur</option>
              <option value="Madame">Madame</option>
              <option value="Monsieur et Madame">Monsieur et Madame</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Situation</label>
            <select value={bail.locataire.situation}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, situation: e.target.value as typeof bail.locataire.situation } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {SITUATIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input value={bail.locataire.nom}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, nom: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input value={bail.locataire.prenom}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, prenom: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
            <input type="date" value={bail.locataire.date_naissance}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, date_naissance: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
            <input value={bail.locataire.lieu_naissance ?? ""}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, lieu_naissance: e.target.value } })}
              placeholder="Ville, département"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input value={bail.locataire.telephone}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, telephone: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={bail.locataire.email}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, email: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date d'entrée</label>
            <input type="date" value={bail.locataire.date_entree}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, date_entree: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de sortie</label>
            <input type="date" value={bail.locataire.date_sortie}
              onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, date_sortie: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={bail.locataire.en_place}
            onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, en_place: e.target.checked } })}
            className="rounded" />
          <span className="text-sm text-gray-700">Toujours en place</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Garant</label>
          <input value={bail.locataire.garant_nom}
            onChange={e => setBail({ ...bail, locataire: { ...bail.locataire, garant_nom: e.target.value } })}
            placeholder="Nom du garant (optionnel)"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* ── Logement (pour contrat) ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Logement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de pièces principales</label>
            <input value={bail.contrat.nombre_pieces ?? ""}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, nombre_pieces: e.target.value } })}
              placeholder="ex: 3" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination des locaux</label>
            <select value={bail.contrat.destination_locaux ?? "Habitation principale"}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, destination_locaux: e.target.value as typeof bail.contrat.destination_locaux } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="Habitation principale">Usage d'habitation principale</option>
              <option value="Usage mixte professionnel et d'habitation">Usage mixte professionnel et d'habitation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Régime des charges</label>
            <select value={bail.contrat.regime_charges ?? (isVide ? "Provision avec régularisation" : "Forfait")}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, regime_charges: e.target.value as "Forfait" | "Provision avec régularisation" } })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              disabled={isVide}>
              <option value="Forfait">Forfait de charges</option>
              <option value="Provision avec régularisation">Provision avec régularisation annuelle</option>
            </select>
            {isVide && <p className="text-xs text-gray-400 mt-1">Imposé : provision avec régularisation pour un bail vide.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de chauffage</label>
            <select value={bail.logement.mode_chauffage ?? ""}
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, mode_chauffage: e.target.value as typeof bail.logement.mode_chauffage } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— Sélectionner —</option>
              <option value="Individuel">Individuel</option>
              <option value="Collectif">Collectif</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Production d'eau chaude sanitaire</label>
            <select value={bail.logement.mode_eau_chaude ?? ""}
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, mode_eau_chaude: e.target.value as typeof bail.logement.mode_eau_chaude } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— Sélectionner —</option>
              <option value="Individuel">Individuelle</option>
              <option value="Collectif">Collective</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Autres parties du logement</label>
          <input value={bail.logement.annexes ?? ""}
            onChange={e => setBail({ ...bail, logement: { ...bail.logement, annexes: e.target.value } })}
            placeholder="ex : grenier, comble, terrasse, balcon, loggia, jardin, cave, parking…"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Éléments d'équipements du logement</label>
          <input value={bail.logement.equipements_logement ?? ""}
            onChange={e => setBail({ ...bail, logement: { ...bail.logement, equipements_logement: e.target.value } })}
            placeholder="ex : cuisine équipée (four, réfrigérateur, lave-vaisselle), douche, baignoire, WC séparé…"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* ── DPE ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-800">Diagnostic de Performance Énergétique (DPE)</h3>
          {bail.logement.dpe_classe && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              bail.logement.dpe_classe === "G" ? "bg-red-100 border-red-300 text-red-800" :
              bail.logement.dpe_classe === "F" ? "bg-orange-100 border-orange-300 text-orange-800" :
              bail.logement.dpe_classe === "E" ? "bg-amber-100 border-amber-300 text-amber-700" :
              "bg-green-100 border-green-300 text-green-800"
            }`}>
              {bail.logement.dpe_classe === "G" && "⛔ Location interdite depuis le 01/01/2025"}
              {bail.logement.dpe_classe === "F" && "⚠ Location interdite à partir du 01/01/2028"}
              {bail.logement.dpe_classe === "E" && "⚠ Location interdite à partir du 01/01/2034"}
              {(["A","B","C","D"] as const).includes(bail.logement.dpe_classe as never) && "✓ Aucune restriction de location"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Classe énergétique</label>
            <select value={bail.logement.dpe_classe ?? ""}
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, dpe_classe: e.target.value as typeof bail.logement.dpe_classe } })}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-bold ${
                bail.logement.dpe_classe === "A" || bail.logement.dpe_classe === "B" ? "text-green-700 bg-green-50" :
                bail.logement.dpe_classe === "C" || bail.logement.dpe_classe === "D" ? "text-yellow-700 bg-yellow-50" :
                bail.logement.dpe_classe === "E" ? "text-orange-600 bg-orange-50" :
                bail.logement.dpe_classe === "F" || bail.logement.dpe_classe === "G" ? "text-red-700 bg-red-50" : ""
              }`}>
              <option value="">— Sélectionner —</option>
              {["A","B","C","D","E","F","G"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consommation (kWh/m²/an)</label>
            <input value={bail.logement.dpe_conso ?? ""} type="number" min="0"
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, dpe_conso: e.target.value } })}
              placeholder="ex: 210" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Émissions GES (kg CO₂/m²/an)</label>
            <input value={bail.logement.dpe_ges ?? ""} type="number" min="0"
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, dpe_ges: e.target.value } })}
              placeholder="ex: 45" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date du diagnostic</label>
            <input type="date" value={bail.logement.dpe_date ?? ""}
              onChange={e => setBail({ ...bail, logement: { ...bail.logement, dpe_date: e.target.value } })}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* ── IRL ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Indice de Référence des Loyers (IRL)</h3>
          <a href="https://www.insee.fr/fr/statistiques/serie/001515333" target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline">Consulter sur insee.fr ↗</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trimestre de référence</label>
            <select value={bail.contrat.trimestre_irl_reference}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, trimestre_irl_reference: parseInt(e.target.value) } })}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="0">Non défini</option>
              {[1,2,3,4].map(t => <option key={t} value={t}>T{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <input value={bail.contrat.irl_annee ?? ""}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, irl_annee: e.target.value } })}
              placeholder="ex: 2024" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valeur de l'IRL</label>
            <input value={bail.contrat.irl_valeur ?? ""}
              onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, irl_valeur: e.target.value } })}
              placeholder="ex: 143.46" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {/* ── Travaux ── */}
      <div className="border rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-gray-800">Travaux</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Travaux réalisés depuis le dernier contrat</label>
          <textarea value={bail.contrat.travaux_realises ?? ""}
            onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, travaux_realises: e.target.value } })}
            rows={2} placeholder="Nature et montant des travaux effectués (ou 'Néant')" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Travaux que le bailleur s'engage à réaliser</label>
          <textarea value={bail.contrat.travaux_prevus ?? ""}
            onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, travaux_prevus: e.target.value } })}
            rows={2} placeholder="Description des travaux prévus (ou 'Néant')" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
      </div>

      {/* ── Clauses particulières ── */}
      <div className="border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Clauses particulières</h3>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border space-y-1">
          <p className="font-semibold text-gray-700 mb-1">Clauses réglementaires pré-remplies :</p>
          <p>• <strong>Clause résolutoire</strong> — résiliation de plein droit en cas de non-paiement du loyer ou des charges, non-versement du dépôt de garantie, défaut d'assurance ou troubles de jouissance.</p>
          <p>• <strong>Solidarité</strong> — en cas de pluralité de locataires, solidarité entre eux pour le paiement du loyer et des charges.</p>
          <p>• <strong>Obligation d'assurance</strong> — souscription d'une assurance couvrant les risques locatifs obligatoire.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Clauses particulières supplémentaires</label>
          <textarea value={bail.contrat.clauses_particulieres ?? ""}
            onChange={e => setBail({ ...bail, contrat: { ...bail.contrat, clauses_particulieres: e.target.value } })}
            rows={4} placeholder="Saisissez ici les clauses particulières…"
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
      </div>

      {/* ── Clauses résolutoires supplémentaires ── */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Clauses résolutoires supplémentaires</h3>
            <p className="text-xs text-gray-500 mt-0.5">S'ajoutent à la clause résolutoire légale obligatoire (art. 24).</p>
          </div>
          <button onClick={() => setBail({ ...bail, contrat: { ...bail.contrat, clauses_resolutoires: [...(bail.contrat.clauses_resolutoires ?? []), ""] } })}
            className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5">
            + Ajouter
          </button>
        </div>
        {(bail.contrat.clauses_resolutoires ?? []).length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucune clause résolutoire supplémentaire.</p>
        )}
        {(bail.contrat.clauses_resolutoires ?? []).map((clause, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <div className="flex-shrink-0 w-6 h-6 mt-2 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{idx + 1}</div>
            <textarea value={clause} rows={3} placeholder="Rédigez la clause résolutoire supplémentaire…"
              onChange={e => {
                const arr = [...(bail.contrat.clauses_resolutoires ?? [])];
                arr[idx] = e.target.value;
                setBail({ ...bail, contrat: { ...bail.contrat, clauses_resolutoires: arr } });
              }}
              className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none" />
            <button onClick={() => setBail({ ...bail, contrat: { ...bail.contrat, clauses_resolutoires: (bail.contrat.clauses_resolutoires ?? []).filter((_, i) => i !== idx) } })}
              className="flex-shrink-0 mt-2 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        ))}
      </div>

      {/* ── Annexes remises ── */}
      <div className="border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Annexes remises au locataire</h3>
        <div className="space-y-2">
          {(bail.annexes_bail ?? []).map(annexe => (
            <label key={annexe.id} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={annexe.remis}
                onChange={e => setBail({ ...bail, annexes_bail: bail.annexes_bail.map(a => a.id === annexe.id ? { ...a, remis: e.target.checked } : a) })}
                className="mt-0.5 rounded w-4 h-4 shrink-0" />
              <span className={`text-sm ${annexe.remis ? "text-gray-800 font-medium" : "text-gray-500"}`}>{annexe.nom}</span>
            </label>
          ))}
          <button onClick={() => {
            const nom = window.prompt("Nom de l'annexe supplémentaire :");
            if (nom?.trim()) setBail({ ...bail, annexes_bail: [...bail.annexes_bail, { id: crypto.randomUUID(), nom: nom.trim(), remis: true }] });
          }} className="text-sm text-blue-600 hover:underline">+ Ajouter une annexe</button>
        </div>
      </div>

      {/* ── Signatures ── */}
      {(() => {
        if (!p) return null;
        const signataires: { key: string; nom: string; role: string }[] = [];

        // Bailleur principal
        if (p.type_bailleur === "societe") {
          const qualite = p.qualite_signataire === "Autre" ? p.qualite_signataire_autre : p.qualite_signataire;
          signataires.push({
            key: "bailleur",
            nom: `${p.prenom} ${p.nom}`.trim(),
            role: [p.denomination_sociale, qualite].filter(Boolean).join(" — "),
          });
        } else {
          signataires.push({
            key: "bailleur",
            nom: `${p.civilite} ${p.prenom} ${p.nom}`.trim(),
            role: "Bailleur",
          });
        }

        for (const cb of (p.co_bailleurs ?? [])) {
          const qualite = cb.qualite_signataire === "Autre" ? cb.qualite_signataire_autre : cb.qualite_signataire;
          signataires.push({
            key: `cobailleur_${cb.id}`,
            nom: `${cb.civilite} ${cb.prenom} ${cb.nom}`.trim(),
            role: qualite || "Co-bailleur",
          });
        }

        signataires.push({
          key: "locataire",
          nom: `${bail.locataire.civilite ?? ""} ${bail.locataire.prenom} ${bail.locataire.nom}`.trim() || "Locataire",
          role: "Locataire",
        });

        const sigs = bail.signatures_contrat ?? {};

        return (
          <div className="border rounded-xl p-4 space-y-6">
            <h3 className="font-semibold text-gray-800">Signatures du contrat</h3>
            {signataires.map(s => {
              const sig = sigs[s.key];
              return (
                <div key={s.key} className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.nom}</p>
                    <p className="text-xs text-gray-500">{s.role}</p>
                  </div>
                  {sig && (
                    <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sig} alt="Signature" className="max-h-20 object-contain" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-green-600 font-medium">✓ Signature enregistrée</p>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...bail, signatures_contrat: { ...sigs, [s.key]: null } };
                            setBail(updated);
                            saveBail(updated);
                          }}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    {s.key === "bailleur" ? (
                      !sig && (
                        p.signature_proprietaire ? (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...bail, signatures_contrat: { ...sigs, [s.key]: p.signature_proprietaire } };
                              setBail(updated);
                              saveBail(updated);
                            }}
                            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-lg hover:bg-blue-100"
                          >
                            ✍️ Appliquer la signature enregistrée
                          </button>
                        ) : (
                          <p className="text-sm text-amber-600">
                            Aucune signature enregistrée —{" "}
                            <a href="/bailleurs" className="underline hover:text-amber-700">configurer dans Bailleurs</a>
                          </p>
                        )
                      )
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mb-2 font-medium">
                          {sig ? "Remplacer la signature :" : "Ajouter une signature :"}
                        </p>
                        <SignaturePad
                          key={`${s.key}-${sig ? "signed" : "empty"}`}
                          initialData={sig ?? null}
                          onSave={dataUrl => {
                            const updated = { ...bail, signatures_contrat: { ...sigs, [s.key]: dataUrl } };
                            setBail(updated);
                            saveBail(updated);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Actions bas de page */}
      <div className="flex gap-3 pt-2">
        <button onClick={save} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium">
          Enregistrer le contrat
        </button>
        <button onClick={downloadPDF} className="border px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
          Télécharger le PDF
        </button>
      </div>
    </div>
  );
}
