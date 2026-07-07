"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Bail, EtatDesLieux, PieceEDL, CategorieEDL, ItemEDL, ReleverCompteur, CleRemise,
  ConfigLogement, EquipementLogement,
} from "@/lib/types";

const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getDate()} ${MOIS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}
import {
  getParametres,
  getEtatsDesLieuxForBail, saveEtatDesLieux, deleteEtatDesLieux,
  getConfigLogement, saveConfigLogement,
  addLearnedCaracteristique, getLearnedCaracteristiques,
} from "@/lib/store";
import { storeFile, getFile } from "@/lib/file-storage";
import { defaultPieces, defaultReleves, defaultCles, makeItem, ETATS_OPTIONS, ETATS_LEGENDES, getCaracteristiquesSuggestions, OBSERVATIONS_PREDEFINIES } from "@/lib/edl-defaults";
import SignaturePad from "@/components/SignaturePad";

const DEFAULT_EXT = ["Boîte aux lettres", "Interphone", "Digicode", "Portail / Porte principale", "Parking", "Cave", "Balcon / Terrasse"];
const DEFAULT_INT = ["Détecteur de fumée", "VMC / Ventilation", "Chauffe-eau / Ballon", "Tableau électrique", "Compteur électrique", "Compteur eau", "Compteur gaz"];

function makeEquipement(nom: string): EquipementLogement {
  return { id: crypto.randomUUID(), nom, present: true, etat: "", commentaire: "" };
}

function migrateEtat(e: unknown): import("@/lib/types").EtatElement {
  const MAP: Record<string, import("@/lib/types").EtatElement> = {
    "Très bon état": "Bon état", "Bon état": "Bon état", "Neuf": "Neuf",
    "État d'usage": "État moyen", "Mauvais état": "Dégradé",
    "État moyen": "État moyen", "Usage avancé": "Usage avancé", "Dégradé": "Dégradé",
  };
  return MAP[e as string] ?? "";
}
function migrateItem(raw: Record<string, unknown>): ItemEDL {
  return {
    id: (raw.id as string) ?? crypto.randomUUID(),
    nom: (raw.nom as string) ?? "",
    quantite: (raw.quantite as string) || "1",
    caracteristiques: Array.isArray(raw.caracteristiques) ? raw.caracteristiques as string[]
      : raw.nature ? [raw.nature as string] : [],
    etat: raw.etat ? migrateEtat(raw.etat) : "Bon état",
    observations: Array.isArray(raw.observations) ? raw.observations as string[] : ["RAS"],
    commentaire: (raw.commentaire as string) ?? "",
    photos: Array.isArray(raw.photos) ? raw.photos as string[]
      : raw.photo ? [raw.photo as string] : [],
  };
}
function migratePiece(p: PieceEDL & { elements?: unknown[]; meubles?: unknown[] }): PieceEDL {
  if (p.categories) {
    return { ...p, categories: p.categories.map(c => ({ ...c, items: c.items.map(i => migrateItem(i as unknown as Record<string, unknown>)) })) };
  }
  const elements = (p.elements ?? []) as Record<string, unknown>[];
  const meubles = (p.meubles ?? []) as Record<string, unknown>[];
  return {
    id: p.id, nom: p.nom, present: p.present, photos: p.photos ?? [],
    categories: [
      { id: crypto.randomUUID(), nom: "Éléments structurels", items: elements.map(migrateItem) },
      { id: crypto.randomUUID(), nom: "Mobilier", items: meubles.map(migrateItem) },
    ],
  };
}

interface Props { bail: Bail; bailId: string; }

export default function TabEDL({ bail, bailId }: Props) {
  const [edls, setEdls] = useState<EtatDesLieux[]>([]);
  const [editEdl, setEditEdl] = useState<EtatDesLieux | null>(null);
  const [edlSubTab, setEdlSubTab] = useState<"logement" | "entrant" | "sortant">("logement");
  const [edlFormMode, setEdlFormMode] = useState(false);
  const [edlStep, setEdlStep] = useState(0);
  const [edlActiveCat, setEdlActiveCat] = useState<string | null>(null);
  const [configLogement, setConfigLogement] = useState<ConfigLogement | null>(null);
  const [structurePiece, setStructurePiece] = useState<string | null>(null);
  const [structureCat, setStructureCat] = useState<string | null>(null);
  const [signateurActif, setSignateurActif] = useState<"proprietaire" | "locataire" | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newItemInput, setNewItemInput] = useState("");
  const [dragPieceId, setDragPieceId] = useState<string | null>(null);
  const [newItemByCat, setNewItemByCat] = useState<Record<string, string>>({});
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [customCaractInput, setCustomCaractInput] = useState("");
  const [customObsInput, setCustomObsInput] = useState("");
  const [pieceSaved, setPieceSaved] = useState(false);
  const [showEdlLegend, setShowEdlLegend] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  type PhotoTarget =
    | { kind: "piece"; pieceId: string }
    | { kind: "item"; pieceId: string; catId: string; itemId: string };
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);

  const p = typeof window !== "undefined" ? getParametres() : null!;

  function reload() {
    setEdls(getEtatsDesLieuxForBail(bailId).map(e => ({ ...e, pieces: (e.pieces ?? []).map(migratePiece) })));
    const logementId = `${bail.logement.adresse}_${bail.logement.code_postal}`.replace(/\s+/g, "_");
    const existingConfig = getConfigLogement(logementId);
    setConfigLogement({
      id: logementId, bail_id: bailId,
      equipements_exterieurs: existingConfig?.equipements_exterieurs ?? DEFAULT_EXT.map(makeEquipement),
      equipements_interieurs: existingConfig?.equipements_interieurs ?? DEFAULT_INT.map(makeEquipement),
      releves_compteurs: existingConfig?.releves_compteurs ?? defaultReleves(),
      cles: existingConfig?.cles ?? defaultCles(),
      pieces: existingConfig?.pieces ?? defaultPieces(),
      updated_at: existingConfig?.updated_at ?? "",
    });
  }
  useEffect(() => { reload(); }, [bailId]);

  function flash() { setPieceSaved(true); setTimeout(() => setPieceSaved(false), 2000); }

  // ── État des lieux ──
  function newEdl(type: "Entrant" | "Sortant"): EtatDesLieux {
    const cfg = configLogement!;
    // Pour le sortant : on part de l'entrant s'il existe (même états/caract/quantités, reset photos/valeurs/signatures)
    if (type === "Sortant") {
      const entrant = edls.find(e => e.type === "Entrant");
      if (entrant) {
        return {
          ...JSON.parse(JSON.stringify(entrant)),
          id: crypto.randomUUID(),
          type: "Sortant",
          date: new Date().toISOString().split("T")[0],
          heure: new Date().toTimeString().slice(0, 5),
          annexes_documents: "",
          commentaire_general: "",
          signature_proprietaire: null,
          signature_locataire: null,
          signe_proprietaire_at: "",
          signe_locataire_at: "",
          created_at: "",
          updated_at: "",
          releves_compteurs: entrant.releves_compteurs.map((r: ReleverCompteur) => ({ ...r, valeur: "", photo: "" })),
          pieces: entrant.pieces.map((p: PieceEDL) => ({
            ...p,
            photos: [],
            categories: p.categories.map((c: CategorieEDL) => ({
              ...c,
              items: c.items.map((i: ItemEDL) => ({ ...i, photos: [] })),
            })),
          })),
        };
      }
    }
    const pieces: PieceEDL[] = cfg.pieces.filter(p => p.present).map(p => ({
      ...JSON.parse(JSON.stringify(p)),
      photos: [],
      categories: p.categories.map((c: CategorieEDL) => ({
        ...c,
        items: c.items.map((i: ItemEDL) => ({ ...i, etat: "Bon état" as const, observations: ["RAS"], commentaire: "", photos: [] })),
      })),
    }));
    return {
      id: crypto.randomUUID(),
      bail_id: bailId,
      type,
      date: new Date().toISOString().split("T")[0],
      heure: new Date().toTimeString().slice(0, 5),
      pieces,
      releves_compteurs: JSON.parse(JSON.stringify(cfg.releves_compteurs)),
      cles: JSON.parse(JSON.stringify(cfg.cles)),
      cles_remises: "",
      codes_acces: cfg.equipements_exterieurs.some(e => e.nom === "Digicode" && e.present)
        ? [{ id: crypto.randomUUID(), label: "Digicode entrée", code: "" }]
        : [],
      annexes_documents: "",
      commentaire_general: "",
      signature_proprietaire: null,
      signature_locataire: null,
      signe_proprietaire_at: "",
      signe_locataire_at: "",
      created_at: "",
      updated_at: "",
    };
  }

  function saveEdlForm() {
    if (!editEdl) return;
    saveEtatDesLieux(editEdl);
    if (configLogement) saveConfigLogement(configLogement);
    reload();
    setEdlFormMode(false);
    setEditEdl(null);
    setEdlStep(0);
    setEdlActiveCat(null);
    flash();
  }
  function saveEdlDraft() {
    if (!editEdl) return;
    saveEtatDesLieux(editEdl);
    if (configLogement) saveConfigLogement(configLogement);
    setPieceSaved(true);
    setTimeout(() => setPieceSaved(false), 2000);
  }

  function saveConfig() {
    if (!configLogement) return;
    saveConfigLogement(configLogement);
    flash();
  }

  // ── Fonctions config structure ──
  function updateEquipementExt(id: string, update: Partial<EquipementLogement>) {
    if (!configLogement) return;
    setConfigLogement({ ...configLogement, equipements_exterieurs: configLogement.equipements_exterieurs.map(e => e.id === id ? { ...e, ...update } : e) });
  }
  function updateEquipementInt(id: string, update: Partial<EquipementLogement>) {
    if (!configLogement) return;
    setConfigLogement({ ...configLogement, equipements_interieurs: configLogement.equipements_interieurs.map(e => e.id === id ? { ...e, ...update } : e) });
  }
  function updateConfigCompteur(id: string, update: Partial<ReleverCompteur>) {
    if (!configLogement) return;
    setConfigLogement({ ...configLogement, releves_compteurs: configLogement.releves_compteurs.map(c => c.id === id ? { ...c, ...update } : c) });
  }
  function updateConfigPieceCat(pieceId: string, catId: string, updCat: Partial<CategorieEDL>) {
    if (!configLogement) return;
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, ...updCat } : c) }
        : p),
    });
  }
  function addItemToConfig(pieceId: string, catId: string, nom: string) {
    if (!configLogement || !nom.trim()) return;
    const newItem: ItemEDL = makeItem(nom.trim());
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: [...c.items, newItem] } : c) }
        : p),
    });
  }
  function removeItemFromConfig(pieceId: string, catId: string, itemId: string) {
    if (!configLogement) return;
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) }
        : p),
    });
  }
  function addCatToConfig(pieceId: string, nom: string) {
    if (!configLogement || !nom.trim()) return;
    const newCat: CategorieEDL = { id: crypto.randomUUID(), nom: nom.trim(), items: [] };
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId ? { ...p, categories: [...p.categories, newCat] } : p),
    });
  }
  function toggleConfigPiece(pieceId: string, present: boolean) {
    if (!configLogement) return;
    setConfigLogement({ ...configLogement, pieces: configLogement.pieces.map(p => p.id === pieceId ? { ...p, present } : p) });
  }
  function movePiece(id: string, dir: "up" | "down") {
    if (!configLogement) return;
    const arr = [...configLogement.pieces];
    const idx = arr.findIndex(p => p.id === id);
    if (dir === "up" && idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; }
    if (dir === "down" && idx < arr.length - 1) { [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; }
    setConfigLogement({ ...configLogement, pieces: arr });
  }
  function dropPiece(fromId: string, toId: string) {
    if (!configLogement || fromId === toId) return;
    const arr = [...configLogement.pieces];
    const from = arr.findIndex(p => p.id === fromId);
    const to = arr.findIndex(p => p.id === toId);
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setConfigLogement({ ...configLogement, pieces: arr });
  }

  // ── Fonctions EDL ──
  function updateEdlItem(pieceId: string, catId: string, itemId: string, update: Partial<ItemEDL>) {
    if (!editEdl) return;
    setEditEdl({
      ...editEdl,
      pieces: editEdl.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId
          ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...update } : i) }
          : c) }
        : p),
    });
  }
  function addEdlItem(pieceId: string, catId: string, nom: string) {
    if (!editEdl || !configLogement || !nom.trim()) return;
    const newItem: ItemEDL = makeItem(nom.trim());
    setEditEdl({
      ...editEdl,
      pieces: editEdl.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: [...c.items, newItem] } : c) }
        : p),
    });
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: [...c.items, { ...newItem, etat: "", commentaire: "" }] } : c) }
        : p),
    });
  }
  function removeEdlItem(pieceId: string, catId: string, itemId: string) {
    if (!editEdl || !configLogement) return;
    setEditEdl({
      ...editEdl,
      pieces: editEdl.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) }
        : p),
    });
    setConfigLogement({
      ...configLogement,
      pieces: configLogement.pieces.map(p => p.id === pieceId
        ? { ...p, categories: p.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) }
        : p),
    });
  }
  function updateEdlCompteur(id: string, update: Partial<ReleverCompteur>) {
    if (!editEdl) return;
    setEditEdl({ ...editEdl, releves_compteurs: editEdl.releves_compteurs.map(c => c.id === id ? { ...c, ...update } : c) });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editEdl || !photoTarget) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const key = `edl_photo_${crypto.randomUUID()}`;
    await storeFile(key, file);
    const url = URL.createObjectURL(file);
    setPhotoUrls((prev) => ({ ...prev, [key]: url }));
    if (photoTarget.kind === "piece") {
      setEditEdl({
        ...editEdl,
        pieces: editEdl.pieces.map(p => p.id === photoTarget.pieceId ? { ...p, photos: [...p.photos, key] } : p),
      });
    } else {
      const piece = editEdl.pieces.find(p => p.id === photoTarget.pieceId);
      const cat = piece?.categories.find(c => c.id === photoTarget.catId);
      const item = cat?.items.find(i => i.id === photoTarget.itemId);
      if (item) updateEdlItem(photoTarget.pieceId, photoTarget.catId, photoTarget.itemId, { photos: [...(item.photos ?? []), key] });
    }
    setPhotoTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function loadPhotoUrl(key: string) {
    if (!key || photoUrls[key]) return;
    const blob = await getFile(key);
    if (blob) {
      setPhotoUrls((prev) => ({ ...prev, [key]: URL.createObjectURL(blob) }));
    }
  }

  function handleSignature(sig: string) {
    if (!editEdl || !signateurActif) return;
    const now = new Date().toISOString();
    if (signateurActif === "proprietaire") {
      setEditEdl({ ...editEdl, signature_proprietaire: sig, signe_proprietaire_at: now });
    } else {
      setEditEdl({ ...editEdl, signature_locataire: sig, signe_locataire_at: now });
    }
    setSignateurActif(null);
  }

  return (
    <div>
          <div>
            {/* 3 onglets — cachés en mode formulaire */}
            {!edlFormMode && (
              <div className="flex border-b mb-5 overflow-x-auto">
                {(["logement", "entrant", "sortant"] as const).map((tab) => {
                  const labels = { logement: "Structure du logement", entrant: "EDL Entrant", sortant: "EDL Sortant" };
                  const hasEdl = tab !== "logement" && edls.some(e => e.type === (tab === "entrant" ? "Entrant" : "Sortant"));
                  return (
                    <button key={tab}
                      onClick={() => { setEdlSubTab(tab); setEditEdl(null); }}
                      className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                        edlSubTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}>
                      {labels[tab]}{hasEdl ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Tab Structure du logement ── */}
            {edlSubTab === "logement" && !edlFormMode && configLogement && (
              <div className="space-y-8">

                {/* Équipements extérieurs */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">Équipements extérieurs</h3>
                    <button onClick={() => setConfigLogement({ ...configLogement, equipements_exterieurs: [...configLogement.equipements_exterieurs, makeEquipement("")] })}
                      className="text-sm text-blue-600 hover:underline">+ Ajouter</button>
                  </div>
                  <div className="divide-y border rounded-xl overflow-hidden">
                    {configLogement.equipements_exterieurs.map((eq) => (
                      <div key={eq.id} className="grid grid-cols-[auto_1fr_140px_1fr_auto] gap-3 items-center px-4 py-2.5">
                        <input type="checkbox" checked={eq.present}
                          onChange={(e) => updateEquipementExt(eq.id, { present: e.target.checked })}
                          className="rounded flex-shrink-0" />
                        <input value={eq.nom}
                          onChange={(e) => updateEquipementExt(eq.id, { nom: e.target.value })}
                          className={`border-0 bg-transparent text-sm font-medium outline-none w-full min-w-0 ${!eq.present ? "text-gray-400 line-through" : "text-gray-800"}`}
                          placeholder="Nom de l'équipement" />
                        <select value={eq.etat}
                          onChange={(e) => updateEquipementExt(eq.id, { etat: e.target.value as typeof eq.etat })}
                          className="border rounded px-2 py-1 text-xs">
                          <option value="">-- État --</option>
                          {ETATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <input value={eq.commentaire}
                          onChange={(e) => updateEquipementExt(eq.id, { commentaire: e.target.value })}
                          placeholder="Commentaire..." className="border rounded px-2 py-1 text-xs w-full" />
                        <button onClick={() => setConfigLogement({ ...configLogement, equipements_exterieurs: configLogement.equipements_exterieurs.filter(e => e.id !== eq.id) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Équipements intérieurs */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">Équipements intérieurs</h3>
                    <button onClick={() => setConfigLogement({ ...configLogement, equipements_interieurs: [...configLogement.equipements_interieurs, makeEquipement("")] })}
                      className="text-sm text-blue-600 hover:underline">+ Ajouter</button>
                  </div>
                  <div className="divide-y border rounded-xl overflow-hidden">
                    {configLogement.equipements_interieurs.map((eq) => (
                      <div key={eq.id} className="grid grid-cols-[auto_1fr_140px_1fr_auto] gap-3 items-center px-4 py-2.5">
                        <input type="checkbox" checked={eq.present}
                          onChange={(e) => updateEquipementInt(eq.id, { present: e.target.checked })}
                          className="rounded flex-shrink-0" />
                        <input value={eq.nom}
                          onChange={(e) => updateEquipementInt(eq.id, { nom: e.target.value })}
                          className={`border-0 bg-transparent text-sm font-medium outline-none w-full min-w-0 ${!eq.present ? "text-gray-400 line-through" : "text-gray-800"}`}
                          placeholder="Nom de l'équipement" />
                        <select value={eq.etat}
                          onChange={(e) => updateEquipementInt(eq.id, { etat: e.target.value as typeof eq.etat })}
                          className="border rounded px-2 py-1 text-xs">
                          <option value="">-- État --</option>
                          {ETATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <input value={eq.commentaire}
                          onChange={(e) => updateEquipementInt(eq.id, { commentaire: e.target.value })}
                          placeholder="Commentaire..." className="border rounded px-2 py-1 text-xs w-full" />
                        <button onClick={() => setConfigLogement({ ...configLogement, equipements_interieurs: configLogement.equipements_interieurs.filter(e => e.id !== eq.id) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Relevés de compteurs */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Relevés de compteurs</h3>
                  <div className="divide-y border rounded-xl overflow-hidden">
                    {configLogement.releves_compteurs.map((c) => (
                      <div key={c.id} className="grid grid-cols-[1fr_80px_120px_auto] gap-3 items-center px-4 py-2.5">
                        <input value={c.type}
                          onChange={(e) => updateConfigCompteur(c.id, { type: e.target.value })}
                          placeholder="Type (ex: Électricité)" className="border-0 bg-transparent text-sm font-medium outline-none w-full" />
                        <input value={c.unite}
                          onChange={(e) => updateConfigCompteur(c.id, { unite: e.target.value })}
                          placeholder="Unité" className="border rounded px-2 py-1 text-xs" />
                        <input value={c.numero}
                          onChange={(e) => updateConfigCompteur(c.id, { numero: e.target.value })}
                          placeholder="N° compteur" className="border rounded px-2 py-1 text-xs" />
                        <button onClick={() => setConfigLogement({ ...configLogement, releves_compteurs: configLogement.releves_compteurs.filter(r => r.id !== c.id) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                    <div className="px-4 py-2">
                      <button onClick={() => setConfigLogement({ ...configLogement, releves_compteurs: [...configLogement.releves_compteurs, { id: crypto.randomUUID(), type: "", numero: "", valeur: "", unite: "", photo: "" }] })}
                        className="text-sm text-blue-600 hover:underline">+ Ajouter un compteur</button>
                    </div>
                  </div>
                </div>

                {/* Clés et accès */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Clés et accès</h3>
                  <div className="divide-y border rounded-xl overflow-hidden">
                    {configLogement.cles.map((cle) => (
                      <div key={cle.id} className="flex items-center gap-3 px-4 py-2.5">
                        <input value={cle.type}
                          onChange={(e) => setConfigLogement({ ...configLogement, cles: configLogement.cles.map(c => c.id === cle.id ? { ...c, type: e.target.value } : c) })}
                          placeholder="Type (ex: Clé appartement)" className="flex-1 border-0 bg-transparent text-sm font-medium outline-none" />
                        <input type="number" min="0" value={cle.quantite}
                          onChange={(e) => setConfigLogement({ ...configLogement, cles: configLogement.cles.map(c => c.id === cle.id ? { ...c, quantite: e.target.value } : c) })}
                          className="w-14 border rounded px-2 py-1 text-xs text-center" />
                        <button onClick={() => setConfigLogement({ ...configLogement, cles: configLogement.cles.filter(c => c.id !== cle.id) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                    <div className="px-4 py-2">
                      <button onClick={() => setConfigLogement({ ...configLogement, cles: [...configLogement.cles, { id: crypto.randomUUID(), type: "", quantite: "1" }] })}
                        className="text-sm text-blue-600 hover:underline">+ Ajouter</button>
                    </div>
                  </div>
                </div>

                {/* Pièces du logement */}
                <div>
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-800">Pièces du logement</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Cliquez sur une pièce pour configurer son contenu. Cochez les pièces présentes.</p>
                  </div>

                  {/* Liste réorganisable des pièces */}
                  <div className="space-y-1 mb-4">
                    {configLogement.pieces.map((piece, idx) => (
                      <div key={piece.id}
                        draggable
                        onDragStart={() => setDragPieceId(piece.id)}
                        onDragEnd={() => setDragPieceId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (dragPieceId) dropPiece(dragPieceId, piece.id); setDragPieceId(null); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all select-none ${
                          dragPieceId === piece.id ? "opacity-40 scale-95" :
                          structurePiece === piece.id ? "bg-blue-50 border-blue-300 shadow-sm" :
                          piece.present ? "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm" :
                          "bg-gray-50 border-gray-100"
                        }`}>
                        <span className="text-gray-300 cursor-grab text-sm shrink-0" title="Glisser pour réordonner">⠿⠿</span>
                        <button
                          onClick={() => { setStructurePiece(structurePiece === piece.id ? null : piece.id); setStructureCat(null); }}
                          className={`flex-1 text-left text-sm font-medium ${piece.present ? (structurePiece === piece.id ? "text-blue-700" : "text-gray-800") : "text-gray-400"}`}>
                          {idx + 1}. {piece.nom}
                        </button>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer shrink-0">
                          <input type="checkbox" checked={piece.present}
                            onChange={(e) => toggleConfigPiece(piece.id, e.target.checked)}
                            className="rounded w-3.5 h-3.5" />
                          Présente
                        </label>
                        <div className="flex flex-col shrink-0">
                          <button onClick={() => movePiece(piece.id, "up")} disabled={idx === 0}
                            className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs rounded hover:bg-blue-50 transition-colors">▲</button>
                          <button onClick={() => movePiece(piece.id, "down")} disabled={idx === configLogement.pieces.length - 1}
                            className="w-5 h-4 flex items-center justify-center text-gray-400 hover:text-blue-600 disabled:opacity-20 text-xs rounded hover:bg-blue-50 transition-colors">▼</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Détail pièce sélectionnée */}
                  {structurePiece && (() => {
                    const piece = configLogement.pieces.find(p => p.id === structurePiece);
                    if (!piece) return null;
                    const activeCat = piece.categories.find(c => c.id === structureCat) ?? piece.categories[0] ?? null;
                    return (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                          <span className="font-semibold text-gray-800">{piece.nom}</span>
                          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={piece.present}
                              onChange={(e) => toggleConfigPiece(piece.id, e.target.checked)}
                              className="rounded" />
                            Présente dans le logement
                          </label>
                        </div>
                        <div className="flex border-b overflow-x-auto">
                          {piece.categories.map((cat) => (
                            <button key={cat.id}
                              onClick={() => setStructureCat(cat.id)}
                              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                                activeCat?.id === cat.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                              }`}>
                              {cat.nom} <span className="text-xs text-gray-400">({cat.items.length})</span>
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              const nom = window.prompt("Nom de la nouvelle catégorie :");
                              if (nom) addCatToConfig(piece.id, nom);
                            }}
                            className="px-3 py-2 text-sm text-blue-500 hover:text-blue-700 border-b-2 border-transparent -mb-px">
                            + Cat.
                          </button>
                        </div>
                        {activeCat && (
                          <div className="p-4 space-y-2">
                            {activeCat.items.length === 0 && (
                              <p className="text-xs text-gray-400 italic">Aucun élément — ajoutez-en ci-dessous.</p>
                            )}
                            {activeCat.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 py-1">
                                <span className="flex-1 text-sm text-gray-700">{item.nom}</span>
                                <button onClick={() => removeItemFromConfig(piece.id, activeCat.id, item.id)}
                                  className="text-red-400 hover:text-red-600 text-sm w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50">×</button>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <input
                                value={newItemInput}
                                onChange={(e) => setNewItemInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && newItemInput.trim()) { addItemToConfig(piece.id, activeCat.id, newItemInput); setNewItemInput(""); } }}
                                placeholder="Ajouter un élément..."
                                className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                              <button
                                onClick={() => { addItemToConfig(piece.id, activeCat.id, newItemInput); setNewItemInput(""); }}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <button onClick={saveConfig}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium">
                  Enregistrer la configuration
                </button>
              </div>
            )}

            {/* ── Tab EDL Entrant / Sortant ── */}
            {(edlSubTab === "entrant" || edlSubTab === "sortant") && (() => {
              const type = edlSubTab === "entrant" ? "Entrant" : "Sortant" as "Entrant" | "Sortant";
              const existingEdl = edls.find(e => e.type === type) ?? null;
              const edlEntrant = edls.find(e => e.type === "Entrant");
              const edlSortant = edls.find(e => e.type === "Sortant");
              const ETAT_RANK: Record<string, number> = { "Neuf": 5, "Bon état": 4, "État moyen": 3, "Usage avancé": 2, "Dégradé": 1, "": 0 };
              function sortEdlPieces(pieces: PieceEDL[], ref: PieceEDL[]): PieceEDL[] {
                const idx = new Map(ref.map((p, i) => [p.nom, i]));
                return [...pieces].sort((a, b) => (idx.get(a.nom) ?? Infinity) - (idx.get(b.nom) ?? Infinity));
              }
              function diffColor(etatE: string, etatS: string): string {
                if (!etatE || !etatS) return "bg-gray-50";
                const diff = ETAT_RANK[etatE] - ETAT_RANK[etatS];
                if (diff === 0) return "bg-green-50";
                if (diff === 1) return "bg-yellow-50";
                return "bg-red-50";
              }
              function diffDot(etatE: string, etatS: string): string {
                if (!etatE || !etatS) return "⚪";
                const diff = ETAT_RANK[etatE] - ETAT_RANK[etatS];
                if (diff === 0) return "🟢";
                if (diff === 1) return "🟠";
                return "🔴";
              }
              const blobToBase64 = async (key: string) => {
                const blob = await getFile(key);
                if (!blob) return null;
                return new Promise<string>((res) => {
                  const reader = new FileReader();
                  reader.onload = () => res(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              };

              if (edlFormMode && editEdl) {
                const edlPieceRef = editEdl.type === "Sortant" && edlEntrant
                  ? edlEntrant.pieces
                  : configLogement?.pieces ?? [];
                const activePieces = sortEdlPieces(editEdl.pieces, edlPieceRef).filter(p => p.present);
                const isInfoStep = edlStep === 0;
                const isValidationStep = edlStep === activePieces.length + 1;
                const currentPiece = (!isInfoStep && !isValidationStep) ? activePieces[edlStep - 1] ?? null : null;
                const activeCat = currentPiece
                  ? (currentPiece.categories.find(c => c.id === edlActiveCat) ?? currentPiece.categories[0] ?? null)
                  : null;

                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">
                        État des lieux{" "}
                        <span className={`text-sm px-2 py-0.5 rounded-full ${editEdl.type === "Entrant" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{editEdl.type}</span>
                      </h2>
                      <button onClick={() => { setEdlFormMode(false); setEditEdl(null); setEdlStep(0); setEdlActiveCat(null); }}
                        className="text-gray-500 hover:text-gray-700 text-sm">← Retour</button>
                    </div>

                    {/* Barre de progression */}
                    <div className="overflow-x-auto pb-1">
                      <div className="flex items-center gap-1 min-w-max">
                        <button onClick={() => { setEdlStep(0); setEdlActiveCat(null); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${edlStep === 0 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          Infos & relevés
                        </button>
                        {activePieces.map((piece, idx) => {
                          const filled = piece.categories.some(c => c.items.some(i => i.etat));
                          return (
                            <span key={piece.id} className="flex items-center gap-1">
                              <span className="text-gray-300 text-xs">›</span>
                              <button onClick={() => { setEdlStep(idx + 1); setEdlActiveCat(null); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  edlStep === idx + 1 ? "bg-blue-600 text-white"
                                  : filled ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}>
                                {filled ? "✓ " : ""}{piece.nom}
                              </button>
                            </span>
                          );
                        })}
                        <span className="flex items-center gap-1">
                          <span className="text-gray-300 text-xs">›</span>
                          <button onClick={() => { setEdlStep(activePieces.length + 1); setEdlActiveCat(null); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isValidationStep ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            Validation
                          </button>
                        </span>
                      </div>
                    </div>

                    {/* ── Étape 0 : Infos, clés, codes, relevés ── */}
                    {isInfoStep && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input type="date" value={editEdl.date}
                              onChange={(e) => setEditEdl({ ...editEdl, date: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                            <input type="time" value={editEdl.heure}
                              onChange={(e) => setEditEdl({ ...editEdl, heure: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                        </div>

                        {/* Clés remises */}
                        <div className="border rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800">Remise des clés</h3>
                            <button onClick={() => setEditEdl({ ...editEdl, cles: [...(editEdl.cles ?? []), { id: crypto.randomUUID(), type: "", quantite: "1" }] })}
                              className="text-xs text-blue-600 hover:underline">+ Ajouter</button>
                          </div>
                          <div className="space-y-2">
                            {(editEdl.cles ?? []).map((cle: CleRemise) => (
                              <div key={cle.id} className="flex items-center gap-2">
                                <input value={cle.type}
                                  onChange={(e) => setEditEdl({ ...editEdl, cles: (editEdl.cles ?? []).map((c: CleRemise) => c.id === cle.id ? { ...c, type: e.target.value } : c) })}
                                  placeholder="Type de clé (ex: Clé appartement)"
                                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditEdl({ ...editEdl, cles: (editEdl.cles ?? []).map((c: CleRemise) => c.id === cle.id ? { ...c, quantite: String(Math.max(0, parseInt(c.quantite || "0") - 1)) } : c) })}
                                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-lg leading-none flex items-center justify-center">−</button>
                                  <input type="number" min="0" value={cle.quantite}
                                    onChange={(e) => setEditEdl({ ...editEdl, cles: (editEdl.cles ?? []).map((c: CleRemise) => c.id === cle.id ? { ...c, quantite: e.target.value } : c) })}
                                    className="w-12 border rounded text-center text-sm py-1" />
                                  <button onClick={() => setEditEdl({ ...editEdl, cles: (editEdl.cles ?? []).map((c: CleRemise) => c.id === cle.id ? { ...c, quantite: String(parseInt(c.quantite || "0") + 1) } : c) })}
                                    className="w-7 h-7 rounded border text-gray-600 hover:bg-gray-100 text-lg leading-none flex items-center justify-center">+</button>
                                </div>
                                <button onClick={() => setEditEdl({ ...editEdl, cles: (editEdl.cles ?? []).filter((c: CleRemise) => c.id !== cle.id) })}
                                  className="text-red-400 hover:text-red-600 text-lg">×</button>
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Observations</label>
                            <input value={editEdl.cles_remises}
                              onChange={(e) => setEditEdl({ ...editEdl, cles_remises: e.target.value })}
                              placeholder="Ex: les clés ont été remises en main propre..."
                              className="w-full border rounded-lg px-3 py-2 text-sm" />
                          </div>
                        </div>

                        {/* Codes d'accès */}
                        {configLogement?.equipements_exterieurs.some(e => e.nom === "Digicode" && e.present) && (
                          <div className="border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-800">Codes d'accès</h3>
                              <button onClick={() => setEditEdl({ ...editEdl, codes_acces: [...(editEdl.codes_acces ?? []), { id: crypto.randomUUID(), label: "", code: "" }] })}
                                className="text-xs text-blue-600 hover:underline">+ Ajouter</button>
                            </div>
                            {(editEdl.codes_acces ?? []).map((ca) => (
                              <div key={ca.id} className="flex items-center gap-2">
                                <input value={ca.label}
                                  onChange={(e) => setEditEdl({ ...editEdl, codes_acces: (editEdl.codes_acces ?? []).map(c => c.id === ca.id ? { ...c, label: e.target.value } : c) })}
                                  placeholder="Ex: Hall d'entrée" className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                                <input value={ca.code}
                                  onChange={(e) => setEditEdl({ ...editEdl, codes_acces: (editEdl.codes_acces ?? []).map(c => c.id === ca.id ? { ...c, code: e.target.value } : c) })}
                                  placeholder="Code" className="w-28 border rounded-lg px-3 py-1.5 text-sm font-mono" />
                                <button onClick={() => setEditEdl({ ...editEdl, codes_acces: (editEdl.codes_acces ?? []).filter(c => c.id !== ca.id) })}
                                  className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Relevés de compteurs */}
                        <div>
                          <h3 className="font-semibold text-gray-800 mb-3">Relevés de compteurs</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {editEdl.releves_compteurs.map((c) => (
                              <div key={c.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm flex-1">{c.type}</span>
                                  <span className="text-xs text-gray-400">{c.unite}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-gray-500">N° compteur</label>
                                    <input value={c.numero}
                                      onChange={(e) => updateEdlCompteur(c.id, { numero: e.target.value })}
                                      className="w-full border rounded px-2 py-1 text-sm" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">Index</label>
                                    <input value={c.valeur}
                                      onChange={(e) => updateEdlCompteur(c.id, { valeur: e.target.value })}
                                      className="w-full border rounded px-2 py-1 text-sm" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Documents et annexes */}
                        <div className="border rounded-xl p-4 space-y-2">
                          <h3 className="font-semibold text-gray-800">Documents et annexes</h3>
                          <p className="text-xs text-gray-500">Documents échangés lors de l'état des lieux (ex : attestation d'assurance locataire, diagnostics, inventaire…)</p>
                          <textarea
                            value={editEdl.annexes_documents ?? ""}
                            onChange={(e) => setEditEdl({ ...editEdl, annexes_documents: e.target.value })}
                            rows={3}
                            placeholder={"Ex : Attestation d'assurance locataire remise le " + editEdl.date + "\nDiagnostic de performance énergétique joint\nInventaire du mobilier annexé"}
                            className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
                        </div>

                        <div className="flex justify-end">
                          <button onClick={() => { setEdlStep(1); setEdlActiveCat(null); }}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium">
                            Commencer le parcours → {activePieces[0]?.nom ?? "Validation"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Étapes pièces ── */}
                    {currentPiece && (() => {
                      const [selCatId, selItemId] = selectedItemKey ? selectedItemKey.split("/") : ["", ""];
                      const selCat = currentPiece.categories.find(c => c.id === selCatId);
                      const selItem = selCat?.items.find(i => i.id === selItemId) ?? null;
                      const allItemKeys = currentPiece.categories.flatMap(c => c.items.map(i => `${c.id}/${i.id}`));
                      const selKeyIdx = selectedItemKey ? allItemKeys.indexOf(selectedItemKey) : -1;
                      const ETAT_COLOR = (e: string) => (({ "Neuf": "bg-sky-50 text-sky-700 border-sky-300", "Bon état": "bg-green-50 text-green-700 border-green-300", "État moyen": "bg-amber-50 text-amber-700 border-amber-300", "Usage avancé": "bg-orange-50 text-orange-700 border-orange-300", "Dégradé": "bg-red-50 text-red-700 border-red-300" } as Record<string,string>)[e] ?? "border-gray-300 text-gray-600");
                      const ETAT_DOT: Record<string, string> = { "Neuf": "bg-sky-400", "Bon état": "bg-green-400", "État moyen": "bg-amber-400", "Usage avancé": "bg-orange-400", "Dégradé": "bg-red-500" };
                      const ETAT_RANK_FORM: Record<string, number> = { "Neuf": 5, "Bon état": 4, "État moyen": 3, "Usage avancé": 2, "Dégradé": 1, "": 0 };
                      const entrantPieceForCompare = editEdl.type === "Sortant" && edlEntrant
                        ? edlEntrant.pieces.find(p => p.nom === currentPiece.nom) ?? null
                        : null;
                      return (
                        <div className="space-y-4">
                          {/* En-tête pièce */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                {currentPiece.nom}
                                {pieceSaved && <span className="text-sm font-normal text-green-600">✓ Sauvegardé</span>}
                              </h3>
                              <span className="text-sm text-gray-400">{edlStep} / {activePieces.length}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(edlStep / activePieces.length) * 100}%` }} />
                            </div>
                          </div>

                          {/* Layout deux panneaux */}
                          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">

                            {/* Panneau gauche : liste éléments */}
                            <div className={`border rounded-xl overflow-hidden flex flex-col ${selItem ? "hidden lg:flex" : "flex"}`}>
                              <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Éléments</span>
                                <button onClick={() => setEditEdl({ ...editEdl, pieces: editEdl.pieces.map(p => p.id === currentPiece.id ? { ...p, categories: p.categories.map(c => ({ ...c, items: c.items.map(i => ({ ...i, etat: i.etat || "Bon état" as const })) })) } : p) })}
                                  className="text-xs text-green-600 hover:text-green-800 font-medium">✓ Tout bon état</button>
                              </div>
                              <div className="overflow-y-auto max-h-[480px]">
                                {currentPiece.categories.map((cat) => {
                                  const isCatCollapsed = collapsedCats[cat.id] ?? false;
                                  const filledCount = cat.items.filter(i => i.etat).length;
                                  return (
                                  <div key={cat.id}>
                                    <button
                                      onClick={() => setCollapsedCats(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                                      className="w-full px-3 py-2 bg-gray-50 border-b border-t text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between hover:bg-gray-100 transition-colors">
                                      <span className="flex items-center gap-2">
                                        <span className={`transition-transform duration-150 text-gray-400 ${isCatCollapsed ? "-rotate-90" : ""}`}>▼</span>
                                        {cat.nom}
                                      </span>
                                      <span className={`font-normal normal-case text-xs px-1.5 py-0.5 rounded-full ${filledCount === cat.items.length && cat.items.length > 0 ? "bg-green-100 text-green-600" : "text-gray-400"}`}>
                                        {filledCount}/{cat.items.length}
                                      </span>
                                    </button>
                                    {!isCatCollapsed && (
                                      <>
                                    {cat.items.length === 0 && <p className="px-3 py-2 text-xs text-gray-400 italic">Aucun élément</p>}
                                    {cat.items.map((item) => {
                                      const key = `${cat.id}/${item.id}`;
                                      const isSelected = selectedItemKey === key;
                                      return (
                                        <button key={item.id} onClick={() => { setSelectedItemKey(key); setCustomCaractInput(""); setCustomObsInput(""); }}
                                          className={`w-full flex items-center gap-3 px-3 py-2.5 border-b text-left transition-colors ${isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"}`}>
                                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.etat ? (ETAT_DOT[item.etat] ?? "bg-gray-300") : "bg-gray-200"}`} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{item.nom}</p>
                                            {item.etat && <p className="text-xs text-gray-400 truncate">{item.etat}{(item.caracteristiques ?? []).length > 0 ? ` · ${item.caracteristiques.slice(0, 2).join(", ")}` : ""}</p>}
                                          </div>
                                          {((item.photos ?? []).length) > 0 && <span className="text-xs text-blue-400 shrink-0">📷</span>}
                                          {editEdl.type === "Sortant" && entrantPieceForCompare && (() => {
                                            const ei = entrantPieceForCompare.categories.flatMap(c => c.items).find(i => i.nom === item.nom);
                                            if (!ei?.etat || !item.etat || ei.etat === item.etat) return null;
                                            const d = ETAT_RANK_FORM[ei.etat] - ETAT_RANK_FORM[item.etat];
                                            if (d < 0) return <span key="ec" className="text-xs text-green-500 shrink-0" title={`${ei.etat} → ${item.etat}`}>↑</span>;
                                            if (ei.etat === "Neuf" && item.etat === "Bon état") return <span key="ec" className="text-xs text-amber-400 shrink-0" title={`${ei.etat} → ${item.etat}`}>〰</span>;
                                            return <span key="ec" className="text-xs text-red-500 shrink-0" title={`${ei.etat} → ${item.etat}`}>⚠</span>;
                                          })()}
                                        </button>
                                      );
                                    })}
                                    <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-white">
                                      <input value={newItemByCat[cat.id] ?? ""}
                                        onChange={(e) => setNewItemByCat(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === "Enter" && (newItemByCat[cat.id] ?? "").trim()) { addEdlItem(currentPiece.id, cat.id, newItemByCat[cat.id]); setNewItemByCat(prev => ({ ...prev, [cat.id]: "" })); } }}
                                        placeholder="+ Ajouter un élément…"
                                        className="flex-1 text-xs px-2 py-1 border rounded-lg focus:border-blue-400 focus:outline-none" />
                                      <button onClick={() => { const v = newItemByCat[cat.id] ?? ""; if (v.trim()) { addEdlItem(currentPiece.id, cat.id, v); setNewItemByCat(prev => ({ ...prev, [cat.id]: "" })); } }}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-bold px-1.5">+</button>
                                    </div>
                                      </>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                              <div className="p-3 border-t bg-gray-50">
                                <button onClick={() => { setPhotoTarget({ kind: "piece", pieceId: currentPiece.id }); fileInputRef.current?.click(); }}
                                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 w-full">
                                  <span>📷</span><span>Photos de la pièce</span>
                                  {currentPiece.photos.length > 0 && <span className="ml-auto bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">{currentPiece.photos.length}</span>}
                                </button>
                                {currentPiece.photos.length > 0 && (
                                  <div className="flex gap-1.5 mt-2 flex-wrap">
                                    {currentPiece.photos.map((key) => {
                                      if (!photoUrls[key]) loadPhotoUrl(key);
                                      return photoUrls[key] ? (
                                        <div key={key} className="relative">
                                          <img src={photoUrls[key]} alt="" className="h-14 w-14 rounded-lg border object-cover" />
                                          <button onClick={() => setEditEdl({ ...editEdl, pieces: editEdl.pieces.map(p => p.id === currentPiece.id ? { ...p, photos: p.photos.filter(k => k !== key) } : p) })}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                                        </div>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Panneau droit : détail élément */}
                            {!selItem ? (
                              <div className="hidden lg:flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-300 flex-col gap-2">
                                <span className="text-5xl">←</span>
                                <span className="text-sm">Sélectionnez un élément</span>
                              </div>
                            ) : (
                              <div className="border rounded-xl overflow-hidden flex flex-col">
                                <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
                                  <button onClick={() => setSelectedItemKey(null)} className="text-blue-500 text-sm lg:hidden">←</button>
                                  <div className="flex-1">
                                    <p className="font-bold text-gray-800">{selItem.nom}</p>
                                    <p className="text-xs text-gray-400">{selCat?.nom}</p>
                                  </div>
                                  <button onClick={() => { removeEdlItem(currentPiece.id, selCatId, selItemId); setSelectedItemKey(null); }}
                                    className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors" title="Supprimer">×</button>
                                </div>

                                <div className="p-4 space-y-5">
                                  {/* Quantité + État */}
                                  <div className="flex gap-4 items-end">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Quantité</label>
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { quantite: String(Math.max(1, parseInt(selItem.quantite || "1") - 1)) })}
                                          className="w-8 h-8 border rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-lg">−</button>
                                        <span className="w-10 text-center font-bold text-xl text-gray-800">{selItem.quantite || "1"}</span>
                                        <button onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { quantite: String(parseInt(selItem.quantite || "1") + 1) })}
                                          className="w-8 h-8 border rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-lg">+</button>
                                      </div>
                                    </div>
                                    <div className="flex-1 relative">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">État</label>
                                        <button onClick={() => setShowEdlLegend(v => !v)}
                                          className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 text-xs flex items-center justify-center transition-colors font-bold"
                                          title="Légende des états">ⓘ</button>
                                      </div>
                                      <select value={selItem.etat}
                                        onChange={(e) => updateEdlItem(currentPiece.id, selCatId, selItemId, { etat: e.target.value as typeof selItem.etat })}
                                        className={`w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none ${ETAT_COLOR(selItem.etat)}`}>
                                        <option value="">-- Non renseigné --</option>
                                        {ETATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                      {/* Popover légende */}
                                      {showEdlLegend && (
                                        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 space-y-2.5">
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Légende — États d'usure</p>
                                            <button onClick={() => setShowEdlLegend(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                                          </div>
                                          {ETATS_OPTIONS.map(etat => {
                                            const dotColor = ({ "Neuf": "bg-sky-400", "Bon état": "bg-green-400", "État moyen": "bg-amber-400", "Usage avancé": "bg-orange-400", "Dégradé": "bg-red-500" } as Record<string,string>)[etat] ?? "bg-gray-300";
                                            return (
                                              <div key={etat} className="flex gap-2.5 items-start">
                                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${dotColor}`} />
                                                <div>
                                                  <p className="text-xs font-semibold text-gray-800">{etat}</p>
                                                  <p className="text-xs text-gray-500 leading-snug">{ETATS_LEGENDES[etat]}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {editEdl.type === "Sortant" && (() => {
                                        const epC = edlEntrant?.pieces.find(p => p.nom === currentPiece.nom);
                                        const eiC = epC?.categories.flatMap(c => c.items).find(i => i.nom === selItem.nom);
                                        if (!eiC?.etat || !selItem.etat || eiC.etat === selItem.etat) return null;
                                        const diffC = ETAT_RANK[eiC.etat] - ETAT_RANK[selItem.etat];
                                        const isNormC = eiC.etat === "Neuf" && selItem.etat === "Bon état";
                                        const isAmelC = diffC < 0;
                                        const isDegC = diffC > 0 && !isNormC;
                                        return (
                                          <div className={`mt-2 px-3 py-2 rounded-lg text-xs border ${isNormC ? "bg-amber-50 border-amber-200 text-amber-700" : isAmelC ? "bg-green-50 border-green-200 text-green-700" : isDegC ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                                            <span className="font-semibold">Écart détecté :</span>{" "}
                                            {eiC.etat} → {selItem.etat}
                                            {isNormC && <span className="ml-2 font-medium">— Usure normale</span>}
                                            {isAmelC && <span className="ml-2 font-medium">— Amélioration</span>}
                                            {isDegC && <span className="ml-2 font-medium">— Dégradation potentielle</span>}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Caractéristiques */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Caractéristiques</label>
                                    {(() => {
                                      const suggestions = getCaracteristiquesSuggestions(selItem.nom);
                                      const learned = getLearnedCaracteristiques(configLogement?.id ?? "", selCat?.nom ?? "").filter(c => !suggestions.includes(c));
                                      const selected = selItem.caracteristiques ?? [];
                                      // Éléments sélectionnés qui ne sont ni dans suggestions ni dans learned
                                      const customSelected = selected.filter(c => !suggestions.includes(c) && !learned.includes(c));
                                      return (
                                        <>
                                          {/* Suggestions prédéfinies */}
                                          {suggestions.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              {suggestions.map(s => {
                                                const sel2 = selected.includes(s);
                                                return (
                                                  <button key={s} onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { caracteristiques: sel2 ? selected.filter(c => c !== s) : [...selected, s] })}
                                                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${sel2 ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"}`}>
                                                    {s}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {/* Caractéristiques apprises (déjà utilisées pour cette catégorie) */}
                                          {learned.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              {learned.map(c => {
                                                const sel2 = selected.includes(c);
                                                return (
                                                  <button key={c} onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { caracteristiques: sel2 ? selected.filter(x => x !== c) : [...selected, c] })}
                                                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${sel2 ? "bg-violet-600 text-white border-violet-600" : "border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-50"}`}
                                                    title="Caractéristique issue de vos précédents états des lieux">
                                                    ★ {c}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {/* Sélectionnés hors listes (libres uniques) */}
                                          {customSelected.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                              {customSelected.map(c => (
                                                <span key={c} className="flex items-center gap-1 px-3 py-1 rounded-full border border-violet-400 bg-violet-600 text-white text-xs font-medium">
                                                  ★ {c}
                                                  <button onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { caracteristiques: selected.filter(x => x !== c) })} className="text-violet-200 hover:text-white ml-0.5">×</button>
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          <div className="flex gap-2">
                                            <input value={customCaractInput} onChange={(e) => setCustomCaractInput(e.target.value)}
                                              onKeyDown={(e) => { if (e.key === "Enter" && customCaractInput.trim()) { const v = customCaractInput.trim(); updateEdlItem(currentPiece.id, selCatId, selItemId, { caracteristiques: [...(selItem.caracteristiques ?? []), v] }); addLearnedCaracteristique(configLogement?.id ?? "", selCat?.nom ?? "", v); setCustomCaractInput(""); } }}
                                              placeholder="Ajouter une caractéristique…"
                                              className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                                            <button onClick={() => { if (customCaractInput.trim()) { const v = customCaractInput.trim(); updateEdlItem(currentPiece.id, selCatId, selItemId, { caracteristiques: [...(selItem.caracteristiques ?? []), v] }); addLearnedCaracteristique(configLogement?.id ?? "", selCat?.nom ?? "", v); setCustomCaractInput(""); } }}
                                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold">+</button>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>

                                  {/* Observations */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Observations</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {OBSERVATIONS_PREDEFINIES.map(obs => {
                                        const sel2 = (selItem.observations ?? []).includes(obs);
                                        const isPositif = obs === "RAS" || obs === "Propre" || obs === "Fonctionnement correct";
                                        return (
                                          <button key={obs} onClick={() => {
                                            const cur = selItem.observations ?? [];
                                            let next: string[];
                                            if (obs === "RAS") next = sel2 ? [] : ["RAS"];
                                            else next = sel2 ? cur.filter(o => o !== obs) : [...cur.filter(o => o !== "RAS"), obs];
                                            if (next.length === 0) next = ["RAS"];
                                            updateEdlItem(currentPiece.id, selCatId, selItemId, { observations: next });
                                          }} className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${sel2 ? (isPositif ? "bg-green-500 text-white border-green-500" : "bg-orange-500 text-white border-orange-500") : "border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600"}`}>
                                            {obs}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {(selItem.observations ?? []).filter(o => !OBSERVATIONS_PREDEFINIES.includes(o)).length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mb-2">
                                        {(selItem.observations ?? []).filter(o => !OBSERVATIONS_PREDEFINIES.includes(o)).map(obs => (
                                          <span key={obs} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200 text-xs font-medium">
                                            {obs}
                                            <button onClick={() => { const next = (selItem.observations ?? []).filter(o2 => o2 !== obs); updateEdlItem(currentPiece.id, selCatId, selItemId, { observations: next.length > 0 ? next : ["RAS"] }); }} className="ml-0.5 hover:text-red-500 leading-none font-bold">×</button>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <input value={customObsInput} onChange={(e) => setCustomObsInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && customObsInput.trim()) { updateEdlItem(currentPiece.id, selCatId, selItemId, { observations: [...(selItem.observations ?? []).filter(o => o !== "RAS"), customObsInput.trim()] }); setCustomObsInput(""); } }}
                                        placeholder="Observation personnalisée…"
                                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
                                      <button onClick={() => { if (customObsInput.trim()) { updateEdlItem(currentPiece.id, selCatId, selItemId, { observations: [...(selItem.observations ?? []).filter(o => o !== "RAS"), customObsInput.trim()] }); setCustomObsInput(""); } }}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold">+</button>
                                    </div>
                                  </div>

                                  {/* Commentaire libre */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Commentaire libre</label>
                                    <textarea value={selItem.commentaire} onChange={(e) => updateEdlItem(currentPiece.id, selCatId, selItemId, { commentaire: e.target.value })}
                                      rows={2} placeholder="Remarques supplémentaires (optionnel)…"
                                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:border-blue-400 focus:outline-none" />
                                  </div>

                                  {/* Photos élément */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Photos ({selItem.photos?.length ?? 0})</label>
                                    <div className="flex gap-2 flex-wrap">
                                      {(selItem.photos ?? []).map((key, idx) => {
                                        if (!photoUrls[key]) loadPhotoUrl(key);
                                        return photoUrls[key] ? (
                                          <div key={key} className="relative">
                                            <img src={photoUrls[key]} alt="" className="h-20 w-20 rounded-xl border object-cover" />
                                            <button onClick={() => updateEdlItem(currentPiece.id, selCatId, selItemId, { photos: selItem.photos.filter((_, i) => i !== idx) })}
                                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">×</button>
                                          </div>
                                        ) : null;
                                      })}
                                      <button onClick={() => { setPhotoTarget({ kind: "item", pieceId: currentPiece.id, catId: selCatId, itemId: selItemId }); fileInputRef.current?.click(); }}
                                        className="h-20 w-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                                        <span className="text-2xl">📷</span>
                                        <span className="text-xs mt-0.5">Ajouter</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Navigation entre éléments */}
                                <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                                  <button disabled={selKeyIdx <= 0}
                                    onClick={() => { setSelectedItemKey(allItemKeys[selKeyIdx - 1]); setCustomCaractInput(""); setCustomObsInput(""); }}
                                    className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">← Précédent</button>
                                  {selKeyIdx < allItemKeys.length - 1 ? (
                                    <button onClick={() => { setSelectedItemKey(allItemKeys[selKeyIdx + 1]); setCustomCaractInput(""); setCustomObsInput(""); }}
                                      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 font-medium">Élément suivant →</button>
                                  ) : (
                                    <span className="text-xs text-green-600 font-medium">✓ Tous les éléments renseignés</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Navigation pièces */}
                          <div className="flex items-center justify-between pt-3 border-t">
                            <button onClick={() => { setEdlStep(edlStep - 1); setSelectedItemKey(null); }}
                              className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">← Précédent</button>
                            <button onClick={() => { saveEdlDraft(); setEdlStep(edlStep + 1); setSelectedItemKey(null); }}
                              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 font-medium flex items-center gap-2">
                              {edlStep === activePieces.length ? "Validation →" : `${activePieces[edlStep]?.nom ?? "Suivant"} →`}
                              <span className="text-xs opacity-60">💾</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Étape validation ── */}
                    {isValidationStep && (
                      <div className="space-y-6">
                        {editEdl.type === "Sortant" && edlEntrant && (() => {
                          const ecarts: { nomPiece: string; nomEl: string; etatE: string; etatS: string; kind: "normale" | "dégradation" | "amélioration" }[] = [];
                          for (const pieceS of editEdl.pieces.filter(p => p.present)) {
                            const pieceE = edlEntrant.pieces.find(p => p.nom === pieceS.nom && p.present);
                            if (!pieceE) continue;
                            for (const cat of pieceS.categories) {
                              for (const itemS of cat.items) {
                                const itemE = pieceE.categories.flatMap(c => c.items).find(i => i.nom === itemS.nom);
                                if (!itemE?.etat || !itemS.etat || itemE.etat === itemS.etat) continue;
                                const d = ETAT_RANK[itemE.etat] - ETAT_RANK[itemS.etat];
                                const isNorm = itemE.etat === "Neuf" && itemS.etat === "Bon état";
                                ecarts.push({ nomPiece: pieceS.nom, nomEl: itemS.nom, etatE: itemE.etat, etatS: itemS.etat, kind: d < 0 ? "amélioration" : isNorm ? "normale" : "dégradation" });
                              }
                            }
                          }
                          if (ecarts.length === 0) return (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm font-medium">
                              ✓ Aucun écart détecté — tous les états sont identiques à l'entrée
                            </div>
                          );
                          const nb = ecarts.length;
                          const normales = ecarts.filter(e => e.kind === "normale").length;
                          const degs = ecarts.filter(e => e.kind === "dégradation").length;
                          const amels = ecarts.filter(e => e.kind === "amélioration").length;
                          return (
                            <div className="border rounded-xl overflow-hidden">
                              <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center flex-wrap gap-3">
                                <span className="font-bold text-orange-800 text-sm">Récapitulatif des écarts</span>
                                <div className="flex gap-2 text-xs flex-wrap">
                                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{nb} écart{nb > 1 ? "s" : ""}</span>
                                  {normales > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{normales} usure normale</span>}
                                  {degs > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{degs} dégradation{degs > 1 ? "s" : ""}</span>}
                                  {amels > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{amels} amélioration{amels > 1 ? "s" : ""}</span>}
                                </div>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr className="text-gray-500 uppercase tracking-wide border-b">
                                    <th className="px-3 py-2 text-left font-semibold">Pièce</th>
                                    <th className="px-3 py-2 text-left font-semibold">Élément</th>
                                    <th className="px-3 py-2 text-left font-semibold">État entrant</th>
                                    <th className="px-3 py-2 text-left font-semibold">État sortant</th>
                                    <th className="px-3 py-2 text-left font-semibold">Évolution</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {ecarts.map((e, idx) => (
                                    <tr key={idx} className={e.kind === "dégradation" ? "bg-red-50" : e.kind === "normale" ? "bg-amber-50" : "bg-green-50"}>
                                      <td className="px-3 py-2 text-gray-500">{e.nomPiece}</td>
                                      <td className="px-3 py-2 font-medium text-gray-800">{e.nomEl}</td>
                                      <td className="px-3 py-2 text-gray-600">{e.etatE}</td>
                                      <td className="px-3 py-2 text-gray-800">{e.etatS}</td>
                                      <td className={`px-3 py-2 font-semibold ${e.kind === "dégradation" ? "text-red-600" : e.kind === "normale" ? "text-amber-600" : "text-green-600"}`}>
                                        {e.kind === "normale" ? "Usure normale" : e.kind === "dégradation" ? "Dégradation potentielle" : "Amélioration"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire général</label>
                          <textarea value={editEdl.commentaire_general}
                            onChange={(e) => setEditEdl({ ...editEdl, commentaire_general: e.target.value })}
                            rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                            placeholder="Observations générales..." />
                        </div>

                        <div id="edl-signatures" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="border rounded-xl p-4">
                            <p className="font-medium text-sm mb-2">Signature du propriétaire</p>
                            {editEdl.signature_proprietaire ? (
                              <div>
                                <img src={editEdl.signature_proprietaire} alt="Signature propriétaire" className="h-16 border rounded mb-2" />
                                <p className="text-xs text-gray-500">{editEdl.signe_proprietaire_at ? `Signé le ${formatDate(editEdl.signe_proprietaire_at.split("T")[0])}` : ""}</p>
                                <button onClick={() => setEditEdl({ ...editEdl, signature_proprietaire: null, signe_proprietaire_at: "" })}
                                  className="text-red-500 text-xs hover:underline mt-1">Effacer</button>
                              </div>
                            ) : (
                              <button onClick={() => {
                                if (p?.signature_proprietaire) {
                                  const now = new Date().toISOString();
                                  setEditEdl({ ...editEdl!, signature_proprietaire: p.signature_proprietaire, signe_proprietaire_at: now });
                                } else {
                                  setSignateurActif("proprietaire");
                                }
                              }}
                                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm">
                                ✍️ Signer
                              </button>
                            )}
                          </div>
                          <div className={`border rounded-xl p-4 ${!editEdl.signature_proprietaire ? "opacity-40 pointer-events-none" : ""}`}>
                            <p className="font-medium text-sm mb-2">Signature du locataire</p>
                            {!editEdl.signature_proprietaire && (
                              <p className="text-xs text-gray-400 mb-2">Le propriétaire doit signer en premier</p>
                            )}
                            {editEdl.signature_locataire ? (
                              <div>
                                <img src={editEdl.signature_locataire} alt="Signature locataire" className="h-16 border rounded mb-2" />
                                <p className="text-xs text-gray-500">{editEdl.signe_locataire_at ? `Signé le ${formatDate(editEdl.signe_locataire_at.split("T")[0])}` : ""}</p>
                                <button onClick={() => setEditEdl({ ...editEdl, signature_locataire: null, signe_locataire_at: "" })}
                                  className="text-red-500 text-xs hover:underline mt-1">Effacer</button>
                              </div>
                            ) : (
                              <button onClick={() => setSignateurActif("locataire")}
                                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-sm">
                                ✍️ Signer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2 flex-wrap">
                          <button onClick={() => { setEdlStep(activePieces.length); setEdlActiveCat(null); }}
                            className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">← Retour aux pièces</button>
                          <button onClick={saveEdlForm}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">
                            Enregistrer l'EDL
                          </button>
                          <button onClick={async () => {
                            const m = await import("@/lib/generate-contrats-pdf");
                            await m.generateEdlPDF(editEdl, bail, p, blobToBase64);
                          }}
                            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm">
                            Aperçu PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Vue résumé / état vide
              return (
                <div className="space-y-6">
                  {existingEdl ? (
                    <div className="border rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm px-3 py-1 rounded-full font-medium ${type === "Entrant" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {type}
                          </span>
                          <span className="font-semibold">{formatDate(existingEdl.date)}</span>
                          <span className="text-sm text-gray-500">{existingEdl.heure}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={async () => {
                            const m = await import("@/lib/generate-contrats-pdf");
                            await m.generateEdlPDF(existingEdl, bail, p, blobToBase64);
                          }}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">PDF</button>
                          <button onClick={() => { setEditEdl(JSON.parse(JSON.stringify(existingEdl))); setEdlFormMode(true); setEdlStep(0); }}
                            className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Modifier</button>
                          <button onClick={() => { deleteEtatDesLieux(existingEdl.id); reload(); }}
                            className="text-red-500 hover:underline text-sm">Supprimer</button>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 border-t pt-2">
                        {existingEdl.signature_proprietaire ? <span className="text-green-600">✓ Propriétaire signé</span> : <span>○ Propriétaire non signé</span>}
                        {existingEdl.signature_locataire ? <span className="text-green-600">✓ Locataire signé</span> : <span>○ Locataire non signé</span>}
                        <span>{existingEdl.pieces.filter(pp => pp.present).length} pièces</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-xl p-10 text-center space-y-3">
                      <p className="text-gray-500">Aucun état des lieux {type.toLowerCase()} enregistré.</p>
                      <button onClick={() => { setEditEdl(newEdl(type)); setEdlFormMode(true); setEdlStep(0); }}
                        className={`px-5 py-2.5 rounded-lg text-white font-medium text-sm ${type === "Entrant" ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}>
                        Créer l'état des lieux {type.toLowerCase()}
                      </button>
                    </div>
                  )}

                  {/* Comparaison (onglet Sortant uniquement, si les 2 EDL existent) */}
                  {edlSubTab === "sortant" && edlEntrant && edlSortant && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">Comparaison entrée / sortie</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>🟢 Identique</span>
                            <span>🟠 Dégradé</span>
                            <span>🔴 Très dégradé</span>
                          </div>
                          <button onClick={async () => {
                            const m = await import("@/lib/generate-contrats-pdf");
                            await m.generateEdlComparaisonPDF(edlEntrant, edlSortant, bail, p, blobToBase64);
                          }}
                            className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700">
                            PDF comparatif
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm font-medium text-center">
                        <div className="bg-gray-50 rounded p-2">Élément</div>
                        <div className="bg-green-50 rounded p-2">Entrée — {formatDate(edlEntrant.date)}</div>
                        <div className="bg-orange-50 rounded p-2">Sortie — {formatDate(edlSortant.date)}</div>
                      </div>
                      {edlEntrant.pieces.filter(pp => pp.present).map((pieceE) => {
                        const pieceS = edlSortant.pieces.find(ps => ps.nom === pieceE.nom);
                        if (!pieceS?.present) return null;
                        const allItemsE = pieceE.categories.flatMap(cat => cat.items);
                        return (
                          <div key={pieceE.id} className="border rounded-xl overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 font-semibold text-sm">{pieceE.nom}</div>
                            <div className="divide-y">
                              {allItemsE.map((itemE) => {
                                const itemS = pieceS.categories.flatMap(c => c.items).find(i => i.nom === itemE.nom);
                                const color = diffColor(itemE.etat, itemS?.etat ?? "");
                                const dot = diffDot(itemE.etat, itemS?.etat ?? "");
                                return (
                                  <div key={itemE.id} className={`grid grid-cols-3 gap-2 px-3 py-2 text-xs ${color}`}>
                                    <div className="flex items-center gap-1 font-medium text-gray-700">
                                      <span>{dot}</span><span>{itemE.nom}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">{itemE.etat || "—"}</span>
                                      {itemE.commentaire && <p className="text-gray-500 mt-0.5">{itemE.commentaire}</p>}
                                    </div>
                                    <div>
                                      <span className="font-medium">{itemS?.etat || "—"}</span>
                                      {itemS?.commentaire && <p className="text-gray-500 mt-0.5">{itemS.commentaire}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {signateurActif && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSignateurActif(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="font-bold text-lg mb-4">
                Signature {signateurActif === "proprietaire" ? "du propriétaire" : "du locataire"}
              </h3>
              <SignaturePad onSave={handleSignature} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}