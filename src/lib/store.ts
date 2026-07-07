// Stockage local pour le MVP (sans Supabase pour commencer)
// On migrera vers Supabase quand l'auth sera en place

import type { Bail, Locataire, Parametres, Paiement, Quittance, EtatDesLieux, LogementTemplate, ActeCautionnement, AttestationDepotGarantie, ConfigLogement, TacheManuelle, LogementSaisonnier, ReservationSaisonniere } from "./types";

const STORAGE_KEYS = {
  parametres: "gestox_parametres",
  locataires: "gestox_locataires",
  quittances: "gestox_quittances",
  paiements: "gestox_paiements",
  learned_caract: "gestox_learned_caract",
  baux: "gestox_baux",
  etats_des_lieux: "gestox_etats_des_lieux",
  logement_templates: "gestox_logement_templates",
  cautions: "gestox_cautions",
  attestations_dg: "gestox_attestations_dg",
  config_logements: "gestox_config_logements",
  taches: "gestox_taches",
  logements_saisonniers: "gestox_logements_saisonniers",
  reservations_saisonnieres: "gestox_reservations_saisonnieres",
};

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  // Notify sync layer that local data changed
  import("./sync").then(({ markDirty }) => markDirty()).catch(() => {});
}

// --- Paramètres ---
export function getParametres(): Parametres {
  return getItem<Parametres>(STORAGE_KEYS.parametres, {
    id: "1",
    user_id: "1",
    type_bailleur: "particulier",
    co_bailleurs: [],
    civilite: "Monsieur",
    nom: "",
    prenom: "",
    denomination_sociale: "",
    forme_juridique: "",
    adresse_siege: "",
    siret: "",
    qualite_signataire: "",
    qualite_signataire_autre: "",
    adresse: "",
    code_postal: "",
    ville: "",
    pays: "France",
    telephone: "",
    email: "",
    lieu_signature: "Neuchâtel",
    signature_proprietaire: null,
  });
}

export function saveParametres(params: Parametres): void {
  setItem(STORAGE_KEYS.parametres, params);
}

// --- Locataires ---
export function getLocataires(): Locataire[] {
  return getItem<Locataire[]>(STORAGE_KEYS.locataires, []);
}

export function getLocataire(id: string): Locataire | undefined {
  return getLocataires().find((l) => l.id === id);
}

export function saveLocataire(locataire: Locataire): void {
  const all = getLocataires();
  const idx = all.findIndex((l) => l.id === locataire.id);
  if (idx >= 0) {
    all[idx] = { ...locataire, updated_at: new Date().toISOString() };
  } else {
    all.push({
      ...locataire,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  setItem(STORAGE_KEYS.locataires, all);
}

export function deleteLocataire(id: string): void {
  const all = getLocataires().filter((l) => l.id !== id);
  setItem(STORAGE_KEYS.locataires, all);
}

// --- Quittances ---
export function getQuittances(): Quittance[] {
  return getItem<Quittance[]>(STORAGE_KEYS.quittances, []);
}

export function getQuittancesForLocataire(locataireId: string): Quittance[] {
  return getQuittances().filter((q) => q.locataire_id === locataireId);
}

export function saveQuittance(quittance: Quittance): void {
  const all = getQuittances();
  const idx = all.findIndex((q) => q.id === quittance.id);
  if (idx >= 0) {
    all[idx] = quittance;
  } else {
    all.push({ ...quittance, created_at: new Date().toISOString() });
  }
  setItem(STORAGE_KEYS.quittances, all);
}

export function deleteQuittance(id: string): void {
  const all = getQuittances().filter((q) => q.id !== id);
  setItem(STORAGE_KEYS.quittances, all);
}

// --- Paiements ---
export function getPaiements(): Paiement[] {
  return getItem<Paiement[]>(STORAGE_KEYS.paiements, []);
}

export function getPaiementsForLocataire(locataireId: string): Paiement[] {
  return getPaiements().filter((p) => p.locataire_id === locataireId);
}

export function savePaiement(paiement: Paiement): void {
  const all = getPaiements();
  const idx = all.findIndex((p) => p.id === paiement.id);
  if (idx >= 0) {
    all[idx] = paiement;
  } else {
    all.push({ ...paiement, created_at: new Date().toISOString() });
  }
  setItem(STORAGE_KEYS.paiements, all);
}

export function deletePaiement(id: string): void {
  const all = getPaiements().filter((p) => p.id !== id);
  setItem(STORAGE_KEYS.paiements, all);
}

// --- Baux ---
export function getBaux(): Bail[] {
  return getItem<Bail[]>(STORAGE_KEYS.baux, []);
}

export function getBail(id: string): Bail | undefined {
  return getBaux().find((b) => b.id === id);
}

export function saveBail(bail: Bail): void {
  const all = getBaux();
  const idx = all.findIndex((b) => b.id === bail.id);
  if (idx >= 0) {
    all[idx] = { ...bail, updated_at: new Date().toISOString() };
  } else {
    all.push({
      ...bail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  setItem(STORAGE_KEYS.baux, all);
}

export function deleteBail(id: string): void {
  const all = getBaux().filter((b) => b.id !== id);
  setItem(STORAGE_KEYS.baux, all);
}

// --- États des lieux ---
export function getEtatsDesLieux(): EtatDesLieux[] {
  return getItem<EtatDesLieux[]>(STORAGE_KEYS.etats_des_lieux, []);
}

export function getEtatsDesLieuxForBail(bailId: string): EtatDesLieux[] {
  return getEtatsDesLieux().filter((e) => e.bail_id === bailId);
}

export function saveEtatDesLieux(edl: EtatDesLieux): void {
  const all = getEtatsDesLieux();
  const idx = all.findIndex((e) => e.id === edl.id);
  if (idx >= 0) {
    all[idx] = { ...edl, updated_at: new Date().toISOString() };
  } else {
    all.push({ ...edl, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  setItem(STORAGE_KEYS.etats_des_lieux, all);
}

export function deleteEtatDesLieux(id: string): void {
  setItem(STORAGE_KEYS.etats_des_lieux, getEtatsDesLieux().filter((e) => e.id !== id));
}

// --- Templates logement (mémoire état des lieux) ---
export function getLogementTemplates(): LogementTemplate[] {
  return getItem<LogementTemplate[]>(STORAGE_KEYS.logement_templates, []);
}

export function getLogementTemplate(id: string): LogementTemplate | undefined {
  return getLogementTemplates().find((t) => t.id === id);
}

export function saveLogementTemplate(template: LogementTemplate): void {
  const all = getLogementTemplates();
  const idx = all.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    all[idx] = template;
  } else {
    all.push(template);
  }
  setItem(STORAGE_KEYS.logement_templates, all);
}

// --- Actes de cautionnement ---
export function getCautions(): ActeCautionnement[] {
  return getItem<ActeCautionnement[]>(STORAGE_KEYS.cautions, []);
}

export function getCautionsForBail(bailId: string): ActeCautionnement[] {
  return getCautions().filter((c) => c.bail_id === bailId);
}

export function saveCaution(caution: ActeCautionnement): void {
  const all = getCautions();
  const idx = all.findIndex((c) => c.id === caution.id);
  if (idx >= 0) {
    all[idx] = caution;
  } else {
    all.push({ ...caution, created_at: new Date().toISOString() });
  }
  setItem(STORAGE_KEYS.cautions, all);
}

export function deleteCaution(id: string): void {
  setItem(STORAGE_KEYS.cautions, getCautions().filter((c) => c.id !== id));
}

// --- Attestations dépôt de garantie ---
export function getAttestationsDG(): AttestationDepotGarantie[] {
  return getItem<AttestationDepotGarantie[]>(STORAGE_KEYS.attestations_dg, []);
}

export function getAttestationsDGForBail(bailId: string): AttestationDepotGarantie[] {
  return getAttestationsDG().filter((a) => a.bail_id === bailId);
}

export function saveAttestationDG(att: AttestationDepotGarantie): void {
  const all = getAttestationsDG();
  const idx = all.findIndex((a) => a.id === att.id);
  if (idx >= 0) {
    all[idx] = att;
  } else {
    all.push({ ...att, created_at: new Date().toISOString() });
  }
  setItem(STORAGE_KEYS.attestations_dg, all);
}

export function deleteAttestationDG(id: string): void {
  setItem(STORAGE_KEYS.attestations_dg, getAttestationsDG().filter((a) => a.id !== id));
}

// --- Config logement (équipements + pièces actives) ---
// La config est indexée par l'adresse du logement (id = adresse_cp) pour
// être partagée entre tous les baux successifs du même appartement.
export function getConfigLogement(logementId: string): ConfigLogement | undefined {
  const all = getItem<ConfigLogement[]>(STORAGE_KEYS.config_logements, []);
  // Cherche d'abord par id (adresse-based), puis par bail_id pour rétro-compat.
  return all.find((c) => c.id === logementId) ?? all.find((c) => c.bail_id === logementId);
}

export function saveConfigLogement(config: ConfigLogement): void {
  const all = getItem<ConfigLogement[]>(STORAGE_KEYS.config_logements, []);
  const idx = all.findIndex((c) => c.id === config.id);
  const updated = { ...config, updated_at: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  setItem(STORAGE_KEYS.config_logements, all);
}

// --- Caractéristiques apprises ---
// Clés : "logement:{logementId}:{categoryName}" et "global:{categoryName}"
type LearnedCaract = Record<string, string[]>;

function getLearnedCaract(): LearnedCaract {
  return getItem<LearnedCaract>(STORAGE_KEYS.learned_caract, {});
}

export function addLearnedCaracteristique(logementId: string, categoryName: string, caract: string): void {
  const all = getLearnedCaract();
  const logKey = `logement:${logementId}:${categoryName}`;
  const globalKey = `global:${categoryName}`;
  for (const key of [logKey, globalKey]) {
    if (!all[key]) all[key] = [];
    if (!all[key].includes(caract)) all[key].push(caract);
  }
  setItem(STORAGE_KEYS.learned_caract, all);
}

export function getLearnedCaracteristiques(logementId: string, categoryName: string): string[] {
  const all = getLearnedCaract();
  const logKey = `logement:${logementId}:${categoryName}`;
  const globalKey = `global:${categoryName}`;
  // Logement d'abord, puis global (dédupliqués)
  const merged = [...(all[logKey] ?? [])];
  for (const c of (all[globalKey] ?? [])) {
    if (!merged.includes(c)) merged.push(c);
  }
  return merged;
}

// --- Tâches ---
export function getTaches(): TacheManuelle[] {
  return getItem<TacheManuelle[]>(STORAGE_KEYS.taches, []);
}
export function saveTaches(taches: TacheManuelle[]): void {
  setItem(STORAGE_KEYS.taches, taches);
}

// --- Logements saisonniers ---
export function getLogementsSaisonniers(): LogementSaisonnier[] {
  return getItem<LogementSaisonnier[]>(STORAGE_KEYS.logements_saisonniers, []);
}

export function saveLogementSaisonnier(l: LogementSaisonnier): void {
  const all = getLogementsSaisonniers();
  const idx = all.findIndex(x => x.id === l.id);
  const updated = { ...l, updated_at: new Date().toISOString() };
  if (idx >= 0) all[idx] = updated; else all.push(updated);
  setItem(STORAGE_KEYS.logements_saisonniers, all);
}

export function deleteLogementSaisonnier(id: string): void {
  setItem(STORAGE_KEYS.logements_saisonniers, getLogementsSaisonniers().filter(l => l.id !== id));
  setItem(STORAGE_KEYS.reservations_saisonnieres, getReservationsSaisonnieres().filter(r => r.logement_id !== id));
}

// --- Réservations saisonnières ---
export function getReservationsSaisonnieres(): ReservationSaisonniere[] {
  return getItem<ReservationSaisonniere[]>(STORAGE_KEYS.reservations_saisonnieres, []);
}

export function getReservationsForLogement(logementId: string): ReservationSaisonniere[] {
  return getReservationsSaisonnieres().filter(r => r.logement_id === logementId);
}

export function saveReservationSaisonniere(r: ReservationSaisonniere): void {
  const all = getReservationsSaisonnieres();
  const idx = all.findIndex(x => x.id === r.id);
  if (idx >= 0) all[idx] = r; else all.push(r);
  setItem(STORAGE_KEYS.reservations_saisonnieres, all);
}

export function deleteReservationSaisonniere(id: string): void {
  setItem(STORAGE_KEYS.reservations_saisonnieres, getReservationsSaisonnieres().filter(r => r.id !== id));
}
