"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Locataire, Quittance } from "@/lib/types";
import { getLocataires, getParametres, saveQuittance, getBaux } from "@/lib/store";
import { generateQuittancePDF } from "@/lib/generate-pdf";
import SignatureSelector from "@/components/SignatureSelector";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Trouve le jour de paiement prévu dans le bail lié à un locataire
function getJourPaiementBail(locataireId: string): number | null {
  const baux = getBaux();
  const bail = baux.find((b) => b.finances.locataire_id === locataireId);
  if (!bail) return null;
  const jour = parseInt(bail.finances.date_paiement_prevue);
  return isNaN(jour) || jour < 1 || jour > 31 ? null : jour;
}

// Construit une date ISO YYYY-MM-DD pour un mois/année/jour donné
function buildDate(annee: number, mois: number, jour: number): string {
  const maxJour = new Date(annee, mois, 0).getDate();
  const j = Math.min(jour, maxJour);
  return `${annee}-${String(mois).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// ─── Mode quittance unique ────────────────────────────────────────────────────

function ModeUnique({
  locataires, preselectedId, signatureData, signatureEnregistree, onSignatureSaved,
}: {
  locataires: Locataire[];
  preselectedId: string;
  signatureData: string | null;
  signatureEnregistree: string | null;
  onSignatureSaved: (d: string | null) => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(preselectedId);
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [datePaiement, setDatePaiement] = useState("");
  const [loyerOverride, setLoyerOverride] = useState("");
  const [chargesOverride, setChargesOverride] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loc = locataires.find((l) => l.id === selectedId);
  const loyer = loyerOverride !== "" ? parseFloat(loyerOverride) : (loc?.loyer || 0);
  const charges = chargesOverride !== "" ? parseFloat(chargesOverride) : (loc?.charges || 0);

  // Pré-remplissage date de paiement depuis le bail
  useEffect(() => {
    if (!selectedId) return;
    const jour = getJourPaiementBail(selectedId);
    if (jour) setDatePaiement(buildDate(annee, mois, jour));
  }, [selectedId, mois, annee]);

  function buildQ(): Quittance | null {
    if (!loc || !datePaiement) return null;
    const params = getParametres();
    const dernier = new Date(annee, mois, 0).getDate();
    return {
      id: crypto.randomUUID(),
      locataire_id: loc.id,
      proprietaire_id: "1",
      mois, annee, loyer, charges,
      date_paiement: datePaiement,
      date_emission: new Date().toISOString().split("T")[0],
      lieu_emission: params.lieu_signature,
      periode_debut: `${annee}-${String(mois).padStart(2, "0")}-01`,
      periode_fin: `${annee}-${String(mois).padStart(2, "0")}-${dernier}`,
      signature_data: signatureData,
      created_at: "",
    };
  }

  function handlePreview() {
    const q = buildQ();
    if (!q || !loc) return;
    const doc = generateQuittancePDF(q, loc, getParametres());
    setPreviewUrl(URL.createObjectURL(doc.output("blob")));
  }

  function handleSave() {
    const q = buildQ();
    if (!q || !loc) return;
    saveQuittance(q);
    const doc = generateQuittancePDF(q, loc, getParametres());
    doc.save(`Quittance_${MOIS_FR[mois - 1]}_${annee}_${loc.nom}.pdf`);
    router.push("/quittances");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        {/* Locataire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Locataire</label>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setLoyerOverride(""); setChargesOverride(""); }}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">-- Sélectionner --</option>
            {locataires.map((l) => (
              <option key={l.id} value={l.id}>{l.prenom} {l.nom.toUpperCase()} — {l.adresse_location}</option>
            ))}
          </select>
        </div>

        {loc && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
                <select value={mois} onChange={(e) => setMois(parseInt(e.target.value))} className="w-full border rounded-lg px-3 py-2">
                  {MOIS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                <input type="number" value={annee} onChange={(e) => setAnnee(parseInt(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loyer (€)</label>
                <input type="number" step="0.01"
                  value={loyerOverride !== "" ? loyerOverride : loc.loyer}
                  onChange={(e) => setLoyerOverride(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" />
                {loyerOverride !== "" && (
                  <button type="button" onClick={() => setLoyerOverride("")} className="text-xs text-blue-600 mt-1">
                    Rétablir ({loc.loyer} €)
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charges (€)</label>
                <input type="number" step="0.01"
                  value={chargesOverride !== "" ? chargesOverride : loc.charges}
                  onChange={(e) => setChargesOverride(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" />
                {chargesOverride !== "" && (
                  <button type="button" onClick={() => setChargesOverride("")} className="text-xs text-blue-600 mt-1">
                    Rétablir ({loc.charges} €)
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">
                Total : <span className="text-lg font-bold text-blue-600">{(loyer + charges).toFixed(2)} €</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date du paiement
                {getJourPaiementBail(selectedId) && (
                  <span className="ml-2 text-xs text-blue-500">(pré-remplie depuis le bail)</span>
                )}
              </label>
              <input type="date" value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                className="w-full border rounded-lg px-3 py-2" />
            </div>

            <SignatureSelector
              signatureEnregistree={signatureEnregistree}
              signatureActive={signatureData}
              onSignatureChange={onSignatureSaved}
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={handlePreview} disabled={!datePaiement}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                Aperçu PDF
              </button>
              <button onClick={handleSave} disabled={!datePaiement || !signatureData}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                Enregistrer et télécharger
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-3">Aperçu</h2>
        {previewUrl ? (
          <iframe src={previewUrl} className="w-full h-[600px] border rounded-lg" title="Aperçu" />
        ) : (
          <div className="h-[600px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400">
            Cliquez sur "Aperçu PDF"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sélecteur multi-mois ─────────────────────────────────────────────────────

interface MoisSelectionne {
  mois: number;
  annee: number;
  datePaiement: string;
  statut: "en attente" | "généré" | "erreur";
}

function SelecteurMois({
  selection,
  onChange,
  jourPaiement,
}: {
  selection: MoisSelectionne[];
  onChange: (s: MoisSelectionne[]) => void;
  jourPaiement: number | null;
}) {
  const aujourd_hui = new Date();
  const anneeActuelle = aujourd_hui.getFullYear();
  const moisActuel = aujourd_hui.getMonth() + 1;
  // Affiche les 3 dernières années (année courante incluse), jamais le futur
  const annees = [anneeActuelle - 2, anneeActuelle - 1, anneeActuelle];
  const [open, setOpen] = useState(false);

  function isFuture(mois: number, annee: number) {
    return annee > anneeActuelle || (annee === anneeActuelle && mois > moisActuel);
  }

  function isSelected(mois: number, annee: number) {
    return selection.some((s) => s.mois === mois && s.annee === annee);
  }

  function toggle(mois: number, annee: number) {
    if (isFuture(mois, annee)) return;
    if (isSelected(mois, annee)) {
      onChange(selection.filter((s) => !(s.mois === mois && s.annee === annee)));
    } else {
      const dp = jourPaiement ? buildDate(annee, mois, jourPaiement) : "";
      const nouvelleSel = [
        ...selection,
        { mois, annee, datePaiement: dp, statut: "en attente" as const },
      ];
      // Trier par ordre chronologique
      nouvelleSel.sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
      onChange(nouvelleSel);
    }
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Mois à inclure
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border rounded-lg px-3 py-2 text-left bg-white flex items-center justify-between"
      >
        <span className={selection.length === 0 ? "text-gray-400" : "text-gray-800"}>
          {selection.length === 0
            ? "Sélectionner des mois..."
            : selection.map((s) => `${MOIS_FR[s.mois - 1].slice(0, 3)} ${s.annee}`).join(", ")}
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg p-4 space-y-4">
          {annees.map((annee) => (
            <div key={annee}>
              <p className="text-sm font-semibold text-gray-600 mb-2">{annee}</p>
              <div className="grid grid-cols-4 gap-2">
                {MOIS_FR.map((nom, i) => {
                  const m = i + 1;
                  const sel = isSelected(m, annee);
                  const futur = isFuture(m, annee);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(m, annee)}
                      disabled={futur}
                      title={futur ? "Mois futur — impossible" : undefined}
                      className={`px-2 py-1.5 rounded-lg text-sm transition-colors ${
                        futur
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                          : sel
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {nom.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-center text-sm text-blue-600 hover:underline mt-2"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mode plusieurs mois ──────────────────────────────────────────────────────

function ModePlusieurssMois({
  locataires, signatureData, signatureEnregistree, onSignatureSaved,
}: {
  locataires: Locataire[];
  signatureData: string | null;
  signatureEnregistree: string | null;
  onSignatureSaved: (d: string | null) => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [selection, setSelection] = useState<MoisSelectionne[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const loc = locataires.find((l) => l.id === selectedId);
  const jourPaiement = selectedId ? getJourPaiementBail(selectedId) : null;

  // Réinitialiser la sélection si on change de locataire
  function handleLocataireChange(id: string) {
    setSelectedId(id);
    setSelection([]);
    setPreviewUrl(null);
    setDone(false);
  }

  function updateDatePaiement(idx: number, val: string) {
    const newSel = [...selection];
    newSel[idx] = { ...newSel[idx], datePaiement: val };
    setSelection(newSel);
  }

  function buildQuittanceForIndex(idx: number): Quittance | null {
    if (!loc) return null;
    const item = selection[idx];
    const params = getParametres();
    const dernier = new Date(item.annee, item.mois, 0).getDate();
    return {
      id: crypto.randomUUID(),
      locataire_id: loc.id,
      proprietaire_id: "1",
      mois: item.mois,
      annee: item.annee,
      loyer: loc.loyer,
      charges: loc.charges,
      date_paiement: item.datePaiement,
      date_emission: dateEmission,
      lieu_emission: params.lieu_signature,
      periode_debut: `${item.annee}-${String(item.mois).padStart(2, "0")}-01`,
      periode_fin: `${item.annee}-${String(item.mois).padStart(2, "0")}-${dernier}`,
      signature_data: signatureData,
      created_at: "",
    };
  }

  function handlePreview(idx: number) {
    const q = buildQuittanceForIndex(idx);
    if (!q || !loc) return;
    const doc = generateQuittancePDF(q, loc, getParametres());
    setPreviewUrl(URL.createObjectURL(doc.output("blob")));
    setPreviewIndex(idx);
  }

  async function handleGenererTout() {
    if (!loc || !signatureData) return;
    setGenerating(true);

    for (let i = 0; i < selection.length; i++) {
      const item = selection[i];
      if (!item.datePaiement) {
        setSelection((prev) => prev.map((s, j) => j === i ? { ...s, statut: "erreur" } : s));
        continue;
      }
      const q = buildQuittanceForIndex(i);
      if (!q) continue;
      q.id = crypto.randomUUID();
      saveQuittance(q);
      const doc = generateQuittancePDF(q, loc, getParametres());
      doc.save(`Quittance_${MOIS_FR[item.mois - 1]}_${item.annee}_${loc.nom}.pdf`);
      setSelection((prev) => prev.map((s, j) => j === i ? { ...s, statut: "généré" } : s));
      await new Promise((r) => setTimeout(r, 300));
    }

    setGenerating(false);
    setDone(true);
  }

  const nbSansDate = selection.filter((s) => !s.datePaiement).length;
  const nbErreurs = selection.filter((s) => s.statut === "erreur").length;

  return (
    <div className="space-y-6">
      {/* Locataire + date d'émission */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locataire</label>
            <select
              value={selectedId}
              onChange={(e) => handleLocataireChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">-- Sélectionner --</option>
              {locataires.map((l) => (
                <option key={l.id} value={l.id}>{l.prenom} {l.nom.toUpperCase()} — {l.adresse_location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date d'émission <span className="text-gray-400 text-xs">(commune à toutes les quittances)</span>
            </label>
            <input
              type="date"
              value={dateEmission}
              onChange={(e) => setDateEmission(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {loc && (
          <>
            <SelecteurMois
              selection={selection}
              onChange={setSelection}
              jourPaiement={jourPaiement}
            />

            {jourPaiement && (
              <p className="text-xs text-blue-500">
                Dates de paiement pré-remplies au {jourPaiement} de chaque mois (depuis le bail)
              </p>
            )}

            <SignatureSelector
              signatureEnregistree={signatureEnregistree}
              signatureActive={signatureData}
              onSignatureChange={onSignatureSaved}
            />
            {signatureData && (
              <p className="text-sm text-green-600">✓ Signature appliquée à toutes les quittances</p>
            )}
          </>
        )}
      </div>

      {/* Tableau des mois sélectionnés */}
      {selection.length > 0 && loc && (
        <div className="bg-white rounded-xl shadow">
          <div className="px-6 py-4 border-b">
            <p className="font-semibold">
              {selection.length} quittance{selection.length > 1 ? "s" : ""} à générer
              — {loc.prenom} {loc.nom.toUpperCase()}
            </p>
            <p className="text-sm text-gray-500">
              Loyer : {loc.loyer} € + {loc.charges} € de charges = {(loc.loyer + loc.charges).toFixed(2)} € / mois
            </p>
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="px-5 py-3 font-medium">Mois</th>
                  <th className="px-5 py-3 font-medium">Loyer</th>
                  <th className="px-5 py-3 font-medium">
                    Date de paiement
                    <span className="text-xs text-gray-400 ml-1">(modifiable)</span>
                  </th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Aperçu</th>
                </tr>
              </thead>
              <tbody>
                {selection.map((item, idx) => (
                  <tr key={`${item.mois}-${item.annee}`} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">
                      {MOIS_FR[item.mois - 1]} {item.annee}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {(loc.loyer + loc.charges).toFixed(2)} €
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="date"
                        value={item.datePaiement}
                        onChange={(e) => updateDatePaiement(idx, e.target.value)}
                        className={`border rounded px-2 py-1.5 text-sm w-40 ${
                          item.statut === "erreur" ? "border-red-400 bg-red-50" : ""
                        }`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      {item.statut === "généré" && (
                        <span className="text-xs text-green-600 font-medium">✓ Généré</span>
                      )}
                      {item.statut === "erreur" && (
                        <span className="text-xs text-red-600 font-medium">⚠ Date manquante</span>
                      )}
                      {item.statut === "en attente" && (
                        <span className="text-xs text-gray-400">En attente</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handlePreview(idx)}
                        disabled={!signatureData}
                        className="text-blue-600 hover:underline text-xs disabled:opacity-40"
                      >
                        {previewIndex === idx ? "Actualisé" : "Aperçu"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y">
            {selection.map((item, idx) => (
              <div key={`${item.mois}-${item.annee}`} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{MOIS_FR[item.mois - 1]} {item.annee}</span>
                  {item.statut === "généré" && <span className="text-xs text-green-600">✓ Généré</span>}
                  {item.statut === "erreur" && <span className="text-xs text-red-600">⚠ Date manquante</span>}
                </div>
                <div>
                  <label className="text-xs text-gray-500">Date de paiement</label>
                  <input type="date" value={item.datePaiement}
                    onChange={(e) => updateDatePaiement(idx, e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
                </div>
                <button onClick={() => handlePreview(idx)} disabled={!signatureData}
                  className="text-blue-600 hover:underline text-xs disabled:opacity-40">
                  Aperçu PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone aperçu */}
      {previewUrl && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-3">
            Aperçu — {previewIndex !== null ? `${MOIS_FR[selection[previewIndex].mois - 1]} ${selection[previewIndex].annee}` : ""}
          </h2>
          <iframe src={previewUrl} className="w-full h-[600px] border rounded-lg" title="Aperçu" />
        </div>
      )}

      {/* Bouton générer */}
      {selection.length > 0 && loc && (
        done ? (
          <div className="flex gap-3">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 font-medium">
              ✓ {selection.filter((s) => s.statut === "généré").length} quittance{selection.length > 1 ? "s" : ""} générée{selection.length > 1 ? "s" : ""} et téléchargée{selection.length > 1 ? "s" : ""}
              {nbErreurs > 0 && <span className="ml-2 text-orange-600">({nbErreurs} erreur{nbErreurs > 1 ? "s" : ""})</span>}
            </div>
            <button onClick={() => router.push("/quittances")}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700">
              Voir les quittances
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenererTout}
            disabled={generating || !signatureData || nbSansDate > 0}
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {generating
              ? "Génération en cours..."
              : !signatureData
              ? "Signature requise"
              : nbSansDate > 0
              ? `${nbSansDate} date${nbSansDate > 1 ? "s" : ""} de paiement manquante${nbSansDate > 1 ? "s" : ""}`
              : `Générer ${selection.length} quittance${selection.length > 1 ? "s" : ""}`}
          </button>
        )
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function NouvelleQuittanceContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("locataire") || "";

  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [mode, setMode] = useState<"unique" | "plusieurs">("unique");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureEnregistree, setSignatureEnregistree] = useState<string | null>(null);

  useEffect(() => {
    setLocataires(getLocataires().filter((l) => l.actif));
    const sig = getParametres().signature_proprietaire ?? null;
    setSignatureEnregistree(sig);
    // Pré-sélectionner la signature enregistrée si disponible
    if (sig) setSignatureData(sig);
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold">Nouvelle quittance</h1>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setMode("unique")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "unique" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Quittance unique
          </button>
          <button
            onClick={() => setMode("plusieurs")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "plusieurs" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Plusieurs mois
          </button>
        </div>
      </div>

      {mode === "unique" ? (
        <ModeUnique
          locataires={locataires}
          preselectedId={preselectedId}
          signatureData={signatureData}
          signatureEnregistree={signatureEnregistree}
          onSignatureSaved={setSignatureData}
        />
      ) : (
        <ModePlusieurssMois
          locataires={locataires}
          signatureData={signatureData}
          signatureEnregistree={signatureEnregistree}
          onSignatureSaved={setSignatureData}
        />
      )}
    </div>
  );
}

export default function NouvelleQuittancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Chargement...</div>}>
      <NouvelleQuittanceContent />
    </Suspense>
  );
}
