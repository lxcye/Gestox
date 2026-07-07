export interface TacheManuelle {
  id: string;
  titre: string;
  date_echeance: string;
  priorite: "haute" | "moyenne" | "basse";
  faite: boolean;
  created_at: string;
}

export interface Proprietaire {
  id: string;
  nom: string;
  prenom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  lieu_signature: string;
}

export interface Locataire {
  id: string;
  proprietaire_id: string;
  civilite: "Madame" | "Monsieur" | "Madame et Monsieur";
  nom: string;
  prenom: string;
  adresse_location: string;
  code_postal_location: string;
  ville_location: string;
  pays_location: string;
  loyer: number;
  charges: number;
  date_debut_bail: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Quittance {
  id: string;
  locataire_id: string;
  proprietaire_id: string;
  mois: number;
  annee: number;
  loyer: number;
  charges: number;
  date_paiement: string;
  date_emission: string;
  lieu_emission: string;
  periode_debut: string;
  periode_fin: string;
  signature_data: string | null;
  created_at: string;
}

export interface Paiement {
  id: string;
  locataire_id: string;
  mois: number;
  annee: number;
  montant_du: number;        // montant total dû (loyer + charges)
  montant_paye: number;      // montant effectivement payé
  date_paiement: string;
  mode_paiement: "Virement" | "Chèque" | "Espèces" | "Prélèvement" | "Autre";
  commentaire: string;
  quittance_id: string | null; // lié à une quittance ou null si ajout manuel
  created_at: string;
}

// --- Registre des baux ---

export interface BailLogement {
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  type_bien: "Studio" | "T1" | "T2" | "T3" | "T4" | "T5+" | "Maison" | "Autre";
  meuble: "Meublé" | "Vide";
  surface_m2: number;
  etage: string;
  numero_lot: string;
  annexes: string; // autres parties du logement : grenier, terrasse, balcon, jardin...
  equipements_logement: string; // cuisine équipée, installations sanitaires, etc.
  mode_chauffage: "Individuel" | "Collectif" | "";
  mode_eau_chaude: "Individuel" | "Collectif" | "";
  quote_part: string; // ex: "152/1000"
  dpe_classe: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "";
  dpe_conso: string;  // kWh/m²/an
  dpe_ges: string;    // kg CO2/m²/an
  dpe_date: string;   // date du diagnostic
}

export interface BailLocataire {
  locataire_id: string; // lien vers la rubrique Locataires
  civilite: "Monsieur" | "Madame" | "Monsieur et Madame";
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  telephone: string;
  email: string;
  situation: "Salarié" | "Étudiant" | "Indépendant" | "Retraité" | "Sans emploi" | "Autre";
  garant_nom: string;
  date_entree: string;
  date_sortie: string; // vide si toujours en place
  en_place: boolean;
}

export interface BailContrat {
  type_bail: "Meublé" | "Vide" | "Étudiant" | "Mobilité" | "Professionnel" | "Autre";
  date_signature: string;
  date_debut: string;
  duree_mois: number;
  date_fin: string;
  reconduction_tacite: boolean;
  depot_garantie: number;
  indexation_irl: boolean;
  trimestre_irl_reference: number; // 1-4 (trimestre de référence IRL), 0 = non défini
  irl_annee: string;    // ex: "2024"
  irl_valeur: string;   // ex: "143.46"
  regime_charges: "Forfait" | "Provision avec régularisation";
  travaux_realises: string;  // travaux effectués depuis dernier contrat
  travaux_prevus: string;    // travaux que le bailleur s'engage à réaliser
  destination_locaux: "Habitation principale" | "Usage mixte professionnel et d'habitation";
  clauses_particulieres: string;
  clauses_resolutoires: string[]; // clauses résolutoires supplémentaires
  nombre_pieces: string; // nombre de pièces principales
}

export interface BailAnnexe {
  id: string;
  nom: string;
  remis: boolean;
}

export interface BailFinances {
  loyer_hc: number;
  charges: number;
  loyer_total: number;
  mode_paiement: "Virement" | "Chèque" | "Espèces" | "Prélèvement" | "Autre";
  date_paiement_prevue: string; // ex: "5" pour le 5 du mois
  locataire_id: string; // lien vers le registre des paiements
}

export interface BailRevisionLoyer {
  id: string;
  date_courrier: string;
  date_contrat: string;
  date_effet: string;
  ancien_loyer: number;
  indice_ancien: number;
  indice_nouveau: number;
  periode_irl_nouveau: string;  // ex: "2025-Q2" (machine-readable)
  periode_irl_ancien: string;   // ex: "2024-Q2"
  date_jo_irl: string;
  loyer_max: number;
  loyer_choisi: number;
}

export interface HistoriqueCharges {
  id: string;
  date_effet: string; // YYYY-MM-DD — date à partir de laquelle ce montant s'applique
  montant: number;
  source: "initial" | "regularisation" | "modification_manuelle";
}

export interface LigneCharge {
  id: string;
  intitule: string;
  montant_mensuel_provision: number;
  montant_mensuel_reel: number;
}

export interface BailRegularisationCharges {
  id: string;
  date: string;
  periode_debut: string;
  periode_fin: string;
  quote_part: string;
  lignes: LigneCharge[];
  nouvelles_provisions_mensuelles: number;
  date_effet_nouvelles_provisions: string;
  paiement_cree: boolean;
  provisions_appliquees: boolean;
}

export type IncidentStatut = "Nouveau" | "En cours" | "En attente" | "Résolu" | "Clos";
export type IncidentPriorite = "Faible" | "Normale" | "Haute" | "Urgente";
export type IncidentCategorie = "Technique" | "Administratif" | "Vie de l'immeuble" | "Paiement" | "Divers";

export const INCIDENT_SOUS_CATEGORIES: Record<IncidentCategorie, string[]> = {
  "Technique": ["Plomberie", "Électricité", "Chauffage", "Eau chaude", "Climatisation", "Serrurerie", "Électroménager", "Menuiserie", "Humidité", "Infiltration", "Toiture", "Ascenseur", "Autre"],
  "Administratif": ["Assurance", "Sinistre", "Dégradation", "Dépôt de garantie", "Réclamation", "Assurance habitation manquante", "Autre"],
  "Vie de l'immeuble": ["Nuisances sonores", "Déchets", "Parties communes", "Animaux", "Voisinage", "Police", "Autre"],
  "Paiement": ["Retard", "Impayé", "Chèque rejeté", "Autre"],
  "Divers": [], // texte libre — sous_categorie saisi manuellement
};

export interface IncidentHistoriqueEntry {
  id: string;
  date: string; // ISO datetime
  icone: "created" | "status" | "note" | "artisan" | "document" | "cost" | "insurance" | "resolved" | "closed" | "mail" | "relance" | "intervention" | "devis" | "travaux";
  texte: string;
}

export interface BailIncidentIntervention {
  id: string;
  artisan: string;
  date_prevue: string;
  date_realisee: string;
  duree: string;
  commentaire: string;
  cout: number;
  facture_key: string;
  facture_nom: string;
  facture_taille?: number;
}

export type PieceJointeType = "Photo" | "Vidéo" | "Facture" | "Devis" | "Courrier" | "Rapport d'expertise";

export interface IncidentPieceJointe {
  id: string;
  type_pj: PieceJointeType;
  nom: string;
  fichier_nom: string;
  fichier_key: string;
  date_ajout: string;
  taille?: number;
}

export interface BailIncident {
  id: string;
  date_creation: string;
  statut: IncidentStatut;
  priorite: IncidentPriorite;
  categorie: IncidentCategorie;
  sous_categorie: string;
  objet: string;
  description: string;
  localisation: string;
  declarant: "Locataire" | "Propriétaire" | "Syndic" | "Voisin" | "Artisan" | "Mandataire" | "";
  declarant_date: string;
  declarant_moyen: "Mail" | "Téléphone" | "SMS" | "Application" | "Courrier" | "";
  devis_estime: number;
  cout_reel: number;
  prise_en_charge: "Propriétaire" | "Locataire" | "Assurance" | "Syndic" | "";
  assurance_concerne: boolean;
  assurance_numero_dossier: string;
  assurance_nom: string;
  assurance_franchise: number;
  assurance_remboursement: number;
  resolu: boolean; // dérivé du statut, conservé pour compatibilité
  date_resolution: string;
  solution: string;
  commentaire_final: string;
  historique: IncidentHistoriqueEntry[];
  pieces_jointes: IncidentPieceJointe[];
  interventions: BailIncidentIntervention[];
}

export interface BailDocument {
  id: string;
  nom: string;
  type: string; // catégorie libre (gérée dans les paramètres)
  date_ajout: string;
  fichier_nom: string;
  fichier_key: string;   // clé IndexedDB
  fichier_data?: string; // legacy base64 (anciens documents uniquement)
}

export interface Bail {
  id: string;
  proprietaire_id: string;
  logement: BailLogement;
  locataire: BailLocataire;
  contrat: BailContrat;
  finances: BailFinances;
  revisions_loyer: BailRevisionLoyer[];
  regularisations_charges: BailRegularisationCharges[];
  incidents: BailIncident[];
  documents: BailDocument[];
  annexes_bail: BailAnnexe[];
  historique_charges: HistoriqueCharges[];
  signatures_contrat: Record<string, string | null>; // key: "bailleur" | "cobailleur_[id]" | "locataire"
  investissement: BailInvestissement;
  created_at: string;
  updated_at: string;
}

export interface BailInvestissement {
  prix_achat?: number;
  charges_proprio_mensuelles?: number;
  mensualite_credit?: number;
}

// ── Bail et contrats ──────────────────────────────────────────────────────────

export type EtatElement = "Neuf" | "Bon état" | "État moyen" | "Usage avancé" | "Dégradé" | "";

export interface ItemEDL {
  id: string;
  nom: string;
  quantite: string;           // default "1"
  caracteristiques: string[]; // multi-select (ex: ["PVC", "Double vitrage"])
  etat: EtatElement;          // default "Bon état"
  observations: string[];     // tags prédéfinis (ex: ["RAS"]) — default ["RAS"]
  commentaire: string;        // texte libre facultatif
  photos: string[];           // clés IndexedDB — plusieurs photos par élément
}

export interface CategorieEDL {
  id: string;
  nom: string;
  items: ItemEDL[];
}

export interface PieceEDL {
  id: string;
  nom: string;
  present: boolean;
  categories: CategorieEDL[];
  photos: string[]; // clés IndexedDB — rempli dans l'EDL uniquement
}

export interface ReleverCompteur {
  id: string;
  type: string; // "Eau froide", "Eau chaude", "Électricité", "Gaz"
  numero: string;
  valeur: string;
  unite: string;
  photo: string; // clé IndexedDB
}

export interface CleRemise {
  id: string;
  type: string;
  quantite: string;
}

export interface EtatDesLieux {
  id: string;
  bail_id: string;
  type: "Entrant" | "Sortant";
  date: string;
  heure: string;
  pieces: PieceEDL[];
  releves_compteurs: ReleverCompteur[];
  cles: CleRemise[];
  cles_remises: string; // legacy / commentaire libre
  codes_acces: { id: string; label: string; code: string }[];
  annexes_documents: string; // documents échangés (attestation assurance, etc.)
  commentaire_general: string;
  signature_proprietaire: string | null;
  signature_locataire: string | null;
  signe_proprietaire_at: string;
  signe_locataire_at: string;
  created_at: string;
  updated_at: string;
}

// Template par logement (mémoire des pièces pour prochains états des lieux)
export interface LogementTemplate {
  id: string; // adresse + code_postal
  pieces: PieceEDL[];
  releves_compteurs: ReleverCompteur[];
}

export interface EquipementLogement {
  id: string;
  nom: string;
  present: boolean;
  etat: EtatElement;
  commentaire: string;
}

export interface ConfigLogement {
  id: string; // bail_id
  bail_id: string;
  equipements_exterieurs: EquipementLogement[];
  equipements_interieurs: EquipementLogement[];
  releves_compteurs: ReleverCompteur[];
  cles: CleRemise[];
  pieces: PieceEDL[];
  updated_at: string;
}

export interface ActeCautionnement {
  id: string;
  bail_id: string;
  garant_nom: string;
  garant_prenom: string;
  garant_adresse: string;
  garant_date_naissance: string;
  garant_lieu_naissance: string;
  garant_profession: string;
  garant_email: string;
  garant_telephone: string;
  plafond_garantie: number;
  date: string;
  lieu: string;
  signature_garant: string | null;
  created_at: string;
}

export interface AttestationDepotGarantie {
  id: string;
  bail_id: string;
  civilite_locataire: "Madame" | "Monsieur";
  montant: number;
  date_versement: string;
  mode_versement: string;
  date_bail: string;
  created_at: string;
}

export interface BailleurSignataire {
  id: string;
  type_bailleur: "particulier" | "societe";
  civilite: "Monsieur" | "Madame";
  nom: string;
  prenom: string;
  denomination_sociale: string;
  forme_juridique: "SCI" | "SARL de famille" | "SAS ou SARL" | "Société d'investissement immobilier" | "SEM" | "";
  adresse_siege: string;
  siret: string;
  qualite_signataire: "Gérant" | "Président" | "Autre" | "";
  qualite_signataire_autre: string;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
}

export interface Parametres {
  id: string;
  user_id: string;
  type_bailleur: "particulier" | "societe";
  co_bailleurs: BailleurSignataire[];
  // Particulier
  civilite: "Monsieur" | "Madame";
  nom: string;
  prenom: string;
  // Société
  denomination_sociale: string;
  forme_juridique: "SCI" | "SARL de famille" | "SAS ou SARL" | "Société d'investissement immobilier" | "SEM" | "";
  adresse_siege: string;
  siret: string;
  qualite_signataire: "Gérant" | "Président" | "Autre" | "";
  qualite_signataire_autre: string;
  // Commun
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  lieu_signature: string;
  signature_proprietaire: string | null;
}

// ── Locations saisonnières ────────────────────────────────────────────────────

export type ReservationStatut = "Confirmée" | "En attente" | "Annulée" | "Terminée";

export interface TarifSaison {
  id: string;
  nom: string;
  date_debut: string; // MM-DD
  date_fin: string;   // MM-DD
  prix_nuit: number;
}

export interface LogementSaisonnier {
  id: string;
  nom: string;
  adresse: string;
  capacite: number;
  prix_nuit: number;
  prix_semaine: number;
  frais_menage: number;
  caution: number;
  taxe_sejour_par_personne: number;
  promotion_pourcent: number;
  tarifs_saisons: TarifSaison[];
  created_at: string;
  updated_at: string;
}

export interface ReservationSaisonniere {
  id: string;
  logement_id: string;
  voyageur_nom: string;
  voyageur_email: string;
  voyageur_telephone: string;
  date_arrivee: string;  // YYYY-MM-DD
  date_depart: string;   // YYYY-MM-DD
  nb_voyageurs: number;
  statut: ReservationStatut;
  notes: string;
  plateforme: string;
  prix_total: number;
  created_at: string;
}
