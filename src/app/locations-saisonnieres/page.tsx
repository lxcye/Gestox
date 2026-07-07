"use client";

import { useEffect, useState, useCallback } from "react";
import type { LogementSaisonnier, ReservationSaisonniere, ReservationStatut, TarifSaison } from "@/lib/types";
import {
  getLogementsSaisonniers, saveLogementSaisonnier, deleteLogementSaisonnier,
  getReservationsForLogement, saveReservationSaisonniere, deleteReservationSaisonniere,
} from "@/lib/store";

type Tab = "calendrier" | "tarification" | "statistiques";

const STATUT_CONFIG: Record<ReservationStatut, { bg: string; color: string; label: string }> = {
  "Confirmée":  { bg: "bg-green-100",  color: "text-green-700",  label: "Confirmée" },
  "En attente": { bg: "bg-yellow-100", color: "text-yellow-700", label: "En attente" },
  "Annulée":    { bg: "bg-red-100",    color: "text-red-700",    label: "Annulée" },
  "Terminée":   { bg: "bg-gray-100",   color: "text-gray-600",   label: "Terminée" },
};

const CAL_COLORS: Record<ReservationStatut, string> = {
  "Confirmée":  "bg-green-400 text-white",
  "En attente": "bg-yellow-300 text-yellow-900",
  "Annulée":    "bg-red-200 text-red-800",
  "Terminée":   "bg-gray-200 text-gray-600",
};

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000));
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function blankLogement(): Omit<LogementSaisonnier, "id" | "created_at" | "updated_at"> {
  return { nom: "", adresse: "", capacite: 2, prix_nuit: 0, prix_semaine: 0, frais_menage: 0, caution: 0, taxe_sejour_par_personne: 0, promotion_pourcent: 0, tarifs_saisons: [] };
}

function blankResa(logementId: string): Omit<ReservationSaisonniere, "id" | "created_at"> {
  const today = new Date().toISOString().split("T")[0];
  return { logement_id: logementId, voyageur_nom: "", voyageur_email: "", voyageur_telephone: "", date_arrivee: today, date_depart: today, nb_voyageurs: 1, statut: "Confirmée", notes: "", plateforme: "", prix_total: 0 };
}

interface PrixBreakdown {
  nuits: number;
  sous_total_nuits: number;
  promo_montant: number;
  frais_menage: number;
  taxe_sejour: number;
  total: number;
  prix_nuit_effectif: number;
  saisonnier: boolean;
}

function calcPrix(logement: LogementSaisonnier, dateArrivee: string, dateDepart: string, nbVoyageurs: number): PrixBreakdown | null {
  const nuits = daysBetween(dateArrivee, dateDepart);
  if (nuits <= 0 || logement.prix_nuit <= 0) return null;

  let sous_total_nuits = 0;
  let saisonnier = false;

  if (nuits >= 7 && logement.prix_semaine > 0) {
    // Tarif semaine : semaines entières + jours restants au tarif nuit
    const semaines = Math.floor(nuits / 7);
    const reste = nuits % 7;
    sous_total_nuits = semaines * logement.prix_semaine + reste * logement.prix_nuit;
  } else {
    // Tarif nuit par nuit avec éventuelles saisons
    for (let i = 0; i < nuits; i++) {
      const d = new Date(dateArrivee + "T12:00:00");
      d.setDate(d.getDate() + i);
      const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const saison = logement.tarifs_saisons.find(s => s.prix_nuit > 0 && mmdd >= s.date_debut && mmdd <= s.date_fin);
      if (saison) saisonnier = true;
      sous_total_nuits += saison ? saison.prix_nuit : logement.prix_nuit;
    }
  }

  const promo_montant = Math.round(sous_total_nuits * (logement.promotion_pourcent / 100) * 100) / 100;
  const frais_menage = logement.frais_menage;
  const taxe_sejour = Math.round(logement.taxe_sejour_par_personne * nbVoyageurs * nuits * 100) / 100;
  const total = Math.round((sous_total_nuits - promo_montant + frais_menage + taxe_sejour) * 100) / 100;
  const prix_nuit_effectif = nuits > 0 ? Math.round((sous_total_nuits / nuits) * 100) / 100 : 0;

  return { nuits, sous_total_nuits, promo_montant, frais_menage, taxe_sejour, total, prix_nuit_effectif, saisonnier };
}

// ── Mini-calendrier pour un mois ──────────────────────────────────────────────

function MonthCalendar({
  year, month, reservations, onDayClick,
}: {
  year: number; month: number;
  reservations: ReservationSaisonniere[];
  onDayClick: (isoDay: string, resa: ReservationSaisonniere | null) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().split("T")[0];
  const activeResas = reservations.filter(r => r.statut !== "Annulée");

  function getResaForDay(d: number): ReservationSaisonniere | null {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return activeResas.find(r => iso >= r.date_arrivee && iso < r.date_depart) ?? null;
  }

  return (
    <div className="min-w-0">
      <p className="text-center text-sm font-semibold text-gray-700 mb-2">{MOIS_FR[month]} {year}</p>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 mb-1">
        {["L","M","M","J","V","S","D"].map((j, i) => <div key={i}>{j}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const resa = getResaForDay(day);
          const isToday = iso === today;
          return (
            <button key={idx} type="button"
              onClick={() => onDayClick(iso, resa)}
              title={resa ? `${resa.voyageur_nom} (${resa.statut})` : "Créer une réservation"}
              className={`h-8 w-full rounded text-xs font-medium transition-colors
                ${resa ? CAL_COLORS[resa.statut] : "hover:bg-blue-50 hover:text-blue-700 text-gray-700"}
                ${isToday ? "ring-2 ring-blue-500" : ""}
              `}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function LocationsSaisonnièresPage() {
  const [logements, setLogements]       = useState<LogementSaisonnier[]>([]);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [reservations, setReservations] = useState<ReservationSaisonniere[]>([]);
  const [activeTab, setActiveTab]       = useState<Tab>("calendrier");

  const [showLogementForm, setShowLogementForm]     = useState(false);
  const [logementForm, setLogementForm]             = useState(blankLogement());
  const [editingLogementId, setEditingLogementId]   = useState<string | null>(null);

  const [showResaForm, setShowResaForm]             = useState(false);
  const [resaForm, setResaForm]                     = useState<Omit<ReservationSaisonniere, "id" | "created_at"> | null>(null);
  const [editingResaId, setEditingResaId]           = useState<string | null>(null);
  const [prixBreakdown, setPrixBreakdown]           = useState<PrixBreakdown | null>(null);
  const [prixManuel, setPrixManuel]                 = useState(false);

  // Point de départ du calendrier : mois courant
  const [calStart, setCalStart] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });

  const selectedLogement = logements.find(l => l.id === selectedId) ?? null;

  const reload = useCallback(() => {
    const all = getLogementsSaisonniers();
    setLogements(all);
    if (selectedId) {
      setReservations(getReservationsForLogement(selectedId));
    } else if (all.length > 0) {
      setSelectedId(all[0].id);
      setReservations(getReservationsForLogement(all[0].id));
    }
  }, [selectedId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (selectedId) setReservations(getReservationsForLogement(selectedId)); }, [selectedId]);

  // Auto-calcul du prix quand les dates / voyageurs changent
  useEffect(() => {
    if (!resaForm || !selectedLogement || prixManuel) return;
    if (!resaForm.date_arrivee || !resaForm.date_depart || resaForm.date_depart <= resaForm.date_arrivee) {
      setPrixBreakdown(null);
      return;
    }
    const bd = calcPrix(selectedLogement, resaForm.date_arrivee, resaForm.date_depart, resaForm.nb_voyageurs);
    setPrixBreakdown(bd);
    if (bd) setResaForm(f => f ? { ...f, prix_total: bd.total } : f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaForm?.date_arrivee, resaForm?.date_depart, resaForm?.nb_voyageurs, selectedLogement, prixManuel]);

  // Génère la liste de N mois à partir de calStart
  function getMonths(n = 3) {
    const months = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(calStart.year, calStart.month + i);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return months;
  }

  function openResaForm(form: Omit<ReservationSaisonniere, "id" | "created_at">, id: string | null) {
    setPrixManuel(false);
    setPrixBreakdown(null);
    setResaForm(form);
    setEditingResaId(id);
    setShowResaForm(true);
  }

  function handleDayClick(isoDay: string, resa: ReservationSaisonniere | null) {
    if (!selectedId) return;
    if (resa) {
      openResaForm({ logement_id: resa.logement_id, voyageur_nom: resa.voyageur_nom, voyageur_email: resa.voyageur_email, voyageur_telephone: resa.voyageur_telephone, date_arrivee: resa.date_arrivee, date_depart: resa.date_depart, nb_voyageurs: resa.nb_voyageurs, statut: resa.statut, notes: resa.notes, plateforme: resa.plateforme, prix_total: resa.prix_total }, resa.id);
    } else {
      const next = new Date(isoDay + "T12:00:00");
      next.setDate(next.getDate() + 1);
      openResaForm({ ...blankResa(selectedId), date_arrivee: isoDay, date_depart: next.toISOString().split("T")[0] }, null);
    }
  }

  function handleSaveLogement(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    if (editingLogementId) {
      saveLogementSaisonnier({ ...logementForm, id: editingLogementId, created_at: selectedLogement?.created_at ?? now, updated_at: now });
    } else {
      const id = crypto.randomUUID();
      saveLogementSaisonnier({ ...logementForm, id, created_at: now, updated_at: now });
      setSelectedId(id);
    }
    setShowLogementForm(false);
    setEditingLogementId(null);
    reload();
  }

  function handleDeleteLogement(id: string) {
    if (!confirm("Supprimer ce logement et toutes ses réservations ?")) return;
    deleteLogementSaisonnier(id);
    const remaining = getLogementsSaisonniers();
    setLogements(remaining);
    const next = remaining[0]?.id ?? null;
    setSelectedId(next);
    setReservations(next ? getReservationsForLogement(next) : []);
  }

  function handleSaveResa(e: React.FormEvent) {
    e.preventDefault();
    if (!resaForm) return;
    const now = new Date().toISOString();
    saveReservationSaisonniere({ ...resaForm, id: editingResaId ?? crypto.randomUUID(), created_at: now });
    setShowResaForm(false);
    setEditingResaId(null);
    setResaForm(null);
    setPrixBreakdown(null);
    setPrixManuel(false);
    if (selectedId) setReservations(getReservationsForLogement(selectedId));
  }

  function handleDeleteResa(id: string) {
    if (!confirm("Supprimer cette réservation ?")) return;
    deleteReservationSaisonniere(id);
    if (selectedId) setReservations(getReservationsForLogement(selectedId));
  }

  function computeStats(): LocStats {
    const now = new Date().toISOString().split("T")[0];
    const active = reservations.filter(r => r.statut !== "Annulée");
    const total = reservations.length;
    const annulees = reservations.filter(r => r.statut === "Annulée").length;
    const tauxAnnulation = total > 0 ? Math.round((annulees / total) * 100) : 0;
    const nbNuitsOccupees = active.reduce((acc, r) => acc + daysBetween(r.date_arrivee, r.date_depart), 0);
    const revenuTotal = active.reduce((acc, r) => acc + r.prix_total, 0);
    const revenuMoyenParNuit = nbNuitsOccupees > 0 ? revenuTotal / nbNuitsOccupees : 0;
    const dureeMoyenne = active.length > 0 ? active.reduce((acc, r) => acc + daysBetween(r.date_arrivee, r.date_depart), 0) / active.length : 0;
    const moisCourant = now.slice(0, 7);
    const daysInCurrentMonth = new Date(parseInt(now.slice(0, 4)), parseInt(now.slice(5, 7)), 0).getDate();
    const nuitsOccupeesMois = active
      .filter(r => r.date_arrivee <= `${moisCourant}-${String(daysInCurrentMonth).padStart(2,"0")}` && r.date_depart >= `${moisCourant}-01`)
      .reduce((acc, r) => {
        const debut = r.date_arrivee < moisCourant + "-01" ? moisCourant + "-01" : r.date_arrivee;
        const fin = r.date_depart > `${moisCourant}-${String(daysInCurrentMonth).padStart(2,"0")}` ? `${moisCourant}-${String(daysInCurrentMonth).padStart(2,"0")}` : r.date_depart;
        return acc + Math.max(0, daysBetween(debut, fin));
      }, 0);
    const tauxOccupation = daysInCurrentMonth > 0 ? Math.round((nuitsOccupeesMois / daysInCurrentMonth) * 100) : 0;
    const revenuMensuel = active.filter(r => r.date_arrivee.startsWith(moisCourant)).reduce((acc, r) => acc + r.prix_total, 0);
    const revPAN = daysInCurrentMonth > 0 ? revenuMensuel / daysInCurrentMonth : 0;
    return { total, annulees, tauxAnnulation, nbNuitsOccupees, revenuTotal, revenuMoyenParNuit, dureeMoyenne, tauxOccupation, revenuMensuel, revPAN };
  }

  const months = getMonths(3);
  const upcomingResas = [...reservations]
    .filter(r => r.statut !== "Annulée" && r.date_depart >= new Date().toISOString().split("T")[0])
    .sort((a, b) => a.date_arrivee.localeCompare(b.date_arrivee));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Locations saisonnières</h1>
        <button onClick={() => { setLogementForm(blankLogement()); setEditingLogementId(null); setShowLogementForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Nouveau logement
        </button>
      </div>

      {logements.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
          <p className="text-4xl mb-4">🏖️</p>
          <p className="font-semibold text-lg mb-1">Aucun logement saisonnier</p>
          <p className="text-sm">Créez votre premier logement pour commencer à gérer vos réservations.</p>
          <button onClick={() => { setLogementForm(blankLogement()); setShowLogementForm(true); }}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700">
            + Ajouter un logement
          </button>
        </div>
      ) : (
        <>
          {/* Sélecteur de logement */}
          <div className="bg-white rounded-xl border px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600 shrink-0">Logement :</span>
            <select value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 max-w-xs">
              {logements.map(l => <option key={l.id} value={l.id}>{l.nom || l.adresse}</option>)}
            </select>
            {selectedLogement && (
              <>
                {selectedLogement.adresse && <span className="text-xs text-gray-400">{selectedLogement.adresse}</span>}
                <span className="text-xs text-gray-400">· {selectedLogement.capacite} pers. max</span>
                <button onClick={() => { if (!selectedLogement) return; setLogementForm({ nom: selectedLogement.nom, adresse: selectedLogement.adresse, capacite: selectedLogement.capacite, prix_nuit: selectedLogement.prix_nuit, prix_semaine: selectedLogement.prix_semaine, frais_menage: selectedLogement.frais_menage, caution: selectedLogement.caution, taxe_sejour_par_personne: selectedLogement.taxe_sejour_par_personne, promotion_pourcent: selectedLogement.promotion_pourcent, tarifs_saisons: selectedLogement.tarifs_saisons }); setEditingLogementId(selectedLogement.id); setShowLogementForm(true); }}
                  className="text-xs text-blue-600 hover:underline">Modifier</button>
                <button onClick={() => handleDeleteLogement(selectedLogement.id)} className="text-xs text-red-500 hover:underline">Supprimer</button>
              </>
            )}
          </div>

          {/* Onglets */}
          <div className="bg-white border-b mb-0 rounded-t-xl overflow-hidden">
            <div className="flex overflow-x-auto">
              {([["calendrier","Calendrier & réservations"],["tarification","Tarification"],["statistiques","Statistiques"]] as [Tab,string][]).map(([t, label]) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Onglet Calendrier & réservations ── */}
          {activeTab === "calendrier" && (
            <div className="bg-white rounded-b-xl border border-t-0">
              {/* Calendriers multi-mois */}
              <div className="p-5 border-b">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCalStart(s => { const d = new Date(s.year, s.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100">← Mois précédent</button>
                  <span className="text-xs text-gray-400">Cliquer sur un jour pour créer ou modifier une réservation</span>
                  <button onClick={() => setCalStart(s => { const d = new Date(s.year, s.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100">Mois suivant →</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {months.map(({ year, month }) => (
                    <MonthCalendar key={`${year}-${month}`} year={year} month={month}
                      reservations={reservations} onDayClick={handleDayClick} />
                  ))}
                </div>

                {/* Légende */}
                <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t text-xs text-gray-600">
                  {(Object.entries(STATUT_CONFIG) as [ReservationStatut, typeof STATUT_CONFIG[ReservationStatut]][]).map(([s, c]) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 rounded text-center text-white text-xs leading-4 ${CAL_COLORS[s]}`} />
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liste des réservations */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">
                    Réservations
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      {upcomingResas.length} à venir · {reservations.length} au total
                    </span>
                  </h3>
                  <button onClick={() => { if (!selectedId) return; openResaForm(blankResa(selectedId), null); }}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                    + Nouvelle
                  </button>
                </div>

                {reservations.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Aucune réservation. Cliquez sur un jour du calendrier pour en créer une.</p>
                ) : (
                  <div className="space-y-2">
                    {[...reservations].sort((a, b) => b.date_arrivee.localeCompare(a.date_arrivee)).map(r => {
                      const sc = STATUT_CONFIG[r.statut];
                      const duree = daysBetween(r.date_arrivee, r.date_depart);
                      return (
                        <div key={r.id} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${r.statut === "Annulée" ? "opacity-50" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{r.voyageur_nom || "Voyageur sans nom"}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
                              {r.plateforme && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{r.plateforme}</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                              <span>{fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)} · {duree} nuit{duree > 1 ? "s" : ""}</span>
                              <span>{r.nb_voyageurs} voyageur{r.nb_voyageurs > 1 ? "s" : ""}</span>
                              {r.prix_total > 0 && <span className="font-medium text-gray-700">{r.prix_total.toLocaleString("fr-FR")} €</span>}
                            </div>
                            {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleDayClick(r.date_arrivee, r)} className="text-xs text-blue-600 hover:underline">Modifier</button>
                            <button onClick={() => handleDeleteResa(r.id)} className="text-xs text-red-500 hover:underline">Supprimer</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Onglet Tarification ── */}
          {activeTab === "tarification" && selectedLogement && (
            <TarificationTab logement={selectedLogement} onSave={l => { saveLogementSaisonnier(l); reload(); }} />
          )}

          {/* ── Onglet Statistiques ── */}
          {activeTab === "statistiques" && (
            <StatsTab stats={computeStats()} reservations={reservations} />
          )}
        </>
      )}

      {/* ── Modal logement ── */}
      {showLogementForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveLogement} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">{editingLogementId ? "Modifier le logement" : "Nouveau logement"}</h2>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Nom du logement *</span>
              <input required value={logementForm.nom} onChange={e => setLogementForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="ex: Appartement Paris 11e"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Adresse</span>
              <input value={logementForm.adresse} onChange={e => setLogementForm(f => ({ ...f, adresse: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Capacité (personnes)</span>
              <input type="number" min={1} value={logementForm.capacite} onChange={e => setLogementForm(f => ({ ...f, capacite: +e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700">
                {editingLogementId ? "Enregistrer" : "Créer"}
              </button>
              <button type="button" onClick={() => { setShowLogementForm(false); setEditingLogementId(null); }}
                className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal réservation ── */}
      {showResaForm && resaForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveResa} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-4">
            <h2 className="text-lg font-bold">{editingResaId ? "Modifier la réservation" : "Nouvelle réservation"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className="text-xs font-medium text-gray-600">Nom du voyageur *</span>
                <input required value={resaForm.voyageur_nom} onChange={e => setResaForm(f => f ? { ...f, voyageur_nom: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Email</span>
                <input type="email" value={resaForm.voyageur_email} onChange={e => setResaForm(f => f ? { ...f, voyageur_email: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Téléphone</span>
                <input value={resaForm.voyageur_telephone} onChange={e => setResaForm(f => f ? { ...f, voyageur_telephone: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Arrivée *</span>
                <input required type="date" value={resaForm.date_arrivee} onChange={e => setResaForm(f => f ? { ...f, date_arrivee: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Départ *</span>
                <input required type="date" value={resaForm.date_depart} min={resaForm.date_arrivee}
                  onChange={e => setResaForm(f => f ? { ...f, date_depart: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Voyageurs</span>
                <input type="number" min={1} value={resaForm.nb_voyageurs} onChange={e => setResaForm(f => f ? { ...f, nb_voyageurs: +e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Statut</span>
                <select value={resaForm.statut} onChange={e => setResaForm(f => f ? { ...f, statut: e.target.value as ReservationStatut } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  {(["Confirmée","En attente","Annulée","Terminée"] as ReservationStatut[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Plateforme</span>
                <input value={resaForm.plateforme} onChange={e => setResaForm(f => f ? { ...f, plateforme: e.target.value } : f)}
                  placeholder="Airbnb, Booking, Direct…"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="col-span-2 block">
                <span className="text-xs font-medium text-gray-600">Notes</span>
                <textarea rows={2} value={resaForm.notes} onChange={e => setResaForm(f => f ? { ...f, notes: e.target.value } : f)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </label>
            </div>

            {/* Détail du prix */}
            {prixBreakdown && !prixManuel ? (
              <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-800">Prix calculé automatiquement</p>
                  <button type="button" onClick={() => setPrixManuel(true)}
                    className="text-xs text-blue-500 hover:underline">Saisir manuellement</button>
                </div>
                <div className="text-xs text-blue-700 space-y-0.5">
                  <div className="flex justify-between">
                    <span>{prixBreakdown.nuits} nuit{prixBreakdown.nuits > 1 ? "s" : ""} × {prixBreakdown.prix_nuit_effectif.toFixed(0)} €{prixBreakdown.saisonnier ? " (tarif saisonnier)" : ""}</span>
                    <span>{prixBreakdown.sous_total_nuits.toLocaleString("fr-FR")} €</span>
                  </div>
                  {prixBreakdown.promo_montant > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Promotion ({selectedLogement?.promotion_pourcent}%)</span>
                      <span>−{prixBreakdown.promo_montant.toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  {prixBreakdown.frais_menage > 0 && (
                    <div className="flex justify-between">
                      <span>Frais de ménage</span>
                      <span>{prixBreakdown.frais_menage.toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  {prixBreakdown.taxe_sejour > 0 && (
                    <div className="flex justify-between">
                      <span>Taxe de séjour ({resaForm.nb_voyageurs} pers.)</span>
                      <span>{prixBreakdown.taxe_sejour.toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-blue-900 border-t border-blue-200 pt-1 mt-1">
                    <span>Total</span>
                    <span>{prixBreakdown.total.toLocaleString("fr-FR")} €</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Prix total (€)</span>
                    {prixManuel && selectedLogement && (
                      <button type="button" onClick={() => setPrixManuel(false)}
                        className="text-xs text-blue-500 hover:underline">Recalculer automatiquement</button>
                    )}
                  </div>
                  <input type="number" min={0} step={0.01} value={resaForm.prix_total}
                    onChange={e => { setPrixManuel(true); setResaForm(f => f ? { ...f, prix_total: +e.target.value } : f); }}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </label>
                {!selectedLogement?.prix_nuit && (
                  <p className="text-xs text-gray-400">Configurez la tarification dans l'onglet correspondant pour activer le calcul automatique.</p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700">
                {editingResaId ? "Enregistrer" : "Créer"}
              </button>
              <button type="button" onClick={() => { setShowResaForm(false); setEditingResaId(null); setResaForm(null); setPrixBreakdown(null); setPrixManuel(false); }}
                className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Tarification ───────────────────────────────────────────────────────────────

function TarificationTab({ logement, onSave }: { logement: LogementSaisonnier; onSave: (l: LogementSaisonnier) => void }) {
  const [form, setForm] = useState({ ...logement });

  function f(field: keyof LogementSaisonnier, val: number | string) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  function addSaison() {
    setForm(prev => ({ ...prev, tarifs_saisons: [...prev.tarifs_saisons, { id: crypto.randomUUID(), nom: "", date_debut: "", date_fin: "", prix_nuit: 0 }] }));
  }

  function updateSaison(id: string, field: keyof TarifSaison, val: string | number) {
    setForm(prev => ({ ...prev, tarifs_saisons: prev.tarifs_saisons.map(s => s.id === id ? { ...s, [field]: val } : s) }));
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="bg-white rounded-b-xl border border-t-0 p-5 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Tarifs de base</h3>
        <div className="grid grid-cols-2 gap-4">
          {([["prix_nuit","Prix par nuit (€)"],["prix_semaine","Prix à la semaine (€)"],["frais_menage","Frais de ménage (€)"],["caution","Caution (€)"],["taxe_sejour_par_personne","Taxe de séjour / pers. / nuit (€)"],["promotion_pourcent","Promotion (%)"]] as [keyof LogementSaisonnier, string][]).map(([field, label]) => (
            <label key={field} className="block">
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <input type="number" min={0} step="0.01" value={form[field] as number}
                onChange={e => f(field, +e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Tarifs saisonniers</h3>
          <button type="button" onClick={addSaison} className="text-xs text-blue-600 hover:underline">+ Ajouter une période</button>
        </div>
        {form.tarifs_saisons.length === 0 && <p className="text-xs text-gray-400">Aucun tarif saisonnier.</p>}
        <div className="space-y-3">
          {form.tarifs_saisons.map(s => (
            <div key={s.id} className="grid grid-cols-[1fr_100px_100px_90px_auto] gap-2 items-end">
              <label className="block">
                <span className="text-xs text-gray-500">Nom</span>
                <input value={s.nom} onChange={e => updateSaison(s.id, "nom", e.target.value)} placeholder="Haute saison"
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Début (MM-JJ)</span>
                <input value={s.date_debut} onChange={e => updateSaison(s.id, "date_debut", e.target.value)} placeholder="07-01"
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Fin (MM-JJ)</span>
                <input value={s.date_fin} onChange={e => updateSaison(s.id, "date_fin", e.target.value)} placeholder="08-31"
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">€/nuit</span>
                <input type="number" min={0} value={s.prix_nuit} onChange={e => updateSaison(s.id, "prix_nuit", +e.target.value)}
                  className="mt-1 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </label>
              <button type="button" onClick={() => setForm(prev => ({ ...prev, tarifs_saisons: prev.tarifs_saisons.filter(x => x.id !== s.id) }))}
                className="text-red-400 hover:text-red-600 text-xl leading-none pb-0.5">×</button>
            </div>
          ))}
        </div>
      </div>

      {form.prix_nuit > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Prix affiché/nuit</p>
            <p className="font-bold text-gray-800">{form.prix_nuit.toLocaleString("fr-FR")} €</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Prix net après promo</p>
            <p className="font-bold text-blue-700">{(form.prix_nuit * (1 - form.promotion_pourcent / 100)).toFixed(2)} €</p>
          </div>
        </div>
      )}

      <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
        Enregistrer
      </button>
    </form>
  );
}

// ── Statistiques ───────────────────────────────────────────────────────────────

interface LocStats {
  total: number; annulees: number; tauxAnnulation: number;
  nbNuitsOccupees: number; revenuTotal: number; revenuMoyenParNuit: number;
  dureeMoyenne: number; tauxOccupation: number; revenuMensuel: number; revPAN: number;
}

function StatsTab({ stats, reservations }: { stats: LocStats; reservations: ReservationSaisonniere[] }) {
  const fmt = (n: number, dec = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const TILES: { label: string; value: string; color: string; bg: string }[] = [
    { label: "Taux d'occupation (mois)", value: `${stats.tauxOccupation}%`, color: stats.tauxOccupation >= 70 ? "text-green-700" : stats.tauxOccupation >= 40 ? "text-yellow-700" : "text-red-700", bg: stats.tauxOccupation >= 70 ? "bg-green-50" : stats.tauxOccupation >= 40 ? "bg-yellow-50" : "bg-red-50" },
    { label: "Revenu mensuel", value: `${fmt(stats.revenuMensuel)} €`, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "Revenu moyen/nuit", value: `${fmt(stats.revenuMoyenParNuit)} €`, color: "text-purple-700", bg: "bg-purple-50" },
    { label: "RevPAN", value: `${fmt(stats.revPAN)} €`, color: "text-indigo-700", bg: "bg-indigo-50" },
    { label: "Durée moy. séjour", value: `${fmt(stats.dureeMoyenne, 1)} nuits`, color: "text-gray-700", bg: "bg-gray-50" },
    { label: "Réservations totales", value: `${stats.total}`, color: "text-gray-700", bg: "bg-gray-50" },
    { label: "Taux d'annulation", value: `${stats.tauxAnnulation}%`, color: stats.tauxAnnulation <= 5 ? "text-green-700" : stats.tauxAnnulation <= 15 ? "text-yellow-700" : "text-red-700", bg: stats.tauxAnnulation <= 5 ? "bg-green-50" : stats.tauxAnnulation <= 15 ? "bg-yellow-50" : "bg-red-50" },
    { label: "Nuits occupées (total)", value: `${stats.nbNuitsOccupees}`, color: "text-gray-700", bg: "bg-gray-50" },
  ];

  const byPlatform: Record<string, { count: number; revenue: number }> = {};
  for (const r of reservations.filter(r => r.statut !== "Annulée")) {
    const p = r.plateforme || "Direct";
    if (!byPlatform[p]) byPlatform[p] = { count: 0, revenue: 0 };
    byPlatform[p].count++;
    byPlatform[p].revenue += r.prix_total;
  }
  const maxRevenue = Math.max(...Object.values(byPlatform).map(x => x.revenue), 1);

  return (
    <div className="bg-white rounded-b-xl border border-t-0 p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TILES.map(t => (
          <div key={t.label} className={`rounded-xl border p-4 ${t.bg}`}>
            <p className="text-xs text-gray-500 mb-1">{t.label}</p>
            <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(byPlatform).length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="font-semibold text-gray-800 mb-3">Par plateforme</h3>
          <div className="space-y-2">
            {Object.entries(byPlatform).sort((a, b) => b[1].revenue - a[1].revenue).map(([p, d]) => (
              <div key={p} className="flex items-center gap-3">
                <span className="text-sm font-medium w-28 truncate">{p}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.round(d.revenue / maxRevenue * 100)}%` }} />
                </div>
                <span className="text-xs text-gray-600 w-20 text-right">{d.revenue.toLocaleString("fr-FR")} €</span>
                <span className="text-xs text-gray-400">{d.count} rés.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
