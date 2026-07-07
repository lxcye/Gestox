"use client";

import { useEffect, useRef, useState } from "react";
import type { Bail, BailDocument, ActeCautionnement, AttestationDepotGarantie } from "@/lib/types";
import { getParametres, getCautionsForBail, saveCaution, deleteCaution, getAttestationsDGForBail, saveAttestationDG, deleteAttestationDG } from "@/lib/store";
import { storeFile, getFile, deleteFile } from "@/lib/file-storage";

const MODES_VERSEMENT = ["Virement", "Chèque", "Espèces", "Autre"];
const TYPES_DOCUMENT = ["Bail signé", "État des lieux", "Attestation assurance", "Diagnostic énergétique", "Quittance", "Autre"];

const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function formatDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getDate()} ${MOIS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

interface Props { bail: Bail; bailId: string; onSave: (b: Bail) => void; }

export default function TabDocuments({ bail, bailId, onSave }: Props) {
  const [cautions, setCautions] = useState<ActeCautionnement[]>([]);
  const [editCaution, setEditCaution] = useState<ActeCautionnement | null>(null);
  const [attestations, setAttestations] = useState<AttestationDepotGarantie[]>([]);
  const [editAttestation, setEditAttestation] = useState<AttestationDepotGarantie | null>(null);
  const [rechercheDoc, setRechercheDoc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const p = typeof window !== "undefined" ? getParametres() : null;

  function reload() {
    setCautions(getCautionsForBail(bailId));
    setAttestations(getAttestationsDGForBail(bailId));
  }

  useEffect(() => { reload(); }, [bailId]);

  // ── PDF ──
  function downloadBailPDF() {
    if (!p) return;
    import("@/lib/generate-contrats-pdf").then(m => m.generateBailPDF(bail, p));
  }

  // ── Cautionnement ──
  function newCaution(): ActeCautionnement {
    return {
      id: crypto.randomUUID(), bail_id: bailId, garant_nom: "", garant_prenom: "", garant_adresse: "",
      garant_date_naissance: "", garant_lieu_naissance: "", garant_profession: "",
      garant_email: "", garant_telephone: "", plafond_garantie: 10000,
      date: new Date().toISOString().split("T")[0], lieu: p?.lieu_signature ?? "", signature_garant: null, created_at: "",
    };
  }

  function saveCautionForm() {
    if (!editCaution || !p) return;
    saveCaution(editCaution);
    reload();
    import("@/lib/generate-contrats-pdf").then(m => m.generateCautionnementPDF(editCaution, bail, p));
    setEditCaution(null);
  }

  // ── Attestation DG ──
  function newAttestation(): AttestationDepotGarantie {
    return {
      id: crypto.randomUUID(), bail_id: bailId, montant: bail.contrat.depot_garantie,
      date_versement: new Date().toISOString().split("T")[0], mode_versement: "Virement",
      date_bail: bail.contrat.date_signature, civilite_locataire: (bail.locataire.civilite === "Madame" ? "Madame" : "Monsieur"), created_at: "",
    };
  }

  function saveAttestationForm() {
    if (!editAttestation || !p) return;
    saveAttestationDG(editAttestation);
    reload();
    import("@/lib/generate-contrats-pdf").then(m => m.generateAttestationDGPDF(editAttestation, bail, p));
    setEditAttestation(null);
  }

  // ── Documents uploadés ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const key = crypto.randomUUID();
    await storeFile(key, file);
    const doc: BailDocument = {
      id: crypto.randomUUID(), nom: file.name.replace(/\.[^.]+$/, ""), type: "Autre",
      date_ajout: new Date().toISOString().split("T")[0], fichier_nom: file.name, fichier_key: key,
    };
    onSave({ ...bail, documents: [...bail.documents, doc] });
    e.target.value = "";
  }

  function updateDocument(docId: string, field: string, value: string) {
    onSave({ ...bail, documents: bail.documents.map(d => d.id === docId ? { ...d, [field]: value } : d) });
  }

  async function deleteDocument(docId: string) {
    const doc = bail.documents.find(d => d.id === docId);
    if (doc?.fichier_key) await deleteFile(doc.fichier_key);
    onSave({ ...bail, documents: bail.documents.filter(d => d.id !== docId) });
  }

  async function downloadDocument(doc: BailDocument) {
    let url: string;
    if (doc.fichier_key) {
      const blob = await getFile(doc.fichier_key);
      if (!blob) { alert("Fichier introuvable."); return; }
      url = URL.createObjectURL(blob);
    } else if (doc.fichier_data) {
      url = doc.fichier_data;
    } else { alert("Fichier introuvable."); return; }
    const link = document.createElement("a");
    link.href = url; link.download = doc.fichier_nom; link.click();
    if (doc.fichier_key) setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="space-y-8">

      {/* ── Génération de documents ── */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold">Génération de documents</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadBailPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            📄 Contrat de bail PDF
          </button>
          <button onClick={() => setEditAttestation(newAttestation())} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            💰 Attestation dépôt de garantie
          </button>
          <button onClick={() => setEditCaution(newCaution())} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            🤝 Cautionnement solidaire
          </button>
        </div>
      </div>

      {/* ── Attestation DG ── */}
      <div className="space-y-4">
        <h3 className="font-semibold">Attestations de dépôt de garantie</h3>
        {attestations.length === 0 && !editAttestation && <p className="text-gray-500 text-sm">Aucune attestation enregistrée.</p>}
        {attestations.map(a => (
          <div key={a.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{a.montant.toFixed(2)} € — versé le {formatDate(a.date_versement)}</p>
              <p className="text-sm text-gray-500">Mode : {a.mode_versement}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => p && import("@/lib/generate-contrats-pdf").then(m => m.generateAttestationDGPDF(a, bail, p))} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">PDF</button>
              <button onClick={() => setEditAttestation(a)} className="text-gray-600 hover:underline text-sm">Modifier</button>
              <button onClick={() => { deleteAttestationDG(a.id); reload(); }} className="text-red-500 hover:underline text-sm">Suppr.</button>
            </div>
          </div>
        ))}
        {editAttestation && (
          <div className="border-2 border-blue-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-blue-800">{editAttestation.created_at ? "Modifier l'attestation" : "Nouvelle attestation"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Civilité du locataire</label>
                <select value={editAttestation.civilite_locataire ?? "Monsieur"} onChange={e => setEditAttestation({ ...editAttestation, civilite_locataire: e.target.value as "Madame" | "Monsieur" })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="Monsieur">Monsieur</option>
                  <option value="Madame">Madame</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€)</label>
                <input type="number" step="0.01" value={editAttestation.montant} onChange={e => setEditAttestation({ ...editAttestation, montant: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de versement</label>
                <input type="date" value={editAttestation.date_versement} onChange={e => setEditAttestation({ ...editAttestation, date_versement: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de versement</label>
                <select value={editAttestation.mode_versement} onChange={e => setEditAttestation({ ...editAttestation, mode_versement: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {MODES_VERSEMENT.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date du bail</label>
                <input type="date" value={editAttestation.date_bail} onChange={e => setEditAttestation({ ...editAttestation, date_bail: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={saveAttestationForm} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Enregistrer</button>
              <button onClick={() => setEditAttestation(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">Annuler</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cautionnement ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Actes de cautionnement solidaire</h3>
          <button onClick={() => setEditCaution(newCaution())} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Générer un acte</button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Le document est pré-rempli avec les données du bail. Les informations du garant sont laissées vierges pour être complétées à la main.
        </div>
        {cautions.length === 0 && !editCaution && <p className="text-gray-500 text-sm">Aucun acte généré.</p>}
        {cautions.map(c => (
          <div key={c.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Acte du {c.date ? formatDate(c.date) : "—"}</p>
              <p className="text-xs text-gray-500">{c.lieu || "—"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => p && import("@/lib/generate-contrats-pdf").then(m => m.generateCautionnementPDF(c, bail, p))} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Télécharger PDF</button>
              <button onClick={() => setEditCaution(c)} className="text-gray-600 hover:underline text-sm">Modifier</button>
              <button onClick={() => { deleteCaution(c.id); reload(); }} className="text-red-500 hover:underline text-sm">Suppr.</button>
            </div>
          </div>
        ))}
        {editCaution && (
          <div className="border-2 border-blue-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-blue-800">Paramètres de l'acte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail du garant</label>
                <input type="email" value={editCaution.garant_email} onChange={e => setEditCaution({ ...editCaution, garant_email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone du garant</label>
                <input type="tel" value={editCaution.garant_telephone} onChange={e => setEditCaution({ ...editCaution, garant_telephone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de l'acte</label>
                <input type="date" value={editCaution.date} onChange={e => setEditCaution({ ...editCaution, date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de signature</label>
                <input value={editCaution.lieu} onChange={e => setEditCaution({ ...editCaution, lieu: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plafond de garantie (€)</label>
                <input type="number" value={editCaution.plafond_garantie} onChange={e => setEditCaution({ ...editCaution, plafond_garantie: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={saveCautionForm} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Enregistrer et télécharger PDF</button>
              <button onClick={() => setEditCaution(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">Annuler</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Documents uploadés ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h3 className="font-semibold">
            Documents importés
            {bail.documents.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({bail.documents.length})</span>}
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <input type="text" value={rechercheDoc} onChange={e => setRechercheDoc(e.target.value)} placeholder="Rechercher..." className="flex-1 sm:w-48 border rounded-lg px-3 py-1.5 text-sm" />
            <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap">+ Ajouter</button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>
        {bail.documents.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun document importé.</p>
        ) : (() => {
          const docsFiltres = bail.documents.filter(d => {
            if (!rechercheDoc) return true;
            const q = rechercheDoc.toLowerCase();
            return d.nom.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.fichier_nom.toLowerCase().includes(q);
          });
          if (docsFiltres.length === 0) return <p className="text-gray-400 text-sm italic">Aucun document ne correspond à la recherche.</p>;
          return (
            <div className="space-y-2">
              {docsFiltres.map(doc => (
                <div key={doc.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 hover:bg-white transition-colors">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <input value={doc.nom} onChange={e => updateDocument(doc.id, "nom", e.target.value)} className="border rounded px-2 py-1 text-sm font-medium bg-white w-48" />
                      <select value={doc.type} onChange={e => updateDocument(doc.id, "type", e.target.value)} className="border rounded px-2 py-1 text-sm bg-white">
                        {TYPES_DOCUMENT.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <p className="text-xs text-gray-400">{doc.fichier_nom} — Ajouté le {doc.date_ajout}</p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => downloadDocument(doc)} className="text-blue-600 hover:underline text-sm">Télécharger</button>
                    <button onClick={() => deleteDocument(doc.id)} className="text-red-500 hover:underline text-sm">Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
