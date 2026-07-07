"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getBaux, getPaiements, getLocataires, getEtatsDesLieux,
  getTaches, saveTaches, saveBail, getQuittances,
} from "@/lib/store";
import type { Bail, Paiement, Quittance, TacheManuelle, BailIncident } from "@/lib/types";

// ── Tooltip info ──
function InfoTooltip({ texte }: { texte: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1">
      <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center cursor-default select-none hover:bg-blue-100 hover:text-blue-600 transition-colors">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-relaxed">
        {texte}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ── Indice de fiabilité locative ──
interface IndiceLocataire {
  nom: string;
  score: number;
  scorePaiements: number;
  scoreIncidents: number;
  scoreAnciennete: number;
  resume: { ok: boolean; text: string }[];
}

function computeIndice(bail: Bail, bailQuittances: Quittance[], bailPaiements: Paiement[]): IndiceLocataire {
  const locId = bail.finances?.locataire_id;
  const jourPrevue = parseInt(bail.finances?.date_paiement_prevue || "5") || 5;
  const now = new Date();
  const resume: { ok: boolean; text: string }[] = [];

  // ── 1. Historique des paiements (60 pts) ──
  const qs = bailQuittances.filter(q => q.locataire_id === locId);
  const ps = bailPaiements.filter(p => p.locataire_id === locId);
  let nATemps = 0, nRetard = 0, nPartiel = 0, nImpaye = 0, nRetardTotal = 0;

  function isLate(datePaie: string, annee: number, mois: number): boolean {
    if (!datePaie || !jourPrevue) return false;
    const [py, pm, pd] = datePaie.split("-").map(Number);
    return new Date(py, pm - 1, pd) > new Date(annee, mois - 1, jourPrevue);
  }

  for (const q of qs) {
    const p = ps.find(x => x.quittance_id === q.id);
    const du = q.loyer + q.charges;
    const paye = p ? p.montant_paye : du;
    const datePaie = p ? p.date_paiement : q.date_paiement;
    const late = isLate(datePaie, q.annee, q.mois);
    if (late) nRetardTotal++;
    if (paye >= du) {
      late ? nRetard++ : nATemps++;
    } else if (paye > 0) nPartiel++;
    else nImpaye++;
  }
  for (const p of ps) {
    if (p.quittance_id) continue;
    const late = isLate(p.date_paiement, p.annee, p.mois);
    if (late) nRetardTotal++;
    if (p.montant_paye >= p.montant_du) {
      late ? nRetard++ : nATemps++;
    } else if (p.montant_paye > 0) nPartiel++;
    else nImpaye++;
  }
  const nTotal = nATemps + nRetard + nPartiel + nImpaye;
  let scorePaiements: number;
  if (nTotal === 0) {
    scorePaiements = 60;
    resume.push({ ok: true, text: "Aucun historique de paiement" });
  } else {
    const pts = (nATemps * 1.0 + nRetard * 0.7 + nPartiel * 0.3 + nImpaye * 0) / nTotal;
    scorePaiements = Math.round(pts * 60);
    if (nATemps > 0) resume.push({ ok: true, text: `${nATemps} loyer${nATemps > 1 ? "s" : ""} reçu${nATemps > 1 ? "s" : ""} à temps` });
    if (nRetardTotal > 0) resume.push({ ok: false, text: `${nRetardTotal} retard${nRetardTotal > 1 ? "s" : ""} de paiement` });
    if (nPartiel > 0) resume.push({ ok: false, text: `${nPartiel} paiement${nPartiel > 1 ? "s" : ""} incomplet${nPartiel > 1 ? "s" : ""}` });
    if (nImpaye > 0) resume.push({ ok: false, text: `${nImpaye} impayé${nImpaye > 1 ? "s" : ""}` });
  }

  // ── 2. Incidents (25 pts) ──
  const incidents = bail.incidents ?? [];
  const nonResolus = incidents.filter(i => !i.resolu);
  const resolusRecents = incidents.filter(i => {
    if (!i.resolu || !i.date_resolution) return false;
    const age = (now.getTime() - new Date(i.date_resolution).getTime()) / 86400000;
    return age < 180;
  });
  const resolusAnciens = incidents.filter(i => {
    if (!i.resolu || !i.date_resolution) return false;
    const age = (now.getTime() - new Date(i.date_resolution).getTime()) / 86400000;
    return age >= 180 && age < 365;
  });
  let scoreIncidents = 25 - nonResolus.length * 8 - resolusRecents.length * 3 - resolusAnciens.length * 1;
  scoreIncidents = Math.max(0, Math.min(25, scoreIncidents));
  if (nonResolus.length === 0 && incidents.length === 0) {
    resume.push({ ok: true, text: "Aucun incident enregistré" });
  } else if (nonResolus.length === 0) {
    resume.push({ ok: true, text: "Aucun incident en cours" });
  } else {
    resume.push({ ok: false, text: `${nonResolus.length} incident${nonResolus.length > 1 ? "s" : ""} non résolu${nonResolus.length > 1 ? "s" : ""}` });
  }
  if (resolusRecents.length > 0) {
    resume.push({ ok: false, text: `${resolusRecents.length} incident${resolusRecents.length > 1 ? "s" : ""} résolu${resolusRecents.length > 1 ? "s" : ""} récemment` });
  }

  // ── 3. Ancienneté (15 pts) ──
  const dateDebut = bail.contrat.date_debut;
  let scoreAnciennete = 2;
  let ancienneteText = "Date de début non renseignée";
  if (dateDebut) {
    const mois = Math.floor((now.getTime() - new Date(dateDebut).getTime()) / (30.44 * 86400000));
    const ans = Math.floor(mois / 12);
    const moisReste = mois % 12;
    ancienneteText = ans > 0
      ? `Bail actif depuis ${ans} an${ans > 1 ? "s" : ""}${moisReste > 0 ? ` et ${moisReste} mois` : ""}`
      : `Bail actif depuis ${mois} mois`;
    if (mois >= 24) scoreAnciennete = 15;
    else if (mois >= 12) scoreAnciennete = 12;
    else if (mois >= 6) scoreAnciennete = 8;
    else if (mois >= 3) scoreAnciennete = 5;
  }
  resume.push({ ok: scoreAnciennete >= 8, text: ancienneteText });

  const score = scorePaiements + scoreIncidents + scoreAnciennete;
  const nom = `${bail.locataire.prenom} ${bail.locataire.nom}`.trim() || "Locataire";
  return { nom, score, scorePaiements, scoreIncidents, scoreAnciennete, resume };
}

function scoreColor(s: number, max: number) {
  const pct = s / max;
  if (pct >= 0.8) return { bar: "bg-green-500", text: "text-green-600" };
  if (pct >= 0.5) return { bar: "bg-orange-400", text: "text-orange-500" };
  return { bar: "bg-red-500", text: "text-red-600" };
}

// ── Helpers ──
const MOIS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const MOIS_FR_LONG = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

function dateKey(annee: number, mois: number) { return `${annee}-${String(mois).padStart(2, "0")}`; }

function derniersMois(n: number): { label: string; key: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { label: MOIS_FR[d.getMonth()] + " " + String(d.getFullYear()).slice(2), key: dateKey(d.getFullYear(), d.getMonth() + 1) };
  });
}

type Periode = "3" | "6" | "12" | "all";

// ── Tâches auto ──
function genererTachesAuto(baux: Bail[], paiements: Paiement[]): Omit<TacheManuelle, "id" | "faite" | "created_at">[] {
  const now = new Date();
  const tasks: Omit<TacheManuelle, "id" | "faite" | "created_at">[] = [];
  const edls = typeof window !== "undefined" ? getEtatsDesLieux() : [];

  for (const b of baux) {
    const adresse = b.logement.adresse || "Logement sans adresse";
    const locNom = `${b.locataire.prenom} ${b.locataire.nom}`.trim() || "Locataire";

    // Bail expire bientôt
    if (b.contrat.date_fin) {
      const fin = new Date(b.contrat.date_fin);
      const joursRestants = Math.floor((fin.getTime() - now.getTime()) / 86400000);
      if (joursRestants >= 0 && joursRestants <= 90) {
        tasks.push({
          titre: `Renouveler le bail — ${adresse}`,
          date_echeance: b.contrat.date_fin,
          priorite: joursRestants <= 30 ? "haute" : "moyenne",
        });
      }
    }

    // EDL d'entrée manquant sur bail actif
    const hasEdlEntrant = edls.some(e => e.bail_id === b.id && e.type === "Entrant");
    if (!hasEdlEntrant && b.contrat.date_debut) {
      const debut = new Date(b.contrat.date_debut);
      if (debut <= now) {
        tasks.push({
          titre: `EDL d'entrée manquant — ${adresse}`,
          date_echeance: b.contrat.date_debut,
          priorite: "haute",
        });
      }
    }

    // Loyer du mois courant non payé
    if (b.finances?.locataire_id) {
      const moisCourant = now.getMonth() + 1;
      const anneeCourante = now.getFullYear();
      const paieMois = paiements.find(p =>
        p.locataire_id === b.finances.locataire_id &&
        p.mois === moisCourant && p.annee === anneeCourante
      );
      if (!paieMois) {
        const jourDu = parseInt(b.finances.date_paiement_prevue || "5");
        const dateEcheance = new Date(anneeCourante, moisCourant - 1, jourDu);
        if (now > dateEcheance) {
          tasks.push({
            titre: `Loyer en attente — ${locNom} (${adresse})`,
            date_echeance: dateEcheance.toISOString().split("T")[0],
            priorite: "haute",
          });
        }
      }
    }
  }
  return tasks;
}

// ── Modale incident ──
function ModalIncident({ baux, onClose }: { baux: Bail[]; onClose: () => void }) {
  const [bailId, setBailId] = useState(baux[0]?.id ?? "");
  const [objet, setObjet] = useState("");
  const [categorie, setCategorie] = useState<"Technique" | "Administratif" | "Vie de l'immeuble" | "Paiement" | "Divers">("Technique");
  const [sousCategorie, setSousCategorie] = useState("");
  const [priorite, setPriorite] = useState<"Faible" | "Normale" | "Haute" | "Urgente">("Normale");
  const [description, setDescription] = useState("");
  const CATEGORIES = ["Technique", "Administratif", "Vie de l'immeuble", "Paiement", "Divers"] as const;
  const SOUS_CAT: Record<string, string[]> = {
    "Technique": ["Plomberie","Électricité","Chauffage","Eau chaude","Climatisation","Serrurerie","Électroménager","Menuiserie","Humidité","Infiltration","Toiture","Ascenseur","Autre"],
    "Administratif": ["Assurance","Sinistre","Dégradation","Dépôt de garantie","Réclamation","Assurance habitation manquante","Autre"],
    "Vie de l'immeuble": ["Nuisances sonores","Déchets","Parties communes","Animaux","Voisinage","Police","Autre"],
    "Paiement": ["Retard","Impayé","Chèque rejeté","Autre"],
    "Divers": ["Autre"],
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!objet.trim()) return;
    const bail = baux.find(b => b.id === bailId);
    if (!bail) return;
    const now = new Date().toISOString();
    const inc: BailIncident = {
      id: crypto.randomUUID(), date_creation: now.split("T")[0],
      statut: "Nouveau", priorite, categorie, sous_categorie: sousCategorie,
      objet, description, localisation: "", declarant: "", declarant_date: now.split("T")[0], declarant_moyen: "",
      devis_estime: 0, cout_reel: 0, prise_en_charge: "",
      assurance_concerne: false, assurance_numero_dossier: "", assurance_nom: "", assurance_franchise: 0, assurance_remboursement: 0,
      resolu: false, date_resolution: "", solution: "", commentaire_final: "",
      pieces_jointes: [], interventions: [],
      historique: [{ id: crypto.randomUUID(), date: now, icone: "created", texte: "Incident créé depuis le tableau de bord" }],
    };
    saveBail({ ...bail, incidents: [...(bail.incidents ?? []), inc] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Déclarer un incident</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bail concerné</label>
            <select value={bailId} onChange={e => setBailId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {baux.map(b => (
                <option key={b.id} value={b.id}>{b.logement.adresse || "Sans adresse"} — {b.locataire.prenom} {b.locataire.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet <span className="text-red-500">*</span></label>
            <input type="text" value={objet} onChange={e => setObjet(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex : Fuite robinet cuisine" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select value={categorie} onChange={e => { setCategorie(e.target.value as typeof categorie); setSousCategorie(""); }} className="w-full border rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
              <select value={priorite} onChange={e => setPriorite(e.target.value as typeof priorite)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {["Faible","Normale","Haute","Urgente"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sous-catégorie</label>
            <select value={sousCategorie} onChange={e => setSousCategorie(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— Choisir —</option>
              {SOUS_CAT[categorie].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700">Enregistrer</button>
            <button type="button" onClick={onClose} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Recherche universelle ──
type ResultatRecherche = { type: string; titre: string; sous: string; href: string };

function rechercherTout(q: string, baux: Bail[]): ResultatRecherche[] {
  if (!q.trim()) return [];
  const lq = q.toLowerCase();
  const results: ResultatRecherche[] = [];

  for (const b of baux) {
    const adresse = b.logement.adresse || "";
    const locNom = `${b.locataire.prenom} ${b.locataire.nom}`.trim();
    if (adresse.toLowerCase().includes(lq) || locNom.toLowerCase().includes(lq) || b.logement.ville?.toLowerCase().includes(lq)) {
      results.push({ type: "Bail", titre: adresse || locNom, sous: locNom, href: `/baux/${b.id}` });
    }
    for (const inc of (b.incidents ?? [])) {
      if (inc.description.toLowerCase().includes(lq) || inc.objet.toLowerCase().includes(lq)) {
        results.push({ type: "Incident", titre: inc.objet, sous: `${adresse} — ${inc.date_creation}`, href: `/baux/${b.id}?tab=incidents` });
      }
    }
    for (const doc of (b.documents ?? [])) {
      if (doc.nom?.toLowerCase().includes(lq) || doc.fichier_nom?.toLowerCase().includes(lq)) {
        results.push({ type: "Document", titre: doc.nom || doc.fichier_nom, sous: adresse, href: `/baux/${b.id}?tab=documents` });
      }
    }
  }

  const locataires = typeof window !== "undefined" ? getLocataires() : [];
  for (const l of locataires) {
    const nom = `${l.prenom} ${l.nom}`.trim();
    if (nom.toLowerCase().includes(lq)) {
      results.push({ type: "Locataire", titre: nom, sous: l.ville_location || "", href: `/locataires` });
    }
  }

  return results.slice(0, 8);
}

const COULEURS_GRAPHE = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

export default function Dashboard() {
  const router = useRouter();
  const [baux, setBaux] = useState<Bail[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [quittances, setQuittances] = useState<Quittance[]>([]);
  const [tachesManuel, setTachesManuel] = useState<TacheManuelle[]>([]);
  const [periode, setPeriode] = useState<Periode>("12");
  const [showIncident, setShowIncident] = useState(false);
  const [selectedBailId, setSelectedBailId] = useState<string | null>(null);
  const [selectedMoisRevenus, setSelectedMoisRevenus] = useState<string | null>(null);
  const [showConfigRenta, setShowConfigRenta] = useState(false);
  const [configRenta, setConfigRenta] = useState<{ prix_achat: string; charges_proprio: string; mensualite_credit: string }>({ prix_achat: "", charges_proprio: "", mensualite_credit: "" });
  const [rentaBailId, setRentaBailId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [showResultats, setShowResultats] = useState(false);
  const [nouvelleTache, setNouvelleTache] = useState({ titre: "", date_echeance: "", priorite: "moyenne" as TacheManuelle["priorite"] });
  const [ajoutTache, setAjoutTache] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBaux(getBaux());
    setPaiements(getPaiements());
    setQuittances(getQuittances());
    setTachesManuel(getTaches());
  }, []);

  // Fermer recherche au clic extérieur
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResultats(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); document.getElementById("search-global")?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Filtre logement ──
  const filteredBaux = useMemo(
    () => selectedBailId ? baux.filter(b => b.id === selectedBailId) : baux,
    [baux, selectedBailId]
  );
  const filteredLocataireIds = useMemo(
    () => new Set(filteredBaux.map(b => b.finances?.locataire_id).filter(Boolean)),
    [filteredBaux]
  );
  const filteredPaiements = useMemo(
    () => selectedBailId ? paiements.filter(p => filteredLocataireIds.has(p.locataire_id)) : paiements,
    [paiements, selectedBailId, filteredLocataireIds]
  );
  const filteredQuittances = useMemo(
    () => selectedBailId ? quittances.filter(q => filteredLocataireIds.has(q.locataire_id)) : quittances,
    [quittances, selectedBailId, filteredLocataireIds]
  );

  // ── Données graphiques ──
  const nMois = periode === "all" ? 24 : parseInt(periode);
  const moisLabels = useMemo(() => derniersMois(nMois), [nMois]);

  const dataRevenus = useMemo(() => {
    return moisLabels.map(({ label, key }) => {
      const [y, m] = key.split("-").map(Number);
      const total = filteredPaiements.filter(p => p.annee === y && p.mois === m).reduce((s, p) => s + p.montant_paye, 0);
      return { mois: label, key, revenus: total };
    });
  }, [moisLabels, filteredPaiements]);

  const dataCharges = useMemo(() => {
    return moisLabels.map(({ label, key }) => {
      const [y, m] = key.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      const monthKey = `${y}-${String(m).padStart(2, "0")}-01`; // YYYY-MM-DD du 1er du mois
      const total = filteredBaux
        .filter(b => {
          const debut = b.contrat.date_debut ? new Date(b.contrat.date_debut) : null;
          const fin = b.contrat.date_fin ? new Date(b.contrat.date_fin) : null;
          return (!debut || debut <= date) && (!fin || fin >= date);
        })
        .reduce((s, b) => {
          // Trouve le montant de charges en vigueur ce mois-là via l'historique
          const hist = (b.historique_charges ?? [])
            .filter(h => h.date_effet <= monthKey)
            .sort((a, c) => c.date_effet.localeCompare(a.date_effet));
          const montant = hist[0]?.montant ?? b.finances?.charges ?? 0;
          return s + montant;
        }, 0);
      return { mois: label, charges: total };
    });
  }, [moisLabels, filteredBaux]);

  // ── Indice de fiabilité locative ──
  const indicesLocataires = useMemo(() => {
    return filteredBaux
      .filter(b => b.finances?.locataire_id)
      .map(b => computeIndice(b, filteredQuittances, filteredPaiements));
  }, [filteredBaux, filteredPaiements, filteredQuittances]);

  // ── Paiements : basé sur les paiements saisis ──
  const dataPaiements = useMemo(() => {
    const limite = new Date();
    limite.setMonth(limite.getMonth() - (nMois - 1));
    limite.setDate(1);

    let aTempsComplet = 0, enRetard = 0, partielImpaye = 0;

    for (const p of filteredPaiements) {
      if (new Date(p.annee, p.mois - 1, 1) < limite) continue;
      const bail = filteredBaux.find(b => b.finances?.locataire_id === p.locataire_id);
      const jourPrevue = parseInt(bail?.finances?.date_paiement_prevue || "5") || 5;
      // Un paiement est "en retard" si la date dépasse le jour prévu — quel que soit le montant
      const late = p.date_paiement
        ? (() => { const [py, pm, pd] = p.date_paiement.split("-").map(Number); return new Date(py, pm - 1, pd) > new Date(p.annee, p.mois - 1, jourPrevue); })()
        : false;
      if (late) {
        enRetard++;
      } else if (p.montant_paye >= p.montant_du) {
        aTempsComplet++;
      } else {
        partielImpaye++;
      }
    }

    return [
      { name: "À temps et complet", value: aTempsComplet, color: "#10b981" },
      { name: "En retard", value: enRetard, color: "#f59e0b" },
      { name: "Partiel / impayé", value: partielImpaye, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [filteredPaiements, filteredBaux, nMois]);

  const dataRelocation = useMemo(() => {
    const byAdresse: Record<string, Date[]> = {};
    for (const b of filteredBaux) {
      const key = b.logement.adresse || b.id;
      if (!byAdresse[key]) byAdresse[key] = [];
      if (b.contrat.date_debut) byAdresse[key].push(new Date(b.contrat.date_debut));
    }
    return Object.entries(byAdresse)
      .filter(([, dates]) => dates.length >= 2)
      .map(([adresse, dates]) => {
        dates.sort((a, b) => a.getTime() - b.getTime());
        let totalJours = 0;
        for (let i = 1; i < dates.length; i++) {
          totalJours += Math.max(0, (dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
        }
        return { adresse: adresse.slice(0, 20), jours: Math.round(totalJours / (dates.length - 1)) };
      });
  }, [filteredBaux]);

  // ── Tâches (toujours globales, sans filtre) ──
  const tachesAuto = useMemo(() => genererTachesAuto(baux, paiements), [baux, paiements]);

  function toggleTacheManuel(id: string) {
    const updated = tachesManuel.map(t => t.id === id ? { ...t, faite: !t.faite } : t);
    setTachesManuel(updated);
    saveTaches(updated);
  }

  function supprimerTache(id: string) {
    const updated = tachesManuel.filter(t => t.id !== id);
    setTachesManuel(updated);
    saveTaches(updated);
  }

  function ajouterTache() {
    if (!nouvelleTache.titre.trim()) return;
    const t: TacheManuelle = { id: crypto.randomUUID(), ...nouvelleTache, faite: false, created_at: new Date().toISOString() };
    const updated = [...tachesManuel, t];
    setTachesManuel(updated);
    saveTaches(updated);
    setNouvelleTache({ titre: "", date_echeance: "", priorite: "moyenne" });
    setAjoutTache(false);
  }

  const resultatsRecherche = useMemo(() => rechercherTout(recherche, baux), [recherche, baux]);

  // ── Rentabilité ──
  const rentabilite = useMemo(() => {
    const today = new Date();
    return filteredBaux
      .filter(b => !b.contrat.date_fin || new Date(b.contrat.date_fin) >= today)
      .map(b => {
        const inv = b.investissement ?? {};
        const loyerCC = (b.finances?.loyer_hc ?? 0) + (b.finances?.charges ?? 0);
        const chargesP = inv.charges_proprio_mensuelles ?? 0;
        const credit = inv.mensualite_credit ?? 0;
        const prix = inv.prix_achat ?? 0;
        const cashflow = loyerCC - chargesP - credit;
        const rendBrut = prix > 0 ? (loyerCC * 12 / prix) * 100 : null;
        const rendNet = prix > 0 ? ((loyerCC - chargesP) * 12 / prix) * 100 : null;
        const configured = prix > 0 || chargesP > 0 || credit > 0;
        return { bail: b, loyerCC, cashflow, rendBrut, rendNet, configured };
      });
  }, [filteredBaux]);

  function saveRentaConfig() {
    if (!rentaBailId) return;
    const bail = baux.find(b => b.id === rentaBailId);
    if (!bail) return;
    saveBail({
      ...bail,
      investissement: {
        prix_achat: parseFloat(configRenta.prix_achat) || undefined,
        charges_proprio_mensuelles: parseFloat(configRenta.charges_proprio) || undefined,
        mensualite_credit: parseFloat(configRenta.mensualite_credit) || undefined,
      },
    });
    setBaux(getBaux());
    setShowConfigRenta(false);
  }

  // ── Stats rapides (filtrées) ──
  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const revenuMoisCourant = filteredPaiements.filter(p => p.mois === moisCourant && p.annee === anneeCourante).reduce((s, p) => s + p.montant_paye, 0);
  const biauxActifs = filteredBaux.filter(b => {
    if (!b.contrat.date_debut) return false;
    if (b.contrat.date_fin && new Date(b.contrat.date_fin) < now) return false;
    return true;
  }).length;
  const totalLoyers = filteredBaux.filter(b => !b.contrat.date_fin || new Date(b.contrat.date_fin) >= now).reduce((s, b) => s + (b.finances?.loyer_hc ?? 0) + (b.finances?.charges ?? 0), 0);
  const tauxEncaissement = totalLoyers > 0 ? Math.round((revenuMoisCourant / totalLoyers) * 100) : 0;

  const PRIORITE_COULEUR: Record<string, string> = { haute: "bg-red-100 text-red-700", moyenne: "bg-yellow-100 text-yellow-700", basse: "bg-gray-100 text-gray-600" };

  const toutesLesTaches = [
    ...tachesAuto.map(t => ({ ...t, id: `auto_${t.titre}`, faite: false, created_at: "", isAuto: true })),
    ...tachesManuel.map(t => ({ ...t, isAuto: false })),
  ].sort((a, b) => {
    if (a.faite !== b.faite) return a.faite ? 1 : -1;
    const pa = a.priorite === "haute" ? 0 : a.priorite === "moyenne" ? 1 : 2;
    const pb = b.priorite === "haute" ? 0 : b.priorite === "moyenne" ? 1 : 2;
    if (pa !== pb) return pa - pb;
    return (a.date_echeance || "").localeCompare(b.date_echeance || "");
  });

  return (
    <div className="space-y-6">
      {/* Barre de recherche universelle */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            id="search-global"
            type="text"
            value={recherche}
            onChange={e => { setRecherche(e.target.value); setShowResultats(true); }}
            onFocus={() => setShowResultats(true)}
            placeholder="Rechercher un bail, locataire, document, incident… (Ctrl+K)"
            className="w-full bg-white border rounded-xl px-4 py-3 pl-11 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {recherche && (
            <button onClick={() => { setRecherche(""); setShowResultats(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">✕</button>
          )}
        </div>
        {showResultats && resultatsRecherche.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
            {resultatsRecherche.map((r, i) => (
              <Link
                key={i}
                href={r.href}
                onClick={() => { setRecherche(""); setShowResultats(false); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
              >
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium shrink-0">{r.type}</span>
                <span className="font-medium text-sm truncate">{r.titre}</span>
                <span className="text-xs text-gray-400 truncate ml-auto">{r.sous}</span>
              </Link>
            ))}
          </div>
        )}
        {showResultats && recherche.trim() && resultatsRecherche.length === 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-gray-500">
            Aucun résultat pour « {recherche} »
          </div>
        )}
      </div>

      {/* Filtre logement + Stats rapides */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium shrink-0">Logement :</span>
          <select
            value={selectedBailId ?? ""}
            onChange={e => setSelectedBailId(e.target.value || null)}
            className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les logements</option>
            {baux.map(b => (
              <option key={b.id} value={b.id}>
                {b.logement.adresse || "Sans adresse"}{b.locataire.nom ? ` — ${b.locataire.prenom} ${b.locataire.nom}`.trim() : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center">
              Baux actifs
              <InfoTooltip texte="Nombre de baux ayant une date de début définie et non expirés à ce jour." />
            </p>
            <p className="text-2xl font-bold text-blue-600">{biauxActifs}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center">
              Revenus ce mois
              <InfoTooltip texte="Total des paiements encaissés sur le mois en cours." />
            </p>
            <p className="text-2xl font-bold text-green-600">{revenuMoisCourant.toFixed(0)} €</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center">
              Loyers attendus
              <InfoTooltip texte="Somme des loyers charges comprises (HC + provisions) des baux actifs." />
            </p>
            <p className="text-2xl font-bold text-purple-600">{totalLoyers.toFixed(0)} €/mois</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center">
              Taux encaissement
              <InfoTooltip texte="Revenus encaissés ce mois divisés par les loyers attendus, exprimé en pourcentage." />
            </p>
            <p className={`text-2xl font-bold ${tauxEncaissement >= 90 ? "text-green-600" : "text-orange-500"}`}>{tauxEncaissement} %</p>
          </div>
        </div>
      </div>


      {/* Raccourcis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/quittances/nouvelle" className="flex items-center gap-4 bg-blue-600 text-white rounded-xl p-4 hover:bg-blue-700 transition-colors">
          <span className="text-3xl">📄</span>
          <div>
            <p className="font-semibold">Générer une quittance</p>
            <p className="text-sm text-blue-200">Créer et télécharger une quittance de loyer</p>
          </div>
        </Link>
        <button onClick={() => setShowIncident(true)} className="flex items-center gap-4 bg-white border-2 border-red-200 text-red-700 rounded-xl p-4 hover:border-red-400 transition-colors text-left">
          <span className="text-3xl">⚠️</span>
          <div>
            <p className="font-semibold">Déclarer un incident</p>
            <p className="text-sm text-red-400">Retard, litige, sinistre, travaux…</p>
          </div>
        </button>
      </div>

      {/* Tâches */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Liste des tâches</h2>
          <button onClick={() => setAjoutTache(!ajoutTache)} className="text-sm text-blue-600 hover:underline">+ Ajouter</button>
        </div>

        {ajoutTache && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4 space-y-2">
            <input
              type="text"
              value={nouvelleTache.titre}
              onChange={e => setNouvelleTache(p => ({ ...p, titre: e.target.value }))}
              placeholder="Titre de la tâche…"
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={nouvelleTache.date_echeance}
                onChange={e => setNouvelleTache(p => ({ ...p, date_echeance: e.target.value }))}
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <select
                value={nouvelleTache.priorite}
                onChange={e => setNouvelleTache(p => ({ ...p, priorite: e.target.value as TacheManuelle["priorite"] }))}
                className="border rounded px-3 py-1.5 text-sm"
              >
                <option value="haute">Haute</option>
                <option value="moyenne">Moyenne</option>
                <option value="basse">Basse</option>
              </select>
              <button onClick={ajouterTache} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">OK</button>
            </div>
          </div>
        )}

        {toutesLesTaches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune tâche en cours. 🎉</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {toutesLesTaches.map(t => (
              <div
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${t.faite ? "opacity-50 bg-gray-50" : "bg-white"}`}
              >
                {t.isAuto ? (
                  <span className="mt-0.5 text-orange-400 shrink-0">●</span>
                ) : (
                  <input
                    type="checkbox"
                    checked={t.faite}
                    onChange={() => toggleTacheManuel(t.id)}
                    className="mt-0.5 rounded shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${t.faite ? "line-through text-gray-400" : "text-gray-800"}`}>{t.titre}</p>
                  {t.date_echeance && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Échéance : {new Date(t.date_echeance).toLocaleDateString("fr-FR")}
                      {!t.faite && new Date(t.date_echeance) < new Date() && <span className="text-red-500 ml-1">— En retard</span>}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITE_COULEUR[t.priorite]}`}>
                  {t.priorite}
                </span>
                {!t.isAuto && (
                  <button onClick={() => supprimerTache(t.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                )}
                {t.isAuto && (
                  <span className="text-xs text-gray-400 shrink-0 italic">auto</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sélecteur période */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 font-medium">Période :</span>
        {(["3","6","12","all"] as Periode[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriode(p)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${periode === p ? "bg-blue-600 text-white" : "bg-white border text-gray-600 hover:border-blue-400"}`}
          >
            {p === "all" ? "Tout" : `${p} mois`}
          </button>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenus mensuels */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Revenus mensuels (€)</h3>
            <p className="text-xs text-gray-400">Cliquez sur une barre pour afficher les commentaires</p>
          </div>
          {dataRevenus.every(d => d.revenus === 0) ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun paiement enregistré.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={dataRevenus}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(0)} €`} />
                  <Bar
                    dataKey="revenus"
                    radius={[4, 4, 0, 0]}
                    name="Revenus"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(data: any) => setSelectedMoisRevenus(prev => prev === data.key ? null : data.key)}
                  >
                    {dataRevenus.map((entry, i) => (
                      <Cell key={i} fill={entry.key === selectedMoisRevenus ? "#1d4ed8" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Total de la période */}
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-sm text-gray-500">Total encaissé sur la période</span>
                <span className="text-base font-bold text-blue-600">
                  {dataRevenus.reduce((s, d) => s + d.revenus, 0).toFixed(0)} €
                </span>
              </div>

              {/* Détail commentaires du mois sélectionné */}
              {selectedMoisRevenus && (() => {
                const [y, m] = selectedMoisRevenus.split("-").map(Number);
                const psMois = filteredPaiements.filter(p => p.annee === y && p.mois === m && p.commentaire?.trim());
                const labelMois = dataRevenus.find(d => d.key === selectedMoisRevenus)?.mois ?? "";
                return (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">Commentaires — {labelMois}</p>
                      <button onClick={() => setSelectedMoisRevenus(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Fermer</button>
                    </div>
                    {psMois.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Aucun commentaire pour ce mois.</p>
                    ) : (
                      <ul className="space-y-2">
                        {psMois.map(p => (
                          <li key={p.id} className="text-sm flex items-start gap-2">
                            <span className="text-gray-400 shrink-0 mt-0.5 text-xs">
                              {p.date_paiement ? p.date_paiement.split("-").reverse().join("/") : "—"}
                            </span>
                            <span className="text-gray-600 shrink-0">{p.montant_paye.toFixed(0)} €</span>
                            <span className="text-gray-400 shrink-0">·</span>
                            <span className="text-gray-700">{p.commentaire}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>


        {/* Indice de fiabilité locative */}
        {indicesLocataires.length === 0 ? null : (
          <div className={`bg-white rounded-xl shadow p-5 ${indicesLocataires.length === 1 ? "" : "lg:col-span-2"}`}>
            <h3 className="font-semibold text-gray-800 mb-1">Indice de fiabilité locative</h3>
            <p className="text-xs text-gray-400 mb-4">Score sur 100 pts — paiements (60) · incidents (25) · ancienneté (15)</p>
            <div className={`grid gap-5 ${indicesLocataires.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {indicesLocataires.map(ind => {
                const c = scoreColor(ind.score, 100);
                return (
                  <div key={ind.nom} className="border rounded-xl p-4 space-y-4">
                    {/* En-tête : nom + score */}
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-800 truncate">{ind.nom}</p>
                      <div className="shrink-0 text-right">
                        <span className={`text-3xl font-bold ${c.text}`}>{ind.score}</span>
                        <span className="text-gray-400 text-sm font-medium">/100</span>
                      </div>
                    </div>

                    {/* Barre globale */}
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all ${c.bar}`} style={{ width: `${ind.score}%` }} />
                    </div>

                    {/* Sous-scores */}
                    <div className="space-y-2">
                      {[
                        { label: "Paiements", val: ind.scorePaiements, max: 60 },
                        { label: "Incidents", val: ind.scoreIncidents, max: 25 },
                        { label: "Ancienneté", val: ind.scoreAnciennete, max: 15 },
                      ].map(s => {
                        const sc = scoreColor(s.val, s.max);
                        return (
                          <div key={s.label}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">{s.label}</span>
                              <span className={`font-semibold ${sc.text}`}>{s.val}/{s.max}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${sc.bar}`} style={{ width: `${(s.val / s.max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Résumé */}
                    <div className="space-y-1 pt-1 border-t">
                      {ind.resume.map((r, i) => (
                        <p key={i} className={`text-xs flex items-start gap-1.5 ${r.ok ? "text-green-700" : "text-orange-700"}`}>
                          <span className="shrink-0 mt-0.5">{r.ok ? "✔" : "⚠"}</span>
                          {r.text}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tuile Rentabilité ──────────────────────────────────────── */}
        {rentabilite.length > 0 && (() => {
          const activeBailId = rentaBailId ?? rentabilite[0]?.bail.id ?? null;
          const rentaBail = baux.find(b => b.id === activeBailId);
          const r = rentabilite.find(x => x.bail.id === activeBailId) ?? null;
          const inv = rentaBail?.investissement ?? {};

          function cfColors(cf: number) {
            if (cf > 200) return { text: "text-green-600", bg: "bg-green-50", bar: "bg-green-500", label: "Positif" };
            if (cf >= 0)  return { text: "text-orange-500", bg: "bg-orange-50", bar: "bg-orange-400", label: "Neutre" };
            return { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500", label: "Négatif" };
          }
          function rdtColors(pct: number | null) {
            if (pct === null) return { text: "text-gray-400", bg: "bg-gray-50", bar: "bg-gray-300", label: "—" };
            if (pct > 7)  return { text: "text-green-600", bg: "bg-green-50", bar: "bg-green-500", label: "Excellent" };
            if (pct >= 4) return { text: "text-orange-500", bg: "bg-orange-50", bar: "bg-orange-400", label: "Correct" };
            return { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500", label: "Faible" };
          }

          const cf = cfColors(r?.cashflow ?? 0);
          const rb = rdtColors(r?.rendBrut ?? null);
          const rn = rdtColors(r?.rendNet ?? null);

          return (
            <div className={`bg-white rounded-xl shadow p-5 ${rentabilite.length === 1 ? "" : "lg:col-span-2"}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Rentabilité</h3>
                  <p className="text-xs text-gray-400">{"< 4 % rouge · 4–7 % orange · > 7 % vert"}</p>
                </div>
                <button
                  onClick={() => {
                    setRentaBailId(activeBailId);
                    setConfigRenta({
                      prix_achat: inv.prix_achat?.toString() ?? "",
                      charges_proprio: inv.charges_proprio_mensuelles?.toString() ?? "",
                      mensualite_credit: inv.mensualite_credit?.toString() ?? "",
                    });
                    setShowConfigRenta(v => !v);
                  }}
                  className={`text-xs flex items-center gap-1 border rounded-lg px-2.5 py-1.5 transition-colors ${showConfigRenta ? "bg-blue-50 border-blue-300 text-blue-600" : "text-gray-400 hover:text-blue-600 hover:border-blue-300"}`}
                >
                  ⚙ Configurer
                </button>
              </div>

              {/* Sélecteur de bail */}
              {rentabilite.length > 1 && (
                <select
                  value={activeBailId ?? ""}
                  onChange={e => { setRentaBailId(e.target.value); setShowConfigRenta(false); }}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm mb-3"
                >
                  {rentabilite.map(x => (
                    <option key={x.bail.id} value={x.bail.id}>
                      {x.bail.logement.adresse || "Sans adresse"}{x.bail.locataire.nom ? ` — ${x.bail.locataire.prenom} ${x.bail.locataire.nom}` : ""}
                      {x.configured ? "" : " (non configuré)"}
                    </option>
                  ))}
                </select>
              )}
              {rentabilite.length === 1 && rentaBail && (
                <p className="text-xs text-gray-500 mb-3 truncate">
                  {rentaBail.logement.adresse || "Sans adresse"}{rentaBail.locataire.nom ? ` — ${rentaBail.locataire.prenom} ${rentaBail.locataire.nom}` : ""}
                </p>
              )}

              {/* Formulaire configuration inline */}
              {showConfigRenta && activeBailId && (
                <div className="mb-4 bg-blue-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">Paramètres — {rentaBail?.logement.adresse || "logement"}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { label: "Prix d'achat (€)", key: "prix_achat" as const },
                      { label: "Charges proprio / mois (€)", key: "charges_proprio" as const },
                      { label: "Mensualité crédit (€)", key: "mensualite_credit" as const },
                    ] as const).map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
                        <input type="number" min="0" step="1" value={configRenta[f.key]}
                          onChange={e => setConfigRenta(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { saveRentaConfig(); setShowConfigRenta(false); }} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">Enregistrer</button>
                    <button onClick={() => setShowConfigRenta(false)} className="border px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                  </div>
                </div>
              )}

              {/* Métriques */}
              {r?.configured ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Cash-flow */}
                    <div className={`rounded-xl p-3 ${cf.bg}`}>
                      <p className="text-xs text-gray-500 mb-1">Cash-flow / mois</p>
                      <p className={`text-xl font-bold ${cf.text}`}>
                        {r.cashflow >= 0 ? "+" : ""}{r.cashflow.toFixed(0)} €
                      </p>
                      <p className={`text-xs font-medium mt-1 ${cf.text}`}>{cf.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{(r.cashflow * 12).toFixed(0)} € / an</p>
                    </div>
                    {/* Rendement brut */}
                    <div className={`rounded-xl p-3 ${rb.bg}`}>
                      <p className="text-xs text-gray-500 mb-1">Rendement brut</p>
                      <p className={`text-xl font-bold ${rb.text}`}>
                        {r.rendBrut !== null ? r.rendBrut.toFixed(1) + " %" : "—"}
                      </p>
                      <div className="mt-1.5 w-full bg-white bg-opacity-70 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${rb.bar}`} style={{ width: r.rendBrut !== null ? `${Math.min(r.rendBrut / 12 * 100, 100)}%` : "0%" }} />
                      </div>
                      <p className={`text-xs font-medium mt-1 ${rb.text}`}>{rb.label}</p>
                    </div>
                    {/* Rendement net */}
                    <div className={`rounded-xl p-3 ${rn.bg}`}>
                      <p className="text-xs text-gray-500 mb-1">Rendement net</p>
                      <p className={`text-xl font-bold ${rn.text}`}>
                        {r.rendNet !== null ? r.rendNet.toFixed(1) + " %" : "—"}
                      </p>
                      <div className="mt-1.5 w-full bg-white bg-opacity-70 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${rn.bar}`} style={{ width: r.rendNet !== null ? `${Math.min(r.rendNet / 12 * 100, 100)}%` : "0%" }} />
                      </div>
                      <p className={`text-xs font-medium mt-1 ${rn.text}`}>{rn.label}</p>
                    </div>
                  </div>
                  {/* Détail composantes */}
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
                    <div className="text-xs text-gray-500">Loyer CC<br /><span className="font-semibold text-gray-700">{r.loyerCC} €/m</span></div>
                    <div className="text-xs text-gray-500">Charges proprio<br /><span className="font-semibold text-gray-700">{inv.charges_proprio_mensuelles ?? 0} €/m</span></div>
                    <div className="text-xs text-gray-500">Crédit<br /><span className="font-semibold text-gray-700">{inv.mensualite_credit ?? 0} €/m</span></div>
                  </div>
                </>
              ) : (
                <div className="text-center py-5">
                  <p className="text-3xl mb-2">📊</p>
                  <p className="text-sm text-gray-500 mb-1">Données non configurées</p>
                  <p className="text-xs text-gray-400">Cliquez sur <span className="font-medium">⚙ Configurer</span> pour saisir le prix d'achat, les charges et le crédit.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Stats paiements */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Paiements — ponctualité</h3>
          <p className="text-xs text-gray-400 mb-4">Basé sur les paiements saisis et la date de paiement prévue</p>
          {dataPaiements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun paiement saisi sur la période.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={dataPaiements} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {dataPaiements.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => `${Number(v)} quittance(s)`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {dataPaiements.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-gray-700">{d.name}</span>
                    <span className="text-sm font-bold text-gray-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Délais moyens de relocation */}
        {dataRelocation.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-4">Délais moyens de relocation (jours entre 2 baux)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataRelocation} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="adresse" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" j" />
                <Tooltip formatter={(v: unknown) => `${Number(v)} jours`} />
                <Bar dataKey="jours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Jours vacants" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Modale incident */}
      {showIncident && baux.length > 0 && (
        <ModalIncident baux={baux} onClose={() => setShowIncident(false)} />
      )}
      {showIncident && baux.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowIncident(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm text-center">
            <p className="text-gray-700 mb-4">Vous n'avez aucun bail enregistré.</p>
            <Link href="/baux" className="text-blue-600 hover:underline text-sm" onClick={() => setShowIncident(false)}>Créer un bail →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
