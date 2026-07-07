"use client";

import type { Bail, BailRevisionLoyer, BailRegularisationCharges, LigneCharge } from "@/lib/types";
import { getParametres, savePaiement } from "@/lib/store";
import { generateRevisionLoyerPDF, generateRegularisationChargesPDF } from "@/lib/generate-revision-pdf";
import { useState } from "react";

const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Prélèvement", "Autre"];

interface Props { bail: Bail; onSave: (b: Bail) => void; }

export default function TabFinances({ bail, onSave }: Props) {
  const [revisionSousOnglet, setRevisionSousOnglet] = useState<"loyer" | "charges">("loyer");
  const [irlLoading, setIrlLoading] = useState<string | null>(null);
  const [irlError, setIrlError] = useState<string | null>(null);

  function save(b: Bail) { onSave(b); }

  function upF(field: string, value: string | number) {
    const finances = { ...bail.finances, [field]: value };
    if (field === "loyer_hc" || field === "charges") {
      finances.loyer_total = (field === "loyer_hc" ? (value as number) : finances.loyer_hc) + (field === "charges" ? (value as number) : finances.charges);
    }
    save({ ...bail, finances });
  }

  // ── IRL ──
  function periodeIRL(q: number, y: number) { return `${y}-Q${q}`; }
  function periodeToFrancais(p: string) {
    const map: Record<string, string> = { Q1: "premier trimestre", Q2: "deuxième trimestre", Q3: "troisième trimestre", Q4: "quatrième trimestre" };
    const [y, q] = p.split("-");
    return `${map[q] ?? q} ${y}`;
  }
  function messageJO(q: number) {
    const msgs: Record<number, string> = { 1: "L'IRL du T1 est publié au Journal Officiel en avril.", 2: "L'IRL du T2 est publié en juillet.", 3: "L'IRL du T3 est publié en octobre.", 4: "L'IRL du T4 est publié en janvier de l'année suivante." };
    return msgs[q] ?? "";
  }

  async function fetchIRL(revId: string, periodeNouveau: string, periodeAncien: string) {
    setIrlLoading(revId); setIrlError(null);
    try {
      const res = await fetch("/api/irl");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const { series, error } = await res.json();
      if (error) throw new Error(error);
      const entryNouv = series.find((e: { period: string }) => e.period === periodeNouveau);
      const entryAnc = series.find((e: { period: string }) => e.period === periodeAncien);
      if (!entryNouv) throw new Error(`Indice ${periodeNouveau} non trouvé. Il n'est peut-être pas encore publié.`);
      if (!entryAnc) throw new Error(`Indice ${periodeAncien} non trouvé.`);
      const revisions_loyer = (bail.revisions_loyer || []).map(r => {
        if (r.id !== revId) return r;
        const loyer_max = Math.round(r.ancien_loyer * entryNouv.value / entryAnc.value * 100) / 100;
        return { ...r, indice_nouveau: entryNouv.value, indice_ancien: entryAnc.value, date_jo_irl: entryNouv.dateJO, loyer_max, loyer_choisi: loyer_max };
      });
      save({ ...bail, revisions_loyer });
    } catch (err) { setIrlError(String(err)); }
    finally { setIrlLoading(null); }
  }

  function addRevisionLoyer() {
    const trimestreRef = bail.contrat.trimestre_irl_reference || 2;
    const anneeNouveau = new Date().getFullYear();
    const periodeNouveau = periodeIRL(trimestreRef, anneeNouveau);
    const periodeAncien = periodeIRL(trimestreRef, anneeNouveau - 1);
    const derniereRev = (bail.revisions_loyer || []).at(-1);
    const rev: BailRevisionLoyer = {
      id: crypto.randomUUID(), date_courrier: new Date().toISOString().split("T")[0],
      date_contrat: bail.contrat.date_signature || "", date_effet: "",
      ancien_loyer: derniereRev ? derniereRev.loyer_choisi : bail.finances.loyer_hc,
      indice_ancien: derniereRev ? derniereRev.indice_nouveau : 0, indice_nouveau: 0,
      periode_irl_nouveau: periodeNouveau, periode_irl_ancien: periodeAncien, date_jo_irl: "",
      loyer_max: derniereRev ? derniereRev.loyer_choisi : bail.finances.loyer_hc,
      loyer_choisi: derniereRev ? derniereRev.loyer_choisi : bail.finances.loyer_hc,
    };
    save({ ...bail, revisions_loyer: [...(bail.revisions_loyer || []), rev] });
  }

  function updateRev(revId: string, field: string, value: string | number) {
    const revisions_loyer = (bail.revisions_loyer || []).map(r => {
      if (r.id !== revId) return r;
      const updated = { ...r, [field]: value };
      if (["indice_ancien","indice_nouveau","ancien_loyer"].includes(field) && updated.indice_ancien > 0 && updated.indice_nouveau > 0) {
        updated.loyer_max = Math.round(updated.ancien_loyer * updated.indice_nouveau / updated.indice_ancien * 100) / 100;
        if (updated.loyer_choisi > updated.loyer_max) updated.loyer_choisi = updated.loyer_max;
      }
      if (field === "periode_irl_nouveau") {
        const [annee, q] = (value as string).split("-Q");
        updated.periode_irl_ancien = `${parseInt(annee) - 1}-Q${q}`;
      }
      return updated;
    });
    save({ ...bail, revisions_loyer });
  }

  function deleteRev(revId: string) {
    save({ ...bail, revisions_loyer: (bail.revisions_loyer || []).filter(r => r.id !== revId) });
  }

  function downloadRevPDF(rev: BailRevisionLoyer) {
    const p = getParametres();
    const doc = generateRevisionLoyerPDF(rev, bail, p);
    doc.save(`Revision_loyer_${bail.locataire.nom}_${rev.date_courrier}.pdf`);
    save({ ...bail, finances: { ...bail.finances, loyer_hc: rev.loyer_choisi, loyer_total: rev.loyer_choisi + bail.finances.charges } });
  }

  function addRegularisation() {
    let periodeDebut = "", periodeFin = "";
    if (bail.contrat.date_debut) {
      const d = new Date(bail.contrat.date_debut), today = new Date();
      let anneeDebut = today.getFullYear();
      const anniv = new Date(anneeDebut, d.getMonth(), d.getDate());
      if (anniv > today) anneeDebut--;
      const pad = (n: number) => String(n).padStart(2, "0");
      periodeDebut = `${anneeDebut}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      periodeFin = `${anneeDebut + 1}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const regul: BailRegularisationCharges = {
      id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0],
      periode_debut: periodeDebut, periode_fin: periodeFin,
      quote_part: bail.logement.quote_part ?? "",
      lignes: [
        { id: crypto.randomUUID(), intitule: "Entretien et ménage des parties communes", montant_mensuel_provision: 0, montant_mensuel_reel: 0 },
        { id: crypto.randomUUID(), intitule: "Electricité des parties communes", montant_mensuel_provision: 0, montant_mensuel_reel: 0 },
        { id: crypto.randomUUID(), intitule: "Charges générales", montant_mensuel_provision: 0, montant_mensuel_reel: 0 },
        { id: crypto.randomUUID(), intitule: "Taxe d'ordures ménagères (TEOM)", montant_mensuel_provision: 0, montant_mensuel_reel: 0 },
      ],
      nouvelles_provisions_mensuelles: bail.finances.charges,
      date_effet_nouvelles_provisions: "", paiement_cree: false, provisions_appliquees: false,
    };
    save({ ...bail, regularisations_charges: [...(bail.regularisations_charges || []), regul] });
  }

  function updateRegul(regulId: string, field: string, value: string | number | boolean) {
    save({ ...bail, regularisations_charges: (bail.regularisations_charges || []).map(r => r.id === regulId ? { ...r, [field]: value } : r) });
  }

  function updateLigne(regulId: string, ligneId: string, field: keyof LigneCharge, value: string | number) {
    save({ ...bail, regularisations_charges: (bail.regularisations_charges || []).map(r => r.id !== regulId ? r : { ...r, lignes: r.lignes.map(l => l.id === ligneId ? { ...l, [field]: value } : l) }) });
  }

  function addLigne(regulId: string) {
    save({ ...bail, regularisations_charges: (bail.regularisations_charges || []).map(r => r.id !== regulId ? r : { ...r, lignes: [...r.lignes, { id: crypto.randomUUID(), intitule: "", montant_mensuel_provision: 0, montant_mensuel_reel: 0 }] }) });
  }

  function deleteLigne(regulId: string, ligneId: string) {
    save({ ...bail, regularisations_charges: (bail.regularisations_charges || []).map(r => r.id !== regulId ? r : { ...r, lignes: r.lignes.filter(l => l.id !== ligneId) }) });
  }

  function deleteRegul(regulId: string) {
    save({ ...bail, regularisations_charges: (bail.regularisations_charges || []).filter(r => r.id !== regulId) });
  }

  function preparerProchaineRegul(regul: BailRegularisationCharges) {
    const totalReel = regul.lignes.reduce((s, l) => s + l.montant_mensuel_reel, 0);
    const nouvTotal = regul.nouvelles_provisions_mensuelles;
    const nbLignes = regul.lignes.length;
    let montants: number[];
    if (totalReel === 0 || nbLignes === 0) { const base = Math.floor(nouvTotal / nbLignes); montants = regul.lignes.map(() => base); }
    else { montants = regul.lignes.map(l => Math.floor((l.montant_mensuel_reel / totalReel) * nouvTotal)); }
    const reste = Math.round(nouvTotal) - montants.reduce((s, v) => s + v, 0);
    if (reste > 0) {
      const frac = regul.lignes.map((l, i) => ({ i, f: totalReel === 0 ? 1 / nbLignes : (l.montant_mensuel_reel / totalReel) * nouvTotal - montants[i] }));
      frac.sort((a, b) => b.f - a.f);
      for (let k = 0; k < reste; k++) montants[frac[k % nbLignes].i]++;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const periodeDebut = regul.periode_fin || "";
    let periodeFin = "";
    if (periodeDebut) { const d = new Date(periodeDebut); periodeFin = `${d.getFullYear() + 1}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    const nouvelleRegul: BailRegularisationCharges = {
      id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0],
      periode_debut: periodeDebut, periode_fin: periodeFin, quote_part: regul.quote_part,
      lignes: regul.lignes.map((l, i) => ({ id: crypto.randomUUID(), intitule: l.intitule, montant_mensuel_provision: montants[i], montant_mensuel_reel: 0 })),
      nouvelles_provisions_mensuelles: nouvTotal, date_effet_nouvelles_provisions: "", paiement_cree: false, provisions_appliquees: false,
    };
    save({ ...bail, regularisations_charges: [...(bail.regularisations_charges || []), nouvelleRegul] });
  }

  function appliquerProvisions(regul: BailRegularisationCharges) {
    const nouvellesCharges = regul.nouvelles_provisions_mensuelles;
    const dateEffet = regul.date_effet_nouvelles_provisions || new Date().toISOString().split("T")[0];
    const nouvelleEntree = { id: regul.id, date_effet: dateEffet, montant: nouvellesCharges, source: "regularisation" as const };
    save({
      ...bail,
      finances: { ...bail.finances, charges: nouvellesCharges, loyer_total: bail.finances.loyer_hc + nouvellesCharges },
      regularisations_charges: (bail.regularisations_charges || []).map(r => r.id === regul.id ? { ...r, provisions_appliquees: true } : r),
      historique_charges: [...(bail.historique_charges ?? []), nouvelleEntree],
    });
  }

  function creerPaiementRegul(regul: BailRegularisationCharges) {
    if (!bail.locataire.locataire_id) return;
    const totalProv = regul.lignes.reduce((s, l) => s + l.montant_mensuel_provision * 12, 0);
    const totalReel = regul.lignes.reduce((s, l) => s + l.montant_mensuel_reel * 12, 0);
    const solde = totalReel - totalProv;
    const dateRegul = regul.date || new Date().toISOString().split("T")[0];
    const [annee, mois] = dateRegul.split("-").map(Number);
    const montantLigne = solde < 0 ? -Math.abs(solde) : Math.abs(solde);
    savePaiement({ id: crypto.randomUUID(), locataire_id: bail.locataire.locataire_id, mois, annee, montant_du: montantLigne, montant_paye: montantLigne, date_paiement: dateRegul, mode_paiement: "Autre" as const, commentaire: solde < 0 ? `Régularisation — Trop-perçu : ${Math.abs(solde).toFixed(2)} €` : `Régularisation — Reliquat : ${solde.toFixed(2)} €`, quittance_id: null, created_at: "" });
    updateRegul(regul.id, "paiement_cree", true);
  }

  function downloadRegulPDF(regul: BailRegularisationCharges) {
    const p = getParametres();
    const doc = generateRegularisationChargesPDF(regul, bail, p);
    doc.save(`Regularisation_charges_${bail.locataire.nom}_${regul.date}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* ── Loyer ── */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <h3 className="font-semibold">Loyer et mode de paiement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyer hors charges (€)</label>
            <input type="number" value={bail.finances.loyer_hc} onChange={e => upF("loyer_hc", parseFloat(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Charges (€)</label>
            <input type="number" value={bail.finances.charges} onChange={e => upF("charges", parseFloat(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loyer total</label>
            <div className="w-full border rounded-lg px-3 py-2 bg-gray-50 font-semibold text-blue-600">{bail.finances.loyer_total.toFixed(2)} €</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
            <select value={bail.finances.mode_paiement} onChange={e => upF("mode_paiement", e.target.value)} className="w-full border rounded-lg px-3 py-2">
              {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jour de paiement prévu</label>
            <input value={bail.finances.date_paiement_prevue} onChange={e => upF("date_paiement_prevue", e.target.value)} placeholder="Ex: 5" className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
      </div>

      {/* ── Sous-onglets révisions / charges ── */}
      <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
        <button onClick={() => setRevisionSousOnglet("loyer")} className={`px-4 py-2 text-sm font-medium transition-colors ${revisionSousOnglet === "loyer" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Révision de loyer</button>
        <button onClick={() => setRevisionSousOnglet("charges")} className={`px-4 py-2 text-sm font-medium transition-colors ${revisionSousOnglet === "charges" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Régularisation de charges</button>
      </div>

      {/* ── Révision de loyer ── */}
      {revisionSousOnglet === "loyer" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Révisions de loyer (IRL)</h3>
            <button onClick={addRevisionLoyer} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">+ Nouvelle révision</button>
          </div>
          {irlError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex justify-between">
              <span>{irlError}</span>
              <button onClick={() => setIrlError(null)} className="text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          )}
          {(bail.revisions_loyer || []).length === 0 && <p className="text-gray-500 text-sm">Aucune révision enregistrée.</p>}
          {(bail.revisions_loyer || []).map(rev => {
            const augMax = (rev.loyer_max - rev.ancien_loyer).toFixed(2);
            const augChoisie = (rev.loyer_choisi - rev.ancien_loyer).toFixed(2);
            const appliqueMax = Math.abs(rev.loyer_choisi - rev.loyer_max) < 0.01;
            const trimestreNum = parseInt(rev.periode_irl_nouveau?.split("-Q")[1] || "0");
            return (
              <div key={rev.id} className="border rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[["Date du courrier", rev.date_courrier, "date_courrier"], ["Date du contrat de bail", rev.date_contrat, "date_contrat"], ["Date d'effet", rev.date_effet, "date_effet"]].map(([label, val, field]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input type="date" value={val} onChange={e => updateRev(rev.id, field, e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Période IRL à appliquer</p>
                      <div className="flex gap-2 items-center flex-wrap">
                        <select value={rev.periode_irl_nouveau || ""} onChange={e => updateRev(rev.id, "periode_irl_nouveau", e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
                          <option value="">-- Choisir --</option>
                          {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).flatMap(y => [1,2,3,4].map(q => { const p = `${y}-Q${q}`; return <option key={p} value={p}>{periodeToFrancais(p)}</option>; }))}
                        </select>
                        <span className="text-xs text-gray-400">→ Ancien : <strong>{rev.periode_irl_ancien || "—"}</strong></span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={() => fetchIRL(rev.id, rev.periode_irl_nouveau, rev.periode_irl_ancien)} disabled={!rev.periode_irl_nouveau || irlLoading === rev.id} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50">
                        {irlLoading === rev.id ? "Récupération..." : "Récupérer l'IRL depuis l'INSEE"}
                      </button>
                      <a href="https://www.insee.fr/fr/statistiques/serie/001515333" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">Voir la série INSEE →</a>
                    </div>
                  </div>
                  {trimestreNum > 0 && (
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-1.5">
                      ℹ️ {messageJO(trimestreNum)}{rev.date_jo_irl && <> — Date JO récupérée : <strong>{rev.date_jo_irl}</strong></>}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[["Loyer actuel (€)", rev.ancien_loyer, "ancien_loyer"], ["Indice IRL ancien", rev.indice_ancien, "indice_ancien"], ["Indice IRL nouveau", rev.indice_nouveau, "indice_nouveau"]].map(([label, val, field]) => (
                    <div key={field as string}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label as string}</label>
                      <input type="number" step="0.01" value={val as number} onChange={e => updateRev(rev.id, field as string, parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Loyer max calculé (€)</label>
                    <div className="w-full border rounded px-2 py-1.5 text-sm bg-blue-50 text-blue-700 font-semibold">{rev.loyer_max.toFixed(2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Loyer choisi (€) {appliqueMax ? <span className="text-green-600">= maximum</span> : <span className="text-gray-400">≤ {rev.loyer_max.toFixed(2)}</span>}</label>
                    <input type="number" step="0.01" value={rev.loyer_choisi} onChange={e => updateRev(rev.id, "loyer_choisi", parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="text-gray-500">Augmentation max : </span><span className="font-medium">+{augMax} €</span>
                    {!appliqueMax && <><span className="mx-3 text-gray-300">|</span><span className="text-gray-500">Choisie : </span><span className="font-medium text-blue-600">+{augChoisie} €</span></>}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => downloadRevPDF(rev)} disabled={!rev.indice_nouveau || !rev.indice_ancien} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Télécharger le courrier PDF</button>
                  <button onClick={() => deleteRev(rev.id)} className="text-red-500 hover:underline text-sm">Supprimer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Régularisation charges ── */}
      {revisionSousOnglet === "charges" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Régularisations de charges locatives</h3>
            <button onClick={addRegularisation} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">+ Nouvelle régularisation</button>
          </div>
          {(bail.regularisations_charges || []).length === 0 && <p className="text-gray-500 text-sm">Aucune régularisation enregistrée.</p>}
          {[...(bail.regularisations_charges || [])].sort((a, b) => b.date.localeCompare(a.date)).map(regul => {
            const totalProv = regul.lignes.reduce((s, l) => s + l.montant_mensuel_provision * 12, 0);
            const totalReel = regul.lignes.reduce((s, l) => s + l.montant_mensuel_reel * 12, 0);
            const solde = totalReel - totalProv;
            return (
              <div key={regul.id} className="border rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[["Date du courrier","date","date"],["Période début","periode_debut","date"],["Période fin","periode_fin","date"]].map(([label,field,type]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input type={type} value={(regul as never)[field]} onChange={e => updateRegul(regul.id, field, e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quote-part copropriété</label>
                    <input value={regul.quote_part} onChange={e => updateRegul(regul.id, "quote_part", e.target.value)} placeholder="ex: 152/1000" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs font-semibold text-gray-500 border-b"><th className="text-left py-1 px-1">Intitulé</th><th className="text-right py-1 px-1">Prov./mois</th><th className="text-right py-1 px-1">Prov./an</th><th className="text-right py-1 px-1">Réel/mois</th><th className="text-right py-1 px-1">Réel/an</th><th className="w-6"></th></tr></thead>
                    <tbody>
                      {regul.lignes.map(ligne => (
                        <tr key={ligne.id} className="border-b last:border-0">
                          <td className="py-1 px-1"><input value={ligne.intitule} onChange={e => updateLigne(regul.id, ligne.id, "intitule", e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></td>
                          <td className="py-1 px-1"><input type="number" step="0.01" value={ligne.montant_mensuel_provision} onChange={e => updateLigne(regul.id, ligne.id, "montant_mensuel_provision", parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm text-right" /></td>
                          <td className="py-1 px-1 text-right text-gray-500">{(ligne.montant_mensuel_provision * 12).toFixed(2)}</td>
                          <td className="py-1 px-1"><input type="number" step="0.01" value={ligne.montant_mensuel_reel} onChange={e => updateLigne(regul.id, ligne.id, "montant_mensuel_reel", parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1 text-sm text-right" /></td>
                          <td className="py-1 px-1 text-right text-gray-500">{(ligne.montant_mensuel_reel * 12).toFixed(2)}</td>
                          <td className="py-1 px-1 text-center"><button onClick={() => deleteLigne(regul.id, ligne.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={() => addLigne(regul.id)} className="text-blue-600 hover:underline text-sm mt-2">+ Ajouter une ligne</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-gray-500 text-xs">Total provisions annuelles</p><p className="font-semibold">{totalProv.toFixed(2)} €</p></div>
                  <div><p className="text-gray-500 text-xs">Total réel annuel</p><p className="font-semibold">{totalReel.toFixed(2)} €</p></div>
                  <div><p className="text-gray-500 text-xs">Solde</p><p className={`font-bold text-base ${solde > 0 ? "text-red-600" : solde < 0 ? "text-blue-600" : "text-gray-600"}`}>{solde > 0 ? `+${solde.toFixed(2)} €` : `${solde.toFixed(2)} €`}</p><p className="text-xs text-gray-400">{solde > 0 ? "Complément dû par le locataire" : solde < 0 ? "Trop-perçu à rembourser" : "Aucun solde"}</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nouvelles provisions mensuelles (€)</label>
                    <input type="number" step="0.01" value={regul.nouvelles_provisions_mensuelles} onChange={e => updateRegul(regul.id, "nouvelles_provisions_mensuelles", parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date d'effet nouvelles provisions</label>
                    <input type="date" value={regul.date_effet_nouvelles_provisions} onChange={e => updateRegul(regul.id, "date_effet_nouvelles_provisions", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-1 items-center">
                  <button onClick={() => downloadRegulPDF(regul)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">Télécharger le courrier PDF</button>
                  {bail.locataire.locataire_id && solde !== 0 && (regul.paiement_cree ? <span className="text-sm text-green-600">✓ Ligne créée dans le registre</span> : <button onClick={() => creerPaiementRegul(regul)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700">{solde > 0 ? "Créer la dette dans le registre" : "Créer le crédit dans le registre"}</button>)}
                  {regul.nouvelles_provisions_mensuelles > 0 && (regul.provisions_appliquees ? <><span className="text-sm text-green-600">✓ Provisions mises à jour</span><button onClick={() => preparerProchaineRegul(regul)} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-purple-700">Préparer la prochaine régularisation</button></> : <button onClick={() => appliquerProvisions(regul)} className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-orange-600">Appliquer les nouvelles provisions ({regul.nouvelles_provisions_mensuelles.toFixed(2)} €)</button>)}
                  <button onClick={() => deleteRegul(regul.id)} className="text-red-500 hover:underline text-sm ml-auto">Supprimer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
