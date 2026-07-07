"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Locataire, Quittance, Paiement, Bail } from "@/lib/types";
import {
  getLocataire,
  getQuittancesForLocataire,
  getPaiementsForLocataire,
  getParametres,
  savePaiement,
  deletePaiement,
  deleteQuittance,
  saveQuittance,
  getBaux,
} from "@/lib/store";
import { generateQuittancePDF } from "@/lib/generate-pdf";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Prélèvement", "Autre"];

interface LignePaiement {
  id: string;
  mois: number;
  annee: number;
  montant_du: number;
  montant_paye: number;
  restant_du: number;
  statut: "Payé" | "Partiel" | "Impayé";
  retard: boolean;
  date_paiement: string;
  mode_paiement: string;
  commentaire: string;
  quittance_id: string | null;
  paiement_id: string | null;
}

export default function RegistrePage() {
  const params = useParams();
  const id = params.id as string;

  const [locataire, setLocataire] = useState<Locataire | null>(null);
  const [quittances, setQuittances] = useState<Quittance[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [bail, setBail] = useState<Bail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLigne, setEditLigne] = useState<LignePaiement | null>(null);
  const [periodeStats, setPeriodeStats] = useState<"tout" | "annee" | "precedente">("tout");

  // Champs du panneau d'édition
  const [editMontantDu, setEditMontantDu] = useState("");
  const [editMontantPaye, setEditMontantPaye] = useState("");
  const [editDatePaiement, setEditDatePaiement] = useState("");
  const [editMode, setEditMode] = useState("");
  const [editCommentaire, setEditCommentaire] = useState("");
  const [editMois, setEditMois] = useState(1);
  const [editAnnee, setEditAnnee] = useState(2025);

  function reload() {
    try {
      const loc = getLocataire(id);
      setLocataire(loc ?? null);
      if (loc) {
        setQuittances(getQuittancesForLocataire(id));
        setPaiements(getPaiementsForLocataire(id));
        const bailLie = getBaux().find((b) => b.finances?.locataire_id === id) ?? null;
        setBail(bailLie);
      }
    } catch (e) {
      console.error("Erreur reload registre:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [id]);

  function openEdit(l: LignePaiement) {
    setEditLigne(l);
    setEditMontantDu(l.montant_du.toFixed(2));
    setEditMontantPaye(l.montant_paye.toFixed(2));
    setEditDatePaiement(l.date_paiement);
    setEditMode(l.mode_paiement === "—" ? "Virement" : l.mode_paiement);
    setEditCommentaire(l.commentaire);
    setEditMois(l.mois);
    setEditAnnee(l.annee);
  }

  function closeEdit() {
    setEditLigne(null);
  }

  function handleSaveEdit() {
    if (!editLigne || !locataire) return;
    if (!editDatePaiement) {
      alert("La date du paiement est obligatoire.");
      return;
    }

    // Si un paiement existe déjà, on le met à jour. Sinon on en crée un.
    const paiementId = editLigne.paiement_id || crypto.randomUUID();

    const paiement: Paiement = {
      id: paiementId,
      locataire_id: locataire.id,
      mois: editMois,
      annee: editAnnee,
      montant_du: parseFloat(editMontantDu),
      montant_paye: parseFloat(editMontantPaye),
      date_paiement: editDatePaiement,
      mode_paiement: editMode as Paiement["mode_paiement"],
      commentaire: editCommentaire,
      quittance_id: editLigne.quittance_id,
      created_at: "",
    };

    savePaiement(paiement);
    reload();
    closeEdit();
  }

  function isPaymentLate(datePaiement: string, mois: number, annee: number, jourPrevue: number): boolean {
    if (!datePaiement || !jourPrevue) return false;
    const [py, pm, pd] = datePaiement.split("-").map(Number);
    const paid = new Date(py, pm - 1, pd);
    const expected = new Date(annee, mois - 1, jourPrevue);
    return paid > expected;
  }

  function computeStatut(montant_du: number, montant_paye: number): LignePaiement["statut"] {
    if (montant_du < 0) {
      // Ligne de remboursement (négatif)
      if (montant_paye === montant_du) return "Payé";
      if (montant_paye === 0) return "Impayé";
      return "Partiel";
    }
    const restant = montant_du - montant_paye;
    if (restant <= 0) return "Payé";
    if (montant_paye <= 0) return "Impayé";
    return "Partiel";
  }

  function computeRestant(montant_du: number, montant_paye: number): number {
    if (montant_du < 0) {
      // Pour un remboursement : restant = montant_du - montant_paye (les deux négatifs)
      // Si montant_du=-57 et montant_paye=-57 → restant=0
      // Si montant_du=-57 et montant_paye=0 → restant=-57 (non remboursé)
      return montant_du - montant_paye;
    }
    return Math.max(0, montant_du - montant_paye);
  }

  function buildLignes(): LignePaiement[] {
    const jourPrevue = bail ? parseInt(bail.finances.date_paiement_prevue) || 0 : 0;
    const lignes: LignePaiement[] = [];

    for (const q of quittances) {
      const du = q.loyer + q.charges;
      const pLinked = paiements.find((p) => p.quittance_id === q.id);
      const paye = pLinked ? pLinked.montant_paye : du;
      const datePaiement = pLinked ? pLinked.date_paiement : q.date_paiement;
      const restant = computeRestant(du, paye);

      lignes.push({
        id: q.id, mois: q.mois, annee: q.annee,
        montant_du: du, montant_paye: paye,
        restant_du: restant,
        statut: computeStatut(du, paye),
        retard: isPaymentLate(datePaiement, q.mois, q.annee, jourPrevue),
        date_paiement: datePaiement,
        mode_paiement: pLinked?.mode_paiement || "—",
        commentaire: pLinked?.commentaire || "",
        quittance_id: q.id, paiement_id: pLinked?.id || null,
      });
    }

    for (const p of paiements) {
      if (p.quittance_id) continue;
      const restant = computeRestant(p.montant_du, p.montant_paye);

      lignes.push({
        id: p.id, mois: p.mois, annee: p.annee,
        montant_du: p.montant_du, montant_paye: p.montant_paye,
        restant_du: restant,
        statut: computeStatut(p.montant_du, p.montant_paye),
        retard: isPaymentLate(p.date_paiement, p.mois, p.annee, jourPrevue),
        date_paiement: p.date_paiement,
        mode_paiement: p.mode_paiement,
        commentaire: p.commentaire,
        quittance_id: null, paiement_id: p.id,
      });
    }

    lignes.sort((a, b) => a.annee !== b.annee ? b.annee - a.annee : b.mois - a.mois);

    return lignes;
  }

  function handleDownload(quittanceId: string) {
    if (!locataire) return;
    const q = quittances.find((x) => x.id === quittanceId);
    if (!q) return;
    const p = getParametres();
    const doc = generateQuittancePDF(q, locataire, p);
    doc.save(`Quittance_${MOIS_FR[q.mois - 1]}_${q.annee}_${locataire.nom}.pdf`);
  }

  function handleAddPaiement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!locataire) return;
    const form = new FormData(e.currentTarget);

    const paiement: Paiement = {
      id: crypto.randomUUID(),
      locataire_id: locataire.id,
      mois: parseInt(form.get("mois") as string),
      annee: parseInt(form.get("annee") as string),
      montant_du: parseFloat(form.get("montant_du") as string),
      montant_paye: parseFloat(form.get("montant_paye") as string),
      date_paiement: form.get("date_paiement") as string,
      mode_paiement: form.get("mode_paiement") as Paiement["mode_paiement"],
      commentaire: form.get("commentaire") as string,
      quittance_id: null,
      created_at: "",
    };

    savePaiement(paiement);
    reload();
    setShowForm(false);
  }

  function handleDeletePaiement(paiementId: string) {
    if (confirm("Supprimer cette ligne de paiement ?")) {
      deletePaiement(paiementId);
      reload();
    }
  }

  function handleDeleteQuittance(quittanceId: string, paiementId: string | null) {
    if (!confirm("Supprimer cette quittance ? Le paiement associé sera conservé mais délié.")) return;
    deleteQuittance(quittanceId);
    // Délie le paiement de la quittance (sans supprimer le paiement)
    if (paiementId) {
      const p = paiements.find(x => x.id === paiementId);
      if (p) savePaiement({ ...p, quittance_id: null });
    }
    reload();
  }

  function creerQuittanceDepuisPaiement(l: LignePaiement) {
    if (!locataire) return;
    const p = getParametres();
    const loyerHC = bail?.finances?.loyer_hc ?? l.montant_paye;
    const charges = bail?.finances?.charges ?? 0;

    // Calcul des dates de période (1er au dernier jour du mois)
    const lastDay = new Date(l.annee, l.mois, 0).getDate();
    const periodeDebut = `${l.annee}-${String(l.mois).padStart(2, "0")}-01`;
    const periodeFin = `${l.annee}-${String(l.mois).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const quittanceId = crypto.randomUUID();
    const quittance: Quittance = {
      id: quittanceId,
      locataire_id: locataire.id,
      proprietaire_id: "1",
      mois: l.mois,
      annee: l.annee,
      loyer: loyerHC,
      charges,
      date_paiement: l.date_paiement,
      date_emission: new Date().toISOString().split("T")[0],
      lieu_emission: p.lieu_signature ?? p.ville ?? "",
      periode_debut: periodeDebut,
      periode_fin: periodeFin,
      signature_data: p.signature_proprietaire ?? null,
      created_at: new Date().toISOString(),
    };

    saveQuittance(quittance);

    // Lier le paiement à la quittance
    if (l.paiement_id) {
      savePaiement({
        id: l.paiement_id,
        locataire_id: locataire.id,
        mois: l.mois,
        annee: l.annee,
        montant_du: l.montant_du,
        montant_paye: l.montant_paye,
        date_paiement: l.date_paiement,
        mode_paiement: l.mode_paiement as Paiement["mode_paiement"],
        commentaire: l.commentaire,
        quittance_id: quittanceId,
        created_at: "",
      });
    }

    reload();
    // Télécharger immédiatement le PDF
    const doc = generateQuittancePDF(quittance, locataire, p);
    doc.save(`Quittance_${MOIS_FR[l.mois - 1]}_${l.annee}_${locataire.nom}.pdf`);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Chargement...</div>;
  }

  if (!locataire) {
    return (
      <div className="p-8 text-center text-gray-500">
        Locataire introuvable.
        <br />
        <Link href="/locataires" className="text-blue-600 underline mt-2 inline-block">
          Retour aux locataires
        </Link>
      </div>
    );
  }

  const lignes = buildLignes();
  const totalPaye = lignes.reduce((s, l) => s + l.montant_paye, 0);
  const totalDu = lignes.reduce((s, l) => s + l.montant_du, 0);
  const totalRestant = totalDu - totalPaye;

  const parAnnee: Record<number, LignePaiement[]> = {};
  for (const l of lignes) {
    if (!parAnnee[l.annee]) parAnnee[l.annee] = [];
    parAnnee[l.annee].push(l);
  }
  const annees = Object.keys(parAnnee).map(Number).sort((a, b) => b - a);

  // Statistiques
  const anneeActuelle = new Date().getFullYear();
  const lignesFiltrees = periodeStats === "tout"
    ? lignes
    : periodeStats === "annee"
      ? lignes.filter((l) => l.annee === anneeActuelle)
      : lignes.filter((l) => l.annee === anneeActuelle - 1);
  const statsTotal = lignesFiltrees.length;
  const statsRetards = lignesFiltrees.filter((l) => l.retard).length;
  const statsImpayes = lignesFiltrees.filter((l) => l.statut === "Impayé").length;
  const statsPartiels = lignesFiltrees.filter((l) => l.statut === "Partiel").length;
  const statsPonctuelsComplets = lignesFiltrees.filter((l) => l.statut === "Payé" && !l.retard).length;
  const statsPct = statsTotal > 0 ? Math.round((statsPonctuelsComplets / statsTotal) * 100) : 0;

  function statutBadge(statut: LignePaiement["statut"]) {
    if (statut === "Payé") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Payé</span>;
    }
    if (statut === "Partiel") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Partiel</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Impayé</span>;
  }

  return (
    <div className="relative">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <Link href="/locataires" className="text-sm text-blue-600 hover:underline">
            ← Retour aux locataires
          </Link>
          <h1 className="text-2xl font-bold mt-1">Registre des paiements</h1>
          <p className="text-gray-500">
            {locataire.civilite} {locataire.prenom} {locataire.nom.toUpperCase()} — {locataire.adresse_location}, {locataire.ville_location}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {showForm ? "Annuler" : "+ Ajouter un paiement"}
          </button>
          <Link
            href={`/quittances/nouvelle?locataire=${locataire.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center"
          >
            + Quittance
          </Link>
        </div>
      </div>

      {/* Formulaire ajout paiement manuel */}
      {showForm && (
        <form onSubmit={handleAddPaiement} className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Ajouter un paiement manuellement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
              <select name="mois" defaultValue={new Date().getMonth() + 1} className="w-full border rounded-lg px-3 py-2">
                {MOIS_FR.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
              <input name="annee" type="number" defaultValue={new Date().getFullYear()} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant dû (€) <span className="text-gray-400 font-normal text-xs">négatif = remboursement</span></label>
              <input name="montant_du" type="number" step="0.01" defaultValue={(locataire.loyer + locataire.charges).toFixed(2)} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (€) <span className="text-gray-400 font-normal text-xs">négatif = remboursé</span></label>
              <input name="montant_paye" type="number" step="0.01" defaultValue={(locataire.loyer + locataire.charges).toFixed(2)} required className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date du paiement</label>
              <input name="date_paiement" type="date" required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
              <select name="mode_paiement" className="w-full border rounded-lg px-3 py-2">
                {MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
              <input name="commentaire" className="w-full border rounded-lg px-3 py-2" placeholder="Optionnel" />
            </div>
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
            Enregistrer le paiement
          </button>
        </form>
      )}

      {/* Résumé global */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {/* Statistiques */}
        <div className="bg-white rounded-xl shadow p-4 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Statistiques</p>
            <select
              value={periodeStats}
              onChange={(e) => setPeriodeStats(e.target.value as "tout" | "annee" | "precedente")}
              className="text-xs border rounded px-1.5 py-0.5 text-gray-600"
            >
              <option value="tout">Toutes périodes</option>
              <option value="annee">Cette année</option>
              <option value="precedente">Année précédente</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Retards</span>
              <span className={`font-semibold ${statsRetards > 0 ? "text-yellow-600" : "text-gray-700"}`}>{statsRetards}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Impayés</span>
              <span className={`font-semibold ${statsImpayes > 0 ? "text-red-600" : "text-gray-700"}`}>{statsImpayes}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Partiels</span>
              <span className={`font-semibold ${statsPartiels > 0 ? "text-orange-600" : "text-gray-700"}`}>{statsPartiels}</span>
            </div>
            <div className="pt-1 border-t">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">À temps et complet</span>
                <span className={`font-bold ${statsPct >= 80 ? "text-green-600" : statsPct >= 50 ? "text-orange-500" : "text-red-600"}`}>{statsPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${statsPct >= 80 ? "bg-green-500" : statsPct >= 50 ? "bg-orange-400" : "bg-red-500"}`}
                  style={{ width: `${statsPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Total dû</p>
          <p className="text-2xl font-bold text-gray-800">{totalDu.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Total encaissé</p>
          <p className="text-2xl font-bold text-green-600">{totalPaye.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Solde</p>
          <p className={`text-2xl font-bold ${totalRestant > 0 ? "text-red-600" : totalRestant < 0 ? "text-blue-600" : "text-green-600"}`}>
            {totalRestant === 0 ? "0.00" : (-totalRestant).toFixed(2)} €
          </p>
          {totalRestant > 0 && <p className="text-xs text-red-500 mt-0.5">Restant dû</p>}
          {totalRestant < 0 && <p className="text-xs text-blue-500 mt-0.5">Trop perçu</p>}
          {totalRestant === 0 && <p className="text-xs text-green-500 mt-0.5">Soldé</p>}
        </div>
      </div>

      {/* Tableau par année */}
      {lignes.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Aucun paiement enregistré pour ce locataire.
        </div>
      ) : (
        annees.map((annee) => {
          const ls = parAnnee[annee].sort((a, b) => a.mois - b.mois);
          const totalAnnee = ls.reduce((s, l) => s + l.montant_paye, 0);
          const duAnnee = ls.reduce((s, l) => s + l.montant_du, 0);
          const soldeAnnee = duAnnee - totalAnnee; // positif = encore dû, négatif = trop perçu

          return (
            <div key={annee} className="bg-white rounded-xl shadow mb-6">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold">{annee}</h2>
                <div className="text-sm text-right">
                  <span className="font-semibold text-gray-600">Encaissé : {totalAnnee.toFixed(2)} €</span>
                  {soldeAnnee > 0 && (
                    <span className="ml-3 font-semibold text-red-600">Restant dû : {soldeAnnee.toFixed(2)} €</span>
                  )}
                  {soldeAnnee < 0 && (
                    <span className="ml-3 font-semibold text-blue-600">Trop perçu : {(-soldeAnnee).toFixed(2)} €</span>
                  )}
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="px-4 py-3 font-medium">Mois</th>
                      <th className="px-4 py-3 font-medium">Dû</th>
                      <th className="px-4 py-3 font-medium">Payé</th>
                      <th className="px-4 py-3 font-medium">Restant dû</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Date paiement</th>
                      <th className="px-4 py-3 font-medium">Mode</th>
                      <th className="px-4 py-3 font-medium">Commentaire</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ls.map((l) => {
                      const dpParts = l.date_paiement.split("-");
                      return (
                        <tr key={l.id} className={`border-b last:border-b-0 hover:bg-gray-50 ${l.montant_du < 0 ? "bg-blue-50" : ""}`}>
                          <td className="px-4 py-3 font-medium">{MOIS_FR[l.mois - 1]}</td>
                          <td className={`px-4 py-3 ${l.montant_du < 0 ? "text-blue-600 font-semibold" : ""}`}>{l.montant_du.toFixed(2)} €</td>
                          <td className={`px-4 py-3 ${l.montant_paye < 0 ? "text-blue-600 font-semibold" : ""}`}>{l.montant_paye.toFixed(2)} €</td>
                          <td className={`px-4 py-3 font-semibold ${l.restant_du < 0 ? "text-blue-600" : l.restant_du > 0 ? "text-red-600" : "text-green-600"}`}>
                            {l.restant_du.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3">{statutBadge(l.statut)}</td>
                          <td className="px-4 py-3">
                            <div>{dpParts[2]}/{dpParts[1]}/{dpParts[0]}</div>
                            {l.retard && <div className="text-xs text-red-600 font-medium">Retard</div>}
                          </td>
                          <td className="px-4 py-3">{l.mode_paiement}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate" title={l.commentaire}>
                            {l.commentaire || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => openEdit(l)}
                                className="text-gray-600 hover:underline text-xs"
                              >
                                Modifier
                              </button>
                              {l.quittance_id && (
                                <>
                                  <button
                                    onClick={() => handleDownload(l.quittance_id!)}
                                    className="text-blue-600 hover:underline text-xs"
                                  >
                                    Quittance PDF
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuittance(l.quittance_id!, l.paiement_id)}
                                    className="text-red-600 hover:underline text-xs"
                                  >
                                    Suppr. quittance
                                  </button>
                                </>
                              )}
                              {l.statut === "Payé" && !l.quittance_id && l.montant_du > 0 && (
                                <button
                                  onClick={() => creerQuittanceDepuisPaiement(l)}
                                  className="text-green-600 hover:underline text-xs font-medium"
                                >
                                  + Quittance
                                </button>
                              )}
                              {l.paiement_id && !l.quittance_id && (
                                <button
                                  onClick={() => handleDeletePaiement(l.paiement_id!)}
                                  className="text-red-600 hover:underline text-xs"
                                >
                                  Suppr. paiement
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y">
                {ls.map((l) => {
                  const dpParts = l.date_paiement.split("-");
                  return (
                    <div key={l.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{MOIS_FR[l.mois - 1]}</span>
                        {statutBadge(l.statut)}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-sm">
                        <span className="text-gray-500">Dû : {l.montant_du.toFixed(2)} €</span>
                        <span className="text-gray-800 font-semibold">Payé : {l.montant_paye.toFixed(2)} €</span>
                      </div>
                      {l.restant_du > 0 && (
                        <p className="text-sm text-red-600 font-semibold mt-0.5">
                          Restant dû : {l.restant_du.toFixed(2)} €
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                        <span>
                          {dpParts[2]}/{dpParts[1]}/{dpParts[0]} — {l.mode_paiement}
                          {l.retard && <span className="ml-1 text-red-600 font-medium">· Retard</span>}
                        </span>
                        <div className="flex gap-3 flex-wrap">
                          <button onClick={() => openEdit(l)} className="text-gray-600 hover:underline">
                            Modifier
                          </button>
                          {l.quittance_id && (
                            <>
                              <button onClick={() => handleDownload(l.quittance_id!)} className="text-blue-600 hover:underline">
                                Quittance PDF
                              </button>
                              <button onClick={() => handleDeleteQuittance(l.quittance_id!, l.paiement_id)} className="text-red-600 hover:underline">
                                Suppr. quittance
                              </button>
                            </>
                          )}
                          {l.statut === "Payé" && !l.quittance_id && l.montant_du > 0 && (
                            <button onClick={() => creerQuittanceDepuisPaiement(l)} className="text-green-600 hover:underline font-medium">
                              + Quittance
                            </button>
                          )}
                          {l.paiement_id && !l.quittance_id && (
                            <button onClick={() => handleDeletePaiement(l.paiement_id!)} className="text-red-600 hover:underline">
                              Suppr. paiement
                            </button>
                          )}
                        </div>
                      </div>
                      {l.commentaire && <p className="text-xs text-gray-400 mt-1">{l.commentaire}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Panneau latéral de modification */}
      {editLigne && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={closeEdit}
          />

          {/* Panneau */}
          <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Modifier le paiement</h2>
                <button
                  onClick={closeEdit}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                {MOIS_FR[editLigne.mois - 1]} {editLigne.annee}
                {editLigne.quittance_id && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Quittance liée</span>
                )}
              </div>

              {/* Mois / Année */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
                  <select
                    value={editMois}
                    onChange={(e) => setEditMois(parseInt(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {MOIS_FR.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                  <input
                    type="number"
                    value={editAnnee}
                    onChange={(e) => setEditAnnee(parseInt(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Montant dû */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant dû (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editMontantDu}
                  onChange={(e) => setEditMontantDu(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* Montant payé */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editMontantPaye}
                  onChange={(e) => setEditMontantPaye(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* Restant dû (calculé) */}
              {(() => {
                const restant = parseFloat(editMontantDu || "0") - parseFloat(editMontantPaye || "0");
                return (
                  <div className={`rounded-lg p-3 ${restant > 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <p className="text-sm font-medium">
                      Restant dû :{" "}
                      <span className={`text-lg font-bold ${restant > 0 ? "text-red-600" : "text-green-600"}`}>
                        {Math.max(0, restant).toFixed(2)} €
                      </span>
                    </p>
                  </div>
                );
              })()}

              {/* Date de paiement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date du paiement <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDatePaiement}
                  onChange={(e) => setEditDatePaiement(e.target.value)}
                  required
                  className={`w-full border rounded-lg px-3 py-2 ${!editDatePaiement ? "border-red-300 bg-red-50" : ""}`}
                />
                {!editDatePaiement && (
                  <p className="text-xs text-red-500 mt-1">La date est obligatoire.</p>
                )}
              </div>

              {/* Mode de paiement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                <textarea
                  value={editCommentaire}
                  onChange={(e) => setEditCommentaire(e.target.value)}
                  rows={3}
                  placeholder="Ajouter un commentaire..."
                  className="w-full border rounded-lg px-3 py-2 resize-none"
                />
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={!editDatePaiement}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enregistrer
                </button>
                <button
                  onClick={closeEdit}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
