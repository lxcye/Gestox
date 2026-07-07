"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Bail, BailAnnexe, HistoriqueCharges, BailIncident, IncidentCategorie, IncidentStatut, IncidentPriorite } from "@/lib/types";
import { getBail, saveBail } from "@/lib/store";

import TabBail from "./tabs/TabBail";
import TabLogement from "./tabs/TabLogement";
import TabEDL from "./tabs/TabEDL";
import TabFinances from "./tabs/TabFinances";
import TabRegistres from "./tabs/TabRegistres";
import TabDocuments from "./tabs/TabDocuments";
import TabIncidents from "./tabs/TabIncidents";
type Tab = "bail" | "logement" | "edl" | "finances" | "registres" | "documents" | "incidents";

const TABS: { key: Tab; label: string }[] = [
  { key: "bail", label: "Bail" },
  { key: "logement", label: "Logement" },
  { key: "edl", label: "États des lieux" },
  { key: "finances", label: "Gestion financière" },
  { key: "incidents", label: "Incidents" },
  { key: "registres", label: "Registres" },
  { key: "documents", label: "Documents" },
];

function migrateBail(b: Bail): Bail {
  const isMenuble = b.contrat.type_bail !== "Vide";
  const defaultAnnexes: BailAnnexe[] = [
    { id: "a1", nom: "Notice d'information relative aux droits et obligations des locataires et des bailleurs", remis: false },
    { id: "a2", nom: "État des lieux d'entrée", remis: false },
    { id: "a3", nom: "Diagnostic de performance énergétique (DPE)", remis: false },
    { id: "a4", nom: "Constat de risque d'exposition au plomb (CREP)", remis: false },
    { id: "a5", nom: "État des risques et pollutions (ERP)", remis: false },
    { id: "a6", nom: "Dossier de diagnostic technique (DDT)", remis: false },
    ...(isMenuble ? [] : [{ id: "a7", nom: "Grille de vétusté (optionnelle)", remis: false }]),
  ];
  return {
    ...b,
    logement: {
      ...b.logement,
      equipements_logement: b.logement.equipements_logement ?? "",
      mode_chauffage: b.logement.mode_chauffage ?? "",
      mode_eau_chaude: b.logement.mode_eau_chaude ?? "",
      dpe_classe: b.logement.dpe_classe ?? "",
      dpe_conso: b.logement.dpe_conso ?? "",
      dpe_ges: b.logement.dpe_ges ?? "",
      dpe_date: b.logement.dpe_date ?? "",
    },
    locataire: {
      ...b.locataire,
      civilite: b.locataire.civilite || "Monsieur",
      lieu_naissance: b.locataire.lieu_naissance || "",
    },
    contrat: {
      ...b.contrat,
      irl_annee: b.contrat.irl_annee || "",
      irl_valeur: b.contrat.irl_valeur || "",
      regime_charges: b.contrat.regime_charges || (isMenuble ? "Forfait" : "Provision avec régularisation"),
      travaux_realises: b.contrat.travaux_realises || "",
      travaux_prevus: b.contrat.travaux_prevus || "",
      destination_locaux: b.contrat.destination_locaux || "Habitation principale",
      clauses_particulieres: b.contrat.clauses_particulieres || "",
      clauses_resolutoires: b.contrat.clauses_resolutoires ?? [],
      nombre_pieces: b.contrat.nombre_pieces || "",
    },
    incidents: (b.incidents ?? []).map((inc): BailIncident => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = inc as any;
      if (raw.statut) return { ...inc, pieces_jointes: inc.pieces_jointes ?? [], interventions: inc.interventions ?? [] } as BailIncident; // déjà migré
      const typeMap: Record<string, { categorie: IncidentCategorie; sous_categorie: string }> = {
        "Retard de paiement": { categorie: "Paiement", sous_categorie: "Retard" },
        "Litige": { categorie: "Administratif", sous_categorie: "Réclamation" },
        "Travaux demandés": { categorie: "Technique", sous_categorie: "Autre" },
        "Travaux réalisés": { categorie: "Technique", sous_categorie: "Autre" },
        "Sinistre": { categorie: "Administratif", sous_categorie: "Sinistre" },
        "Autre": { categorie: "Divers", sous_categorie: "" },
      };
      const cat = typeMap[raw.type ?? "Autre"] ?? { categorie: "Divers" as IncidentCategorie, sous_categorie: "" };
      const statut: IncidentStatut = raw.resolu ? "Résolu" : "Nouveau";
      const today = raw.date || new Date().toISOString().split("T")[0];
      return {
        id: raw.id,
        date_creation: today,
        statut,
        priorite: "Normale" as IncidentPriorite,
        categorie: cat.categorie,
        sous_categorie: cat.sous_categorie,
        objet: raw.type || "Incident importé",
        description: raw.description || "",
        localisation: "",
        declarant: "",
        declarant_date: today,
        declarant_moyen: "",
        devis_estime: 0,
        cout_reel: 0,
        prise_en_charge: "",
        assurance_concerne: false,
        assurance_numero_dossier: "",
        assurance_nom: "",
        assurance_franchise: 0,
        assurance_remboursement: 0,
        resolu: raw.resolu ?? false,
        date_resolution: raw.date_resolution || "",
        solution: "",
        commentaire_final: "",
        pieces_jointes: [],
        interventions: [],
        historique: [
          { id: `mig_${raw.id}`, date: today + "T00:00:00.000Z", icone: "created", texte: `Incident importé : ${raw.type || "Autre"}` },
          ...(raw.resolu && raw.date_resolution ? [{ id: `mig_res_${raw.id}`, date: raw.date_resolution + "T00:00:00.000Z", icone: "resolved" as const, texte: "Incident marqué résolu" }] : []),
        ],
      };
    }),
    documents: b.documents ?? [],
    annexes_bail: b.annexes_bail?.length ? b.annexes_bail : defaultAnnexes,
    signatures_contrat: b.signatures_contrat ?? {},
    historique_charges: (() => {
      if (b.historique_charges?.length) return b.historique_charges;
      // Reconstruit l'historique depuis les données existantes
      const entries: HistoriqueCharges[] = [];
      const regsAppliquees = (b.regularisations_charges ?? [])
        .filter(r => r.provisions_appliquees && r.date_effet_nouvelles_provisions)
        .sort((a, c) => a.date_effet_nouvelles_provisions.localeCompare(c.date_effet_nouvelles_provisions));
      // Entrée initiale à la date de début du bail
      const dateInitiale = b.contrat.date_debut || b.created_at.split("T")[0];
      // Si des régularisations existent, les montants avant la première sont inconnus.
      // On estime les charges initiales à la valeur actuelle si aucune régularisation, sinon non ajoutée.
      if (!regsAppliquees.length) {
        entries.push({ id: "initial", date_effet: dateInitiale, montant: b.finances.charges, source: "initial" });
      } else {
        // On ajoute uniquement les entrées des régularisations appliquées
        for (const r of regsAppliquees) {
          entries.push({ id: r.id, date_effet: r.date_effet_nouvelles_provisions, montant: r.nouvelles_provisions_mensuelles, source: "regularisation" });
        }
      }
      return entries;
    })(),
    investissement: b.investissement ?? {},
  };
}

export default function BailDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [bail, setBail] = useState<Bail | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("bail");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const b = getBail(id);
    if (b) setBail(migrateBail(b));
  }, [id]);

  function handleSave(updated: Bail) {
    saveBail(updated);
    setBail(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!bail) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Bail introuvable.</p>
        <Link href="/baux" className="text-blue-600 hover:underline mt-2 inline-block">← Retour aux baux</Link>
      </div>
    );
  }

  const titre = bail.logement.adresse
    ? `${bail.logement.adresse}, ${bail.logement.ville || ""}`
    : "Nouveau bail";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/baux")}
          className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
        >
          ← Retour
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{titre}</h1>
          <p className="text-xs text-gray-500">
            {bail.locataire.prenom} {bail.locataire.nom}
            {bail.contrat.date_debut ? ` — depuis le ${new Date(bail.contrat.date_debut).toLocaleDateString("fr-FR")}` : ""}
          </p>
        </div>
        {saved && (
          <span className="text-green-600 text-sm shrink-0">Enregistré ✓</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max px-4 md:px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "bail" && (
          <TabBail bail={bail} onSave={handleSave} />
        )}
        {activeTab === "logement" && (
          <TabLogement bail={bail} onSave={handleSave} />
        )}
        {activeTab === "edl" && (
          <TabEDL bail={bail} bailId={id} />
        )}
        {activeTab === "finances" && (
          <TabFinances bail={bail} onSave={handleSave} />
        )}
        {activeTab === "incidents" && (
          <TabIncidents bail={bail} onSave={handleSave} />
        )}
        {activeTab === "registres" && (
          <TabRegistres bail={bail} onSave={handleSave} />
        )}
        {activeTab === "documents" && (
          <TabDocuments bail={bail} bailId={id} onSave={handleSave} />
        )}
      </div>
    </div>
  );
}
