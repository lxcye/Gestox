"use client";

import { useState, useRef } from "react";
import type {
  Bail, BailIncident, BailIncidentIntervention,
  IncidentHistoriqueEntry, IncidentStatut, IncidentPriorite, IncidentCategorie,
  IncidentPieceJointe, PieceJointeType,
} from "@/lib/types";
import { INCIDENT_SOUS_CATEGORIES } from "@/lib/types";
import { storeFile, getFile, deleteFile } from "@/lib/file-storage";

interface Props {
  bail: Bail;
  onSave: (bail: Bail) => void;
}

// ── Configs visuelles ─────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<IncidentStatut, { color: string; bg: string }> = {
  "Nouveau":    { color: "text-blue-700",   bg: "bg-blue-100" },
  "En cours":   { color: "text-orange-700", bg: "bg-orange-100" },
  "En attente": { color: "text-yellow-700", bg: "bg-yellow-100" },
  "Résolu":     { color: "text-green-700",  bg: "bg-green-100" },
  "Clos":       { color: "text-gray-600",   bg: "bg-gray-100" },
};

const PRIORITE_CONFIG: Record<IncidentPriorite, { color: string; border: string }> = {
  "Faible":  { color: "text-gray-500",   border: "border-gray-300" },
  "Normale": { color: "text-blue-600",   border: "border-blue-300" },
  "Haute":   { color: "text-orange-600", border: "border-orange-300" },
  "Urgente": { color: "text-red-600",    border: "border-red-300" },
};

const ICONE_MAP: Record<IncidentHistoriqueEntry["icone"], string> = {
  created:      "📋",
  status:       "🔄",
  note:         "💬",
  artisan:      "👷",
  document:     "📄",
  cost:         "💰",
  insurance:    "🛡️",
  resolved:     "✅",
  closed:       "🔒",
  mail:         "📧",
  relance:      "🔔",
  intervention: "🔧",
  devis:        "📝",
  travaux:      "🏗️",
};

const QUICK_ACTIONS: { icone: IncidentHistoriqueEntry["icone"]; label: string }[] = [
  { icone: "mail",         label: "Mail envoyé" },
  { icone: "relance",      label: "Locataire relancé" },
  { icone: "artisan",      label: "Artisan mandaté" },
  { icone: "devis",        label: "Devis reçu" },
  { icone: "travaux",      label: "Travaux effectués" },
];

// ── Constantes de formulaire ──────────────────────────────────────────────────

const CATEGORIES: IncidentCategorie[] = ["Technique", "Administratif", "Vie de l'immeuble", "Paiement", "Divers"];
const STATUTS: IncidentStatut[]       = ["Nouveau", "En cours", "En attente", "Résolu", "Clos"];
const PRIORITES: IncidentPriorite[]   = ["Faible", "Normale", "Haute", "Urgente"];
const DECLARANTS = ["", "Locataire", "Propriétaire", "Syndic", "Voisin", "Artisan", "Mandataire"] as const;
const MOYENS     = ["", "Mail", "Téléphone", "SMS", "Application", "Courrier"] as const;

const PJ_TYPES: PieceJointeType[] = ["Photo", "Vidéo", "Facture", "Devis", "Courrier", "Rapport d'expertise"];
const PJ_ACCEPT: Record<PieceJointeType, string> = {
  "Photo":               "image/*",
  "Vidéo":              "video/*",
  "Facture":            "application/pdf,image/*",
  "Devis":              "application/pdf,image/*",
  "Courrier":           "application/pdf,image/*,.doc,.docx",
  "Rapport d'expertise":"application/pdf,image/*,.doc,.docx",
};
const PJ_ICONE: Record<PieceJointeType, string> = {
  "Photo":               "🖼️",
  "Vidéo":              "🎬",
  "Facture":            "🧾",
  "Devis":              "📋",
  "Courrier":           "✉️",
  "Rapport d'expertise":"📊",
};

// ── Utilitaires ───────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(s: string) {
  return s ? new Date(s + "T12:00:00").toLocaleDateString("fr-FR") : "—";
}

function blankForm(): Omit<BailIncident, "id" | "historique"> {
  const today = new Date().toISOString().split("T")[0];
  return {
    date_creation: today, statut: "Nouveau", priorite: "Normale",
    categorie: "Technique", sous_categorie: "", objet: "", description: "",
    localisation: "", declarant: "", declarant_date: today, declarant_moyen: "",
    devis_estime: 0, cout_reel: 0, prise_en_charge: "",
    assurance_concerne: false, assurance_numero_dossier: "", assurance_nom: "",
    assurance_franchise: 0, assurance_remboursement: 0,
    resolu: false, date_resolution: "", solution: "", commentaire_final: "",
    pieces_jointes: [], interventions: [],
  };
}

function blankInterv(): Omit<BailIncidentIntervention, "id"> {
  return { artisan: "", date_prevue: "", date_realisee: "", duree: "", commentaire: "", cout: 0, facture_key: "", facture_nom: "" };
}

// ── Composant SousCategorieChips ─────────────────────────────────────────────

function SousCategorieChips({ categorie, value, onChange }: { categorie: IncidentCategorie; value: string; onChange: (v: string) => void }) {
  if (categorie === "Divers") {
    return (
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Décrivez librement la nature de l'incident…"
        className="w-full border rounded-lg px-3 py-2 text-sm" />
    );
  }
  const opts = INCIDENT_SOUS_CATEGORIES[categorie];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(s => (
        <button key={s} type="button" onClick={() => onChange(value === s ? "" : s)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            value === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
          }`}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function TabIncidents({ bail, onSave }: Props) {
  const [incidents, setIncidents]         = useState<BailIncident[]>(bail.incidents ?? []);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [view, setView]                   = useState<"list" | "detail" | "create">("list");
  const [form, setForm]                   = useState<Omit<BailIncident, "id" | "historique">>(blankForm());
  const [noteText, setNoteText]           = useState("");
  const [filterStatut, setFilterStatut]   = useState<"all" | "open" | "closed">("all");
  // PJ
  const [pjType, setPjType]               = useState<PieceJointeType>("Photo");
  const [pjUploading, setPjUploading]     = useState(false);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  // Interventions
  const [editingIntervId, setEditingIntervId] = useState<string | null>(null); // "new" | uuid | null
  const [intervForm, setIntervForm]           = useState<Omit<BailIncidentIntervention, "id">>(blankInterv());
  const [intervUploading, setIntervUploading] = useState(false);
  const intervFactureRef                      = useRef<HTMLInputElement>(null);
  // Chronologie
  const [editingHistId, setEditingHistId]     = useState<string | null>(null);
  const [editingHistText, setEditingHistText] = useState("");
  const [editingHistDate, setEditingHistDate] = useState("");
  const [noteDate, setNoteDate]               = useState(() => new Date().toISOString().split("T")[0]);
  const [noteTime, setNoteTime]               = useState(() => new Date().toTimeString().slice(0, 5));
  // Indicateur de sauvegarde
  const [lastSavedAt, setLastSavedAt]         = useState<string | null>(null);
  const [saveFlash, setSaveFlash]             = useState(false);
  const saveTimer                             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = incidents.find(i => i.id === selectedId) ?? null;

  // ── Persistence ──────────────────────────────────────────────────────────────

  function persist(updated: BailIncident[]) {
    setIncidents(updated);
    onSave({ ...bail, incidents: updated });
    const now = new Date();
    setLastSavedAt(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setSaveFlash(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveFlash(false), 3000);
  }

  function appendHistorique(inc: BailIncident, icone: IncidentHistoriqueEntry["icone"], texte: string): BailIncident {
    return { ...inc, historique: [...inc.historique, { id: crypto.randomUUID(), date: new Date().toISOString(), icone, texte }] };
  }

  // ── Handlers incidents ────────────────────────────────────────────────────────

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.objet.trim()) return;
    const inc: BailIncident = {
      ...form,
      id: crypto.randomUUID(),
      historique: [{ id: crypto.randomUUID(), date: new Date().toISOString(), icone: "created", texte: "Incident créé" }],
    };
    persist([...incidents, inc]);
    setSelectedId(inc.id);
    setView("detail");
  }

  function handleChangeStatut(inc: BailIncident, newStatut: IncidentStatut) {
    const resolu = newStatut === "Résolu" || newStatut === "Clos";
    let updated: BailIncident = {
      ...inc, statut: newStatut, resolu,
      date_resolution: resolu && !inc.date_resolution ? new Date().toISOString().split("T")[0] : inc.date_resolution,
    };
    updated = appendHistorique(updated,
      newStatut === "Résolu" ? "resolved" : newStatut === "Clos" ? "closed" : "status",
      `Statut : ${inc.statut} → ${newStatut}`);
    persist(incidents.map(i => i.id === inc.id ? updated : i));
  }

  function handleField(inc: BailIncident, fields: Partial<BailIncident>) {
    persist(incidents.map(i => i.id === inc.id ? { ...i, ...fields } : i));
  }

  function buildNoteDate(): string {
    return `${noteDate}T${noteTime || "12:00"}:00.000Z`;
  }

  function handleAddNote() {
    if (!noteText.trim() || !selected) return;
    const entry: IncidentHistoriqueEntry = { id: crypto.randomUUID(), date: buildNoteDate(), icone: "note", texte: noteText.trim() };
    persist(incidents.map(i => i.id === selected.id ? { ...i, historique: [...i.historique, entry] } : i));
    setNoteText("");
    const now = new Date();
    setNoteDate(now.toISOString().split("T")[0]);
    setNoteTime(now.toTimeString().slice(0, 5));
  }

  function handleQuickAction(icone: IncidentHistoriqueEntry["icone"], texte: string) {
    if (!selected) return;
    const entry: IncidentHistoriqueEntry = { id: crypto.randomUUID(), date: buildNoteDate(), icone, texte };
    persist(incidents.map(i => i.id === selected.id ? { ...i, historique: [...i.historique, entry] } : i));
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cet incident définitivement ?")) return;
    persist(incidents.filter(i => i.id !== id));
    setView("list");
    setSelectedId(null);
  }

  function handleSaveHistEntry() {
    if (!selected || !editingHistId) return;
    const text = editingHistText.trim();
    if (!text) return;
    handleField(selected, {
      historique: selected.historique.map(h => {
        if (h.id !== editingHistId) return h;
        const date = editingHistDate ? `${editingHistDate}T12:00:00.000Z` : h.date;
        return { ...h, texte: text, date };
      }),
    });
    setEditingHistId(null);
  }

  // ── Handlers PJ ──────────────────────────────────────────────────────────────

  async function handleAddPJ(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selected || !e.target.files?.length) return;
    setPjUploading(true);
    const newPJs: IncidentPieceJointe[] = [];
    for (const file of Array.from(e.target.files)) {
      const key = `inc_pj_${crypto.randomUUID()}`;
      await storeFile(key, file);
      newPJs.push({ id: crypto.randomUUID(), type_pj: pjType, nom: file.name.replace(/\.[^.]+$/, ""), fichier_nom: file.name, fichier_key: key, date_ajout: new Date().toISOString().split("T")[0], taille: file.size });
    }
    const updated = { ...selected, pieces_jointes: [...(selected.pieces_jointes ?? []), ...newPJs] };
    persist(incidents.map(i => i.id === selected.id ? updated : i));
    setPjUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleOpenFile(key: string, nom: string) {
    const blob = await getFile(key);
    if (!blob) { alert("Fichier introuvable."); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nom; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleDeletePJ(pj: IncidentPieceJointe) {
    if (!selected || !confirm(`Supprimer « ${pj.nom} » ?`)) return;
    await deleteFile(pj.fichier_key);
    handleField(selected, { pieces_jointes: (selected.pieces_jointes ?? []).filter(p => p.id !== pj.id) });
  }

  // ── Handlers Interventions ────────────────────────────────────────────────────

  async function handleIntervFactureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIntervUploading(true);
    const key = `inc_interv_facture_${crypto.randomUUID()}`;
    await storeFile(key, file);
    setIntervForm(f => ({ ...f, facture_key: key, facture_nom: file.name, facture_taille: file.size }));
    setIntervUploading(false);
    if (intervFactureRef.current) intervFactureRef.current.value = "";
  }

  function handleSaveInterv() {
    if (!selected) return;
    const artisan = intervForm.artisan?.trim() || "Intervenant";
    let updated: BailIncident;

    if (editingIntervId === "new") {
      const newInterv: BailIncidentIntervention = { ...blankInterv(), ...intervForm, id: crypto.randomUUID() };
      updated = { ...selected, interventions: [...(selected.interventions ?? []), newInterv] };
      updated = appendHistorique(updated, "intervention", `Intervention créée : ${artisan}`);
    } else {
      const existing = (selected.interventions ?? []).find(iv => iv.id === editingIntervId);
      const wasRealisee = existing?.date_realisee;
      const newInterv: BailIncidentIntervention = { ...existing!, ...intervForm };
      updated = { ...selected, interventions: (selected.interventions ?? []).map(iv => iv.id === editingIntervId ? newInterv : iv) };
      if (!wasRealisee && intervForm.date_realisee) {
        updated = appendHistorique(updated, "travaux", `Intervention réalisée : ${artisan}`);
      }
    }
    persist(incidents.map(i => i.id === selected.id ? updated : i));
    setEditingIntervId(null);
  }

  async function handleDeleteInterv(intervId: string) {
    if (!selected || !confirm("Supprimer cette intervention ?")) return;
    const interv = (selected.interventions ?? []).find(iv => iv.id === intervId);
    if (interv?.facture_key) await deleteFile(interv.facture_key);
    handleField(selected, { interventions: (selected.interventions ?? []).filter(iv => iv.id !== intervId) });
  }

  // ── Tri de la liste ───────────────────────────────────────────────────────────

  const filtered = incidents
    .filter(i =>
      filterStatut === "open"   ? (i.statut !== "Résolu" && i.statut !== "Clos") :
      filterStatut === "closed" ? (i.statut === "Résolu"  || i.statut === "Clos") : true)
    .sort((a, b) => {
      const po: Record<IncidentPriorite, number> = { Urgente: 0, Haute: 1, Normale: 2, Faible: 3 };
      return po[a.priorite] !== po[b.priorite] ? po[a.priorite] - po[b.priorite] : b.date_creation.localeCompare(a.date_creation);
    });

  // ═══════════════════════════════════════════════════════════════════
  // Vue création
  // ═══════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="text-sm text-gray-500 hover:text-gray-700">← Retour</button>
          <h2 className="text-lg font-bold">Nouvel incident</h2>
        </div>
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Objet <span className="text-red-500">*</span></label>
              <input type="text" value={form.objet} onChange={e => setForm(f => ({ ...f, objet: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex : Fuite robinet cuisine" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
              <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value as IncidentPriorite }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {PRIORITES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value as IncidentCategorie, sous_categorie: "" }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sous-catégorie{form.categorie === "Divers" ? " (texte libre)" : ""}
              </label>
              <SousCategorieChips categorie={form.categorie} value={form.sous_categorie} onChange={v => setForm(f => ({ ...f, sous_categorie: v }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Description détaillée de l'incident..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localisation</label>
            <input type="text" value={form.localisation} onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex : Cuisine, Salle de bain, Chambre 1..." />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Déclaration</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signalé par</label>
                <select value={form.declarant} onChange={e => setForm(f => ({ ...f, declarant: e.target.value as BailIncident["declarant"] }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {DECLARANTS.map(d => <option key={d} value={d}>{d || "— Choisir —"}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={form.declarant_date} onChange={e => setForm(f => ({ ...f, declarant_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de contact</label>
                <select value={form.declarant_moyen} onChange={e => setForm(f => ({ ...f, declarant_moyen: e.target.value as BailIncident["declarant_moyen"] }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {MOYENS.map(m => <option key={m} value={m}>{m || "— Choisir —"}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium">Créer l'incident</button>
            <button type="button" onClick={() => setView("list")} className="border px-6 py-2.5 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
          </div>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Vue détail
  // ═══════════════════════════════════════════════════════════════════
  if (view === "detail" && selected) {
    const sc = STATUT_CONFIG[selected.statut];
    const pc = PRIORITE_CONFIG[selected.priorite];
    const historiqueOrdered = [...selected.historique].sort((a, b) => a.date.localeCompare(b.date));
    const intervList = selected.interventions ?? [];

    return (
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <button onClick={() => setView("list")} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">← Retour aux incidents</button>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{selected.statut}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.border} ${pc.color}`}>{selected.priorite}</span>
              <span className="text-xs text-gray-400">{selected.categorie}{selected.sous_categorie ? ` › ${selected.sous_categorie}` : ""}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{selected.objet || "Incident sans titre"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Créé le {fmtDate(selected.date_creation)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Supprimer</button>
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              saveFlash ? "bg-green-100 text-green-700" : lastSavedAt ? "bg-gray-100 text-gray-500" : "bg-gray-100 text-gray-400"
            }`}>
              {saveFlash ? "✓ Enregistré" : lastSavedAt ? `✓ ${lastSavedAt}` : "Non modifié"}
            </div>
          </div>
        </div>

        {/* Statut + priorité */}
        <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Statut</label>
            <select value={selected.statut} onChange={e => handleChangeStatut(selected, e.target.value as IncidentStatut)} className="border rounded-lg px-3 py-1.5 text-sm">
              {STATUTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Priorité</label>
            <select value={selected.priorite} onChange={e => handleField(selected, { priorite: e.target.value as IncidentPriorite })} className="border rounded-lg px-3 py-1.5 text-sm">
              {PRIORITES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Description</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objet</label>
            <input type="text" value={selected.objet} onChange={e => handleField(selected, { objet: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
              <select value={selected.categorie} onChange={e => handleField(selected, { categorie: e.target.value as IncidentCategorie, sous_categorie: "" })} className="w-full border rounded-lg px-3 py-1.5 text-sm">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Sous-catégorie{selected.categorie === "Divers" ? " (texte libre)" : ""}
            </label>
            <SousCategorieChips categorie={selected.categorie} value={selected.sous_categorie} onChange={v => handleField(selected, { sous_categorie: v })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description détaillée</label>
            <textarea value={selected.description} onChange={e => handleField(selected, { description: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-1.5 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Localisation</label>
            <input type="text" value={selected.localisation} onChange={e => handleField(selected, { localisation: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="Ex : Cuisine, Salle de bain..." />
          </div>
        </div>

        {/* Déclaration */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Déclaration</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Signalé par</label>
              <select value={selected.declarant} onChange={e => handleField(selected, { declarant: e.target.value as BailIncident["declarant"] })} className="w-full border rounded-lg px-3 py-1.5 text-sm">
                {DECLARANTS.map(d => <option key={d} value={d}>{d || "—"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={selected.declarant_date} onChange={e => handleField(selected, { declarant_date: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Moyen de contact</label>
              <select value={selected.declarant_moyen} onChange={e => handleField(selected, { declarant_moyen: e.target.value as BailIncident["declarant_moyen"] })} className="w-full border rounded-lg px-3 py-1.5 text-sm">
                {MOYENS.map(m => <option key={m} value={m}>{m || "—"}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Interventions ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Interventions
              {intervList.length > 0 && <span className="ml-1.5 text-xs font-normal text-gray-400">({intervList.length})</span>}
            </p>
            {editingIntervId === null && (
              <button onClick={() => { setEditingIntervId("new"); setIntervForm(blankInterv()); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Ajouter une intervention
              </button>
            )}
          </div>

          {/* Liste */}
          {intervList.length === 0 && editingIntervId !== "new" && (
            <p className="text-xs text-gray-400">Aucune intervention enregistrée.</p>
          )}
          <div className="space-y-2">
            {intervList.map(interv => {
              const statutInterv = interv.date_realisee ? "Réalisée" : interv.date_prevue ? "Planifiée" : "À planifier";
              const isEditing = editingIntervId === interv.id;
              return (
                <div key={interv.id} className={`border rounded-lg overflow-hidden ${isEditing ? "border-blue-300" : "border-gray-200"}`}>
                  {/* Card résumé */}
                  {!isEditing && (
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{interv.artisan || "Intervenant non défini"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              statutInterv === "Réalisée"  ? "bg-green-100 text-green-700" :
                              statutInterv === "Planifiée" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                            }`}>{statutInterv}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-gray-500">
                            {interv.date_prevue    && <span>📅 Prévue : {fmtDate(interv.date_prevue)}</span>}
                            {interv.date_realisee  && <span>✅ Réalisée : {fmtDate(interv.date_realisee)}</span>}
                            {interv.duree          && <span>⏱ {interv.duree}</span>}
                            {interv.cout > 0       && <span>💰 {interv.cout.toLocaleString("fr-FR")} €</span>}
                            {interv.facture_nom    && (
                              <button onClick={() => handleOpenFile(interv.facture_key, interv.facture_nom)} className="text-blue-600 hover:underline">
                                🧾 {interv.facture_nom}
                              </button>
                            )}
                          </div>
                          {interv.commentaire && <p className="text-xs text-gray-400 mt-1 italic truncate">{interv.commentaire}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => { setEditingIntervId(interv.id); setIntervForm({ artisan: interv.artisan, date_prevue: interv.date_prevue, date_realisee: interv.date_realisee, duree: interv.duree, commentaire: interv.commentaire, cout: interv.cout, facture_key: interv.facture_key, facture_nom: interv.facture_nom, facture_taille: interv.facture_taille }); }}
                            className="text-xs text-blue-500 hover:underline">Modifier</button>
                          <button onClick={() => handleDeleteInterv(interv.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Formulaire d'édition inline */}
                  {isEditing && (
                    <div className="p-3 bg-blue-50 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Artisan / Intervenant</label>
                          <input type="text" value={intervForm.artisan} onChange={e => setIntervForm(f => ({ ...f, artisan: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="Nom, société…" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Date prévue</label>
                          <input type="date" value={intervForm.date_prevue} onChange={e => setIntervForm(f => ({ ...f, date_prevue: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Date réalisée</label>
                          <input type="date" value={intervForm.date_realisee} onChange={e => setIntervForm(f => ({ ...f, date_realisee: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Durée</label>
                          <input type="text" value={intervForm.duree} onChange={e => setIntervForm(f => ({ ...f, duree: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="Ex : 2h, 1 journée…" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Coût (€)</label>
                          <input type="number" min="0" step="0.01" value={intervForm.cout || ""} onChange={e => setIntervForm(f => ({ ...f, cout: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="0" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Commentaire</label>
                          <textarea value={intervForm.commentaire} onChange={e => setIntervForm(f => ({ ...f, commentaire: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white resize-none" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Facture</label>
                          {intervForm.facture_nom ? (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-700 truncate">🧾 {intervForm.facture_nom}{intervForm.facture_taille ? ` (${formatSize(intervForm.facture_taille)})` : ""}</span>
                              {intervForm.facture_key && <button type="button" onClick={() => handleOpenFile(intervForm.facture_key, intervForm.facture_nom)} className="text-xs text-blue-600 hover:underline shrink-0">Ouvrir</button>}
                              <button type="button" onClick={() => setIntervForm(f => ({ ...f, facture_key: "", facture_nom: "", facture_taille: undefined }))} className="text-xs text-red-400 hover:text-red-600 shrink-0">Supprimer</button>
                            </div>
                          ) : (
                            <label className={`flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 text-sm font-medium w-fit transition-colors ${intervUploading ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400" : "bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"}`}>
                              {intervUploading ? "Chargement…" : "📎 Joindre une facture"}
                              <input ref={intervFactureRef} type="file" accept="application/pdf,image/*" onChange={handleIntervFactureUpload} disabled={intervUploading} className="hidden" />
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={handleSaveInterv} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">Enregistrer</button>
                        <button type="button" onClick={() => setEditingIntervId(null)} className="border px-4 py-1.5 rounded-lg text-sm hover:bg-white">Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulaire nouvelle intervention */}
          {editingIntervId === "new" && (
            <div className="border border-blue-300 rounded-lg p-3 bg-blue-50 space-y-3">
              <p className="text-xs font-semibold text-blue-700">Nouvelle intervention</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Artisan / Intervenant</label>
                  <input type="text" value={intervForm.artisan} onChange={e => setIntervForm(f => ({ ...f, artisan: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="Nom, société…" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date prévue</label>
                  <input type="date" value={intervForm.date_prevue} onChange={e => setIntervForm(f => ({ ...f, date_prevue: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date réalisée</label>
                  <input type="date" value={intervForm.date_realisee} onChange={e => setIntervForm(f => ({ ...f, date_realisee: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Durée</label>
                  <input type="text" value={intervForm.duree} onChange={e => setIntervForm(f => ({ ...f, duree: e.target.value }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="Ex : 2h, 1 journée…" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Coût (€)</label>
                  <input type="number" min="0" step="0.01" value={intervForm.cout || ""} onChange={e => setIntervForm(f => ({ ...f, cout: parseFloat(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Commentaire</label>
                  <textarea value={intervForm.commentaire} onChange={e => setIntervForm(f => ({ ...f, commentaire: e.target.value }))} rows={2} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Facture</label>
                  {intervForm.facture_nom ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-700 truncate">🧾 {intervForm.facture_nom}{intervForm.facture_taille ? ` (${formatSize(intervForm.facture_taille)})` : ""}</span>
                      {intervForm.facture_key && <button type="button" onClick={() => handleOpenFile(intervForm.facture_key, intervForm.facture_nom)} className="text-xs text-blue-600 hover:underline shrink-0">Ouvrir</button>}
                      <button type="button" onClick={() => setIntervForm(f => ({ ...f, facture_key: "", facture_nom: "", facture_taille: undefined }))} className="text-xs text-red-400 hover:text-red-600 shrink-0">Supprimer</button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 text-sm font-medium w-fit transition-colors ${intervUploading ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400" : "bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"}`}>
                      {intervUploading ? "Chargement…" : "📎 Joindre une facture"}
                      <input ref={intervFactureRef} type="file" accept="application/pdf,image/*" onChange={handleIntervFactureUpload} disabled={intervUploading} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleSaveInterv} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">Enregistrer</button>
                <button type="button" onClick={() => setEditingIntervId(null)} className="border px-4 py-1.5 rounded-lg text-sm hover:bg-white">Annuler</button>
              </div>
            </div>
          )}
        </div>

        {/* Coûts */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            Coûts
            {intervList.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                Interventions : {intervList.reduce((s, iv) => s + (iv.cout ?? 0), 0).toLocaleString("fr-FR")} €
              </span>
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Devis estimé (€)</label>
              <input type="number" min="0" step="0.01" value={selected.devis_estime || ""} onChange={e => handleField(selected, { devis_estime: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Coût réel (€)</label>
              <input type="number" min="0" step="0.01" value={selected.cout_reel || ""} onChange={e => handleField(selected, { cout_reel: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pris en charge par</label>
              <select value={selected.prise_en_charge} onChange={e => handleField(selected, { prise_en_charge: e.target.value as BailIncident["prise_en_charge"] })} className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">—</option>
                {["Propriétaire", "Locataire", "Assurance", "Syndic"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Assurance */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">Assurance</p>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={selected.assurance_concerne} onChange={e => handleField(selected, { assurance_concerne: e.target.checked })} className="rounded" />
              Concerne une assurance
            </label>
          </div>
          {selected.assurance_concerne && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assurance concernée</label>
                <input type="text" value={selected.assurance_nom} onChange={e => handleField(selected, { assurance_nom: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="Nom de l'assurance" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">N° dossier</label>
                <input type="text" value={selected.assurance_numero_dossier} onChange={e => handleField(selected, { assurance_numero_dossier: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="2025-XXXXX" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Franchise (€)</label>
                <input type="number" min="0" step="0.01" value={selected.assurance_franchise || ""} onChange={e => handleField(selected, { assurance_franchise: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Remboursement (€)</label>
                <input type="number" min="0" step="0.01" value={selected.assurance_remboursement || ""} onChange={e => handleField(selected, { assurance_remboursement: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
              </div>
            </div>
          )}
        </div>

        {/* Résolution */}
        {(selected.statut === "Résolu" || selected.statut === "Clos") && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Résolution</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date de résolution</label>
                <input type="date" value={selected.date_resolution} onChange={e => handleField(selected, { date_resolution: e.target.value })} className="w-full border rounded-lg px-3 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Solution apportée</label>
              <textarea value={selected.solution} onChange={e => handleField(selected, { solution: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-1.5 text-sm resize-none" placeholder="Décrire la solution..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Commentaire final</label>
              <textarea value={selected.commentaire_final} onChange={e => handleField(selected, { commentaire_final: e.target.value })} rows={2} className="w-full border rounded-lg px-3 py-1.5 text-sm resize-none" />
            </div>
          </div>
        )}

        {/* Pièces jointes */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Pièces jointes</p>
          {(selected.pieces_jointes ?? []).length > 0 && (
            <div className="space-y-2">
              {(selected.pieces_jointes ?? []).map(pj => (
                <div key={pj.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-xl shrink-0">{PJ_ICONE[pj.type_pj]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{pj.nom || pj.fichier_nom}</p>
                    <p className="text-xs text-gray-400">
                      {pj.type_pj} · {pj.fichier_nom}
                      {pj.taille ? ` · ${formatSize(pj.taille)}` : ""}
                      {" · "}{fmtDate(pj.date_ajout)}
                    </p>
                  </div>
                  <button onClick={() => handleOpenFile(pj.fichier_key, pj.fichier_nom)} className="text-xs text-blue-600 hover:underline shrink-0">Ouvrir</button>
                  <button onClick={() => handleDeletePJ(pj)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={pjType} onChange={e => setPjType(e.target.value as PieceJointeType)} className="border rounded-lg px-2 py-1.5 text-sm">
              {PJ_TYPES.map(t => <option key={t} value={t}>{PJ_ICONE[t]} {t}</option>)}
            </select>
            <label className={`flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${pjUploading ? "opacity-50 cursor-not-allowed bg-gray-50 text-gray-400" : "bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"}`}>
              {pjUploading ? "Chargement…" : "+ Ajouter un fichier"}
              <input ref={fileInputRef} type="file" multiple accept={PJ_ACCEPT[pjType]} onChange={handleAddPJ} disabled={pjUploading} className="hidden" />
            </label>
          </div>
          {(selected.pieces_jointes ?? []).length === 0 && (
            <p className="text-xs text-gray-400">Aucune pièce jointe. Ajoutez des photos, devis, factures…</p>
          )}
        </div>

        {/* ── Chronologie ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            Chronologie
            <span className="ml-2 text-xs font-normal text-gray-400">{historiqueOrdered.length} entrée{historiqueOrdered.length > 1 ? "s" : ""}</span>
          </p>
          <div className="relative pl-8">
            {historiqueOrdered.map((entry, idx) => {
              const [datePart, timePart] = entry.date.split("T");
              const dateStr = datePart ? new Date(datePart + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
              const timeStr = timePart ? timePart.slice(0, 5) : "";
              const isLast = idx === historiqueOrdered.length - 1;
              const isEditing = editingHistId === entry.id;
              return (
                <div key={entry.id} className="relative mb-5">
                  {!isLast && <div className="absolute left-[-20px] top-6 bottom-[-12px] w-px bg-gray-200" />}
                  <div className="absolute left-[-28px] top-0 w-8 h-8 flex items-center justify-center text-lg select-none">
                    {ICONE_MAP[entry.icone] ?? "📌"}
                  </div>
                  <div className={`rounded-xl px-4 py-3 ${isEditing ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">{dateStr}</span>
                        {timeStr && <span className="text-xs text-gray-400">{timeStr}</span>}
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => { setEditingHistId(entry.id); setEditingHistText(entry.texte); setEditingHistDate(entry.date.split("T")[0]); }}
                          className="text-xs text-blue-500 hover:text-blue-700 hover:underline shrink-0 font-medium"
                        >
                          Modifier
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Date :</span>
                          <input type="date" value={editingHistDate} onChange={e => setEditingHistDate(e.target.value)}
                            className="border rounded px-2 py-1 text-xs" />
                        </div>
                        <textarea
                          value={editingHistText}
                          onChange={e => setEditingHistText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveHistEntry(); } if (e.key === "Escape") setEditingHistId(null); }}
                          rows={2}
                          autoFocus
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm resize-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveHistEntry} disabled={!editingHistText.trim()} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-40">✓ Enregistrer</button>
                          <button onClick={() => setEditingHistId(null)} className="text-xs border px-3 py-1 rounded-lg hover:bg-white">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">{entry.texte}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Date de l'événement */}
          <div className="flex items-center gap-2 mt-4 mb-2 bg-gray-50 border rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Date événement :</span>
            <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
              className="border rounded px-2 py-1 text-xs" />
            <input type="time" value={noteTime} onChange={e => setNoteTime(e.target.value)}
              className="border rounded px-2 py-1 text-xs w-24" />
            <span className="text-xs text-gray-400 hidden sm:inline">— appliquée aux actions ci-dessous</span>
          </div>

          {/* Actions rapides */}
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2">Actions rapides :</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ icone, label }) => (
                <button key={icone} type="button"
                  onClick={() => handleQuickAction(icone, label)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600 font-medium transition-colors">
                  {ICONE_MAP[icone]} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Saisie libre */}
          <div className="flex gap-2">
            <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddNote(); } }}
              placeholder="Ajouter une note libre…"
              className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button onClick={handleAddNote} disabled={!noteText.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40">
              Ajouter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Vue liste
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">Incidents</h2>
          {incidents.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{incidents.length}</span>}
        </div>
        <button onClick={() => { setForm(blankForm()); setView("create"); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Nouvel incident
        </button>
      </div>

      {incidents.length > 0 && (
        <div className="flex gap-2 mb-4">
          {([["all", "Tous"], ["open", "En cours"], ["closed", "Résolus / Clos"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilterStatut(key)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterStatut === key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Aucun incident enregistré pour ce bail.</p>
          <button onClick={() => { setForm(blankForm()); setView("create"); }} className="mt-3 text-sm text-blue-600 hover:underline">Déclarer le premier incident →</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucun incident dans cette catégorie.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(inc => {
            const sc = STATUT_CONFIG[inc.statut];
            const pc = PRIORITE_CONFIG[inc.priorite];
            const nonResolu = inc.statut !== "Résolu" && inc.statut !== "Clos";
            const nbInterv = (inc.interventions ?? []).length;
            return (
              <div key={inc.id} onClick={() => { setSelectedId(inc.id); setView("detail"); }}
                className={`bg-white rounded-xl border cursor-pointer p-4 hover:border-blue-300 hover:shadow-sm transition-all ${nonResolu && inc.priorite === "Urgente" ? "border-red-200" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{inc.statut}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.border} ${pc.color}`}>{inc.priorite}</span>
                      <span className="text-xs text-gray-400">{inc.categorie}{inc.sous_categorie ? ` › ${inc.sous_categorie}` : ""}</span>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm truncate">{inc.objet || "Incident sans titre"}</p>
                    {inc.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{inc.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      <span>📅 {fmtDate(inc.date_creation)}</span>
                      {inc.declarant && <span>👤 {inc.declarant}</span>}
                      {nbInterv > 0 && <span>🔧 {nbInterv} intervention{nbInterv > 1 ? "s" : ""}</span>}
                      {inc.cout_reel > 0 && <span>💰 {inc.cout_reel.toLocaleString("fr-FR")} €</span>}
                      {(inc.pieces_jointes ?? []).length > 0 && <span>📎 {inc.pieces_jointes.length} PJ</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 text-xl shrink-0">›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
