import { jsPDF } from "jspdf";
import type { Bail, Parametres, ActeCautionnement, AttestationDepotGarantie, EtatDesLieux } from "./types";
import { registerArial } from "./register-arial";

export function getBailleurIdentite(p: Parametres): { nom: string; civ: string; adresse: string; detail: string } {
  if (p.type_bailleur === "societe") {
    const forme = p.forme_juridique ? `${p.forme_juridique} ` : "";
    const qualite = p.qualite_signataire === "Autre" ? p.qualite_signataire_autre : p.qualite_signataire;
    const rep = `${p.prenom} ${p.nom.toUpperCase()}`;
    return {
      nom: `${forme}${p.denomination_sociale}`,
      civ: forme + p.denomination_sociale,
      adresse: p.adresse_siege || p.adresse,
      detail: `represente par ${rep}${qualite ? `, ${qualite}` : ""}${p.siret ? ` - SIRET : ${p.siret}` : ""}`,
    };
  }
  const civ = p.civilite === "Madame" ? "Mme" : "M.";
  return {
    nom: `${p.prenom} ${p.nom.toUpperCase()}`,
    civ,
    adresse: p.adresse,
    detail: "",
  };
}

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function nombreEnLettres(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  if (n === 0) return "zéro";
  if (n < 20) return units[n];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 7) return "soixante-" + (u === 1 ? "et-onze" : units[10 + u]);
    if (t === 9) return "quatre-vingt-" + units[10 + u];
    return tens[t] + (u === 1 && t !== 8 ? "-et-" : u ? "-" : "") + (u ? units[u] : "");
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return (h === 1 ? "cent" : units[h] + " cent") + (r ? " " + nombreEnLettres(r) : "");
  }
  const k = Math.floor(n / 1000), r = n % 1000;
  return (k === 1 ? "mille" : nombreEnLettres(k) + " mille") + (r ? " " + nombreEnLettres(r) : "");
}

function addText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH = 5): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

function checkPage(doc: jsPDF, y: number, threshold = 265): number {
  if (y > threshold) {
    doc.addPage();
    return 20;
  }
  return y;
}

function pageFooter(doc: jsPDF, page: number, total: number) {
  doc.setFontSize(8);
  doc.setFont("arial", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text(`${page}/${total}`, 105, 290, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

// ── Contrat de bail (modèle officiel Arrêté du 29 mai 2015) ─────────────────────

export function generateBailPDF(bail: Bail, parametres: Parametres): void {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const W = 170;
  const X = 20;
  const LH = 5;

  const isMenuble = bail.contrat.type_bail !== "Vide";
  const typeLabel = isMenuble ? "MEUBLÉ" : "NU";
  const bailleurId = getBailleurIdentite(parametres);
  const nomProp = bailleurId.nom;
  const nomLoc = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  const civProp = bailleurId.civ;
  const civLoc = bail.locataire.civilite === "Madame" ? "Mme" : bail.locataire.civilite === "Monsieur et Madame" ? "M. et Mme" : "M.";
  const adresseLog = `${bail.logement.adresse}, ${bail.logement.code_postal} ${bail.logement.ville}`;
  const adresseProp = bailleurId.adresse ? `${bailleurId.adresse}, ${parametres.code_postal} ${parametres.ville}` : "";
  const loyerHC = bail.finances?.loyer_hc ?? 0;
  const charges = bail.finances?.charges ?? 0;
  const depotGarantie = bail.contrat?.depot_garantie ?? 0;
  const dureeMois = bail.contrat?.duree_mois ?? (isMenuble ? 12 : 36);
  const regimeCharges = bail.contrat?.regime_charges ?? (isMenuble ? "Forfait" : "Provision avec régularisation");
  const loyerEnLettres = nombreEnLettres(loyerHC);
  const chargesEnLettres = nombreEnLettres(charges);
  const dgEnLettres = nombreEnLettres(depotGarantie);

  // Bleu institutionnel
  const BLEU: [number, number, number] = [30, 58, 138];

  function h1(text: string, yy: number): number {
    doc.setFillColor(...BLEU);
    doc.rect(X, yy - 4, W, 8, "F");
    doc.setFont("arial", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(text, X + 3, yy);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    return yy + 9;
  }
  function h2(text: string, yy: number): number {
    doc.setFont("arial", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...BLEU);
    doc.text(text, X, yy);
    doc.setTextColor(0, 0, 0);
    return yy + 6;
  }
  function body(text: string, yy: number, indent = 0): number {
    doc.setFont("arial", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, W - indent) as string[];
    doc.text(lines, X + indent, yy);
    return yy + lines.length * LH;
  }
  function chk(yy: number): number {
    if (yy > 260) { doc.addPage(); return 20; }
    return yy;
  }
  function sep(yy: number): number {
    doc.setLineWidth(0.2);
    doc.setDrawColor(180, 180, 180);
    doc.line(X, yy, X + W, yy);
    doc.setDrawColor(0, 0, 0);
    return yy + 4;
  }

  // ── PAGE 1 : En-tête ──────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("arial", "bold");
  doc.setTextColor(...BLEU);
  doc.text(`CONTRAT DE LOCATION D'UN LOGEMENT ${typeLabel}`, 105, 18, { align: "center" });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(8);
  doc.setFont("arial", "italic");
  const ref = isMenuble
    ? "Soumis à la loi n° 89-462 du 6 juillet 1989 — Arrêté du 29 mai 2015 (logement meublé)"
    : "Soumis à la loi n° 89-462 du 6 juillet 1989 — Arrêté du 29 mai 2015 (logement nu)";
  doc.text(ref, 105, 25, { align: "center" });
  doc.setFont("arial", "normal");

  doc.setLineWidth(0.5);
  doc.setDrawColor(...BLEU);
  doc.line(X, 28, X + W, 28);
  doc.setDrawColor(0, 0, 0);

  let y = 38;

  // ── CHEMIN VIDE (Annexe 1 — Arrêté 29 mai 2015) ──────────────────────────────
  if (!isMenuble) {
    // I. DÉSIGNATION DES PARTIES ─────────────────────────────────────────────────
    y = h1("I.  DÉSIGNATION DES PARTIES", y);
    y += 2;
    y = h2("Le Bailleur :", y);
    y = body(civProp + " " + nomProp, y, 5);
    if (adresseProp) y = body("Adresse : " + adresseProp, y, 5);
    if (parametres.telephone) y = body("Tél : " + parametres.telephone, y, 5);
    if (parametres.email) y = body("E-mail : " + parametres.email, y, 5);
    y += 4;

    y = chk(y);
    y = h2("Le(s) Locataire(s) :", y);
    y = body(civLoc + " " + nomLoc, y, 5);
    if (bail.locataire.date_naissance) {
      const lieuN = bail.locataire.lieu_naissance ? ` à ${bail.locataire.lieu_naissance}` : "";
      y = body(`Né(e) le ${formatDate(bail.locataire.date_naissance)}${lieuN}`, y, 5);
    }
    if (bail.locataire.telephone) y = body("Tél : " + bail.locataire.telephone, y, 5);
    if (bail.locataire.email) y = body("E-mail : " + bail.locataire.email, y, 5);
    y += 5;

    // II. OBJET DU CONTRAT ────────────────────────────────────────────────────────
    y = chk(y);
    y = h1("II.  OBJET DU CONTRAT", y);
    y += 2;

    y = h2("1. Consistance du logement", y);
    y = body(`Type de logement : ${bail.logement.type_bien} — Non meublé (usage d'habitation principale)`, y, 5);
    y = body("Adresse : " + adresseLog, y, 5);
    if (bail.logement.etage) y = body("Situation dans l'immeuble : " + bail.logement.etage, y, 5);
    y = body(`Surface habitable (loi Boutin) : ${bail.logement.surface_m2} m²`, y, 5);
    if (bail.contrat.nombre_pieces) y = body("Nombre de pièces principales : " + bail.contrat.nombre_pieces, y, 5);
    if (bail.logement.annexes) y = body("Autres parties du logement : " + bail.logement.annexes, y, 5);
    if (bail.logement.equipements_logement) y = body("Éléments d'équipements du logement : " + bail.logement.equipements_logement, y, 5);
    y = body(`Mode de chauffage : ${bail.logement.mode_chauffage || "____"}`, y, 5);
    y = body(`Production d'eau chaude sanitaire : ${bail.logement.mode_eau_chaude ? (bail.logement.mode_eau_chaude === "Individuel" ? "Individuelle" : "Collective") : "____"}`, y, 5);
    if (bail.logement.numero_lot) y = body("Numéro de lot (copropriété) : " + bail.logement.numero_lot, y, 5);
    if (bail.logement.quote_part) y = body("Quote-part des parties communes : " + bail.logement.quote_part, y, 5);
    const dpeClasse = bail.logement.dpe_classe || "____";
    const dpeConso = bail.logement.dpe_conso ? `${bail.logement.dpe_conso} kWh/m2/an` : "____";
    const dpeGes = bail.logement.dpe_ges ? `${bail.logement.dpe_ges} kg CO2/m2/an` : "____";
    const dpeDate = bail.logement.dpe_date ? formatDate(bail.logement.dpe_date) : "____";
    y = body(`Classe de performance énergétique (DPE) : ${dpeClasse}  —  Consommation : ${dpeConso}  —  Émissions GES : ${dpeGes}`, y, 5);
    y = body(`Date du diagnostic : ${dpeDate}`, y, 5);
    y += 3;

    y = chk(y);
    y = h2("2. Destination des locaux", y);
    y = body(`B. Destination des locaux : ${bail.contrat.destination_locaux || "Habitation principale"}`, y, 5);
    y += 3;

    if (bail.logement.annexes) {
      y = chk(y);
      y = h2("3. Locaux et équipements accessoires privatifs", y);
      y = body(bail.logement.annexes, y, 5);
      y += 3;
    }
    y += 2;

    // III. DURÉE DU CONTRAT ───────────────────────────────────────────────────────
    y = chk(y);
    y = h1("III.  DURÉE DU CONTRAT", y);
    y += 2;

    const dateDebutV = bail.contrat.date_debut ? formatDate(bail.contrat.date_debut) : "________________";
    y = body(`Le présent contrat prend effet le ${dateDebutV}.`, y);
    y += 2;

    const dureeAnsV = Math.floor(dureeMois / 12);
    const dureeResteV = dureeMois % 12;
    let dureeStrV = "";
    if (dureeAnsV > 0) dureeStrV += `${dureeAnsV} an${dureeAnsV > 1 ? "s" : ""}`;
    if (dureeResteV > 0) dureeStrV += (dureeAnsV > 0 ? " et " : "") + `${dureeResteV} mois`;

    y = body(`Il est consenti pour une durée de ${dureeStrV} (${dureeMois} mois) conformément à l'article 10 de la loi n° 89-462 du 6 juillet 1989.`, y);
    y += 2;
    y = body("À l'expiration du contrat, celui-ci est reconduit tacitement pour une durée de trois (3) ans (bailleur personne physique) ou six (6) ans (bailleur personne morale), sauf congé délivré dans les conditions légales.", y);
    y += 5;

    // IV. CONDITIONS FINANCIÈRES ─────────────────────────────────────────────────
    y = chk(y);
    y = h1("IV.  CONDITIONS FINANCIÈRES", y);
    y += 2;

    y = h2("1.  Loyer mensuel", y);
    y = body(`Loyer mensuel : ${loyerHC.toFixed(2)} € (${loyerEnLettres} euros) hors charges.`, y, 5);
    y += 3;

    y = chk(y);
    y = h2("2.  Modalités de révision du loyer", y);
    if (bail.contrat.indexation_irl) {
      const trim = bail.contrat.trimestre_irl_reference ? `T${bail.contrat.trimestre_irl_reference}` : "____";
      const anneeIRL = bail.contrat.irl_annee || "____";
      const valeurIRL = bail.contrat.irl_valeur || "____";
      y = body("Le loyer est révisé annuellement à la date d'anniversaire du contrat par référence à la variation de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.", y, 5);
      y = body(`Indice de base retenu : ${trim} ${anneeIRL} — Valeur : ${valeurIRL}`, y, 5);
    } else {
      y = body("Aucune révision par indexation sur l'IRL n'est prévue au présent contrat.", y, 5);
    }
    y += 3;

    y = chk(y);
    y = h2("3.  Charges récupérables", y);
    y = body("Les charges récupérables sont réglées par provisions mensuelles, avec régularisation annuelle sur présentation des justificatifs, conformément au décret n° 87-713 du 26 août 1987.", y, 5);
    y = body(`Montant mensuel des provisions sur charges : ${charges.toFixed(2)} € (${chargesEnLettres} euros).`, y, 5);
    y += 3;

    y = chk(y);
    y = h2("4.  Modalités de paiement", y);
    const jourPV = bail.finances.date_paiement_prevue || "___";
    const modeV = bail.finances.mode_paiement || "Virement";
    y = body(`Le loyer et les provisions sur charges sont payables d'avance, le ${jourPV} de chaque mois, par ${modeV}.`, y, 5);
    y += 5;

    // V. TRAVAUX ─────────────────────────────────────────────────────────────────
    y = chk(y);
    y = h1("V.  TRAVAUX", y);
    y += 2;
    y = h2("1.  Travaux réalisés depuis la fin du dernier contrat de location :", y);
    y = body(bail.contrat.travaux_realises || "Néant.", y, 5);
    y += 3;
    y = chk(y);
    y = h2("2.  Travaux que le bailleur s'engage à réaliser :", y);
    y = body(bail.contrat.travaux_prevus || "Néant.", y, 5);
    y += 5;

    // VI. GARANTIES ──────────────────────────────────────────────────────────────
    y = chk(y);
    y = h1("VI.  GARANTIES", y);
    y += 2;
    y = h2("Dépôt de garantie :", y);
    y = body(`Le dépôt de garantie est fixé à ${depotGarantie.toFixed(2)} € (${dgEnLettres} euros), ne pouvant excéder un (1) mois de loyer hors charges (article 22 de la loi du 6 juillet 1989).`, y, 5);
    y = body("Il sera restitué dans un délai d'un (1) mois suivant la remise des clés si l'état des lieux de sortie est conforme à l'état des lieux d'entrée, et dans un délai de deux (2) mois dans le cas contraire, déduction faite des sommes dues.", y, 5);
    y += 5;

    // VII. CLAUSE DE SOLIDARITÉ ──────────────────────────────────────────────────
    y = chk(y);
    y = h1("VII.  CLAUSE DE SOLIDARITÉ", y);
    y += 2;
    y = body("En cas de pluralité de locataires, ceux-ci sont solidaires entre eux du paiement du loyer, des charges et de l'exécution des conditions du présent contrat, jusqu'à la date d'effet du congé régulièrement délivré par l'un d'eux et jusqu'à l'expiration du délai de préavis suivant ce congé.", y, 5);
    y += 5;

    // VIII. CLAUSE RÉSOLUTOIRE ───────────────────────────────────────────────────
    y = chk(y);
    y = h1("VIII.  CLAUSE RÉSOLUTOIRE", y);
    y += 2;
    y = body("Conformément à l'article 24 de la loi n° 89-462 du 6 juillet 1989, le présent contrat sera résilié de plein droit, après mise en demeure restée infructueuse pendant un délai de deux mois, en cas de :", y, 5);
    y += 2;
    const resol = [
      "— Non-paiement du loyer ou des charges aux termes convenus ;",
      "— Non-versement du dépôt de garantie ;",
      "— Non-souscription par le locataire d'une assurance couvrant les risques locatifs ;",
      "— Troubles de jouissance causés aux voisins ou aux autres occupants de l'immeuble constatés par une décision de justice passée en force de chose jugée."
    ];
    for (const r of resol) { y = body(r, y, 8); }
    const clausesResolV = bail.contrat.clauses_resolutoires ?? [];
    if (clausesResolV.length > 0) {
      y += 3;
      y = h2("Clauses résolutoires supplémentaires :", y);
      for (let ci = 0; ci < clausesResolV.length; ci++) {
        y = chk(y);
        y = body(`${ci + 1}. ${clausesResolV[ci]}`, y, 5);
        y += 2;
      }
    }
    y += 5;

    // IX. HONORAIRES ─────────────────────────────────────────────────────────────
    y = chk(y);
    y = h1("IX.  HONORAIRES DE LOCATION", y);
    y += 2;
    y = body("En cas d'intervention d'un mandataire pour la mise en location, les honoraires sont répartis comme suit (décret n° 2014-890 du 1er août 2014) :", y, 5);
    y += 2;
    y = body("Honoraires à la charge du bailleur : ____________ € TTC", y, 5);
    y = body("Honoraires à la charge du locataire : ____________ € TTC", y, 5);
    y = body("(Ne peut excéder le montant payé par le bailleur, dans la limite d'un plafond réglementaire par m²)", y, 5);
    y += 5;

    // X. CONDITIONS PARTICULIÈRES ────────────────────────────────────────────────
    y = chk(y);
    y = h1("X.  CONDITIONS PARTICULIÈRES", y);
    y += 2;
    y = body(bail.contrat.clauses_particulieres?.trim() || "Néant.", y, 5);
    y += 5;

    // SIGNATURES ─────────────────────────────────────────────────────────────────
    y = chk(y + 15);
    y = sep(y);
    y = h1("SIGNATURES", y);
    y += 4;

    const lieuSignV = `${parametres.lieu_signature || "________________"}, le ${bail.contrat.date_signature ? formatDate(bail.contrat.date_signature) : "________________"}`;
    doc.setFontSize(9);
    doc.setFont("arial", "normal");
    doc.text(lieuSignV, X, y);
    y += 10;

    doc.setFont("arial", "bold");
    doc.setFontSize(9);
    doc.text("Le Bailleur :", X, y);
    doc.setFont("arial", "normal");
    doc.text(nomProp, X, y + 5);
    if (parametres.signature_proprietaire) {
      try { doc.addImage(parametres.signature_proprietaire, "PNG", X, y + 8, 55, 24); } catch { /* skip */ }
    }
    doc.setLineWidth(0.3);
    doc.line(X, y + 36, X + 68, y + 36);
    doc.setFont("arial", "bold");
    doc.text("Le(s) Locataire(s) :", 115, y);
    doc.setFont("arial", "normal");
    doc.text(nomLoc, 115, y + 5);
    doc.setLineWidth(0.3);
    doc.line(115, y + 36, 185, y + 36);
    y += 44;

    // XI. ANNEXES ────────────────────────────────────────────────────────────────
    y = chk(y);
    y = sep(y);
    y = h1("XI.  ANNEXES AU CONTRAT", y);
    y += 3;
    doc.setFontSize(8.5);
    doc.setFont("arial", "italic");
    doc.text("Documents remis au locataire lors de la signature du présent contrat :", X, y);
    doc.setFont("arial", "normal");
    y += 5;
    const annexesV = bail.annexes_bail ?? [];
    for (const annexe of annexesV) {
      y = chk(y);
      const mark = annexe.remis ? "☑" : "☐";
      const lines = doc.splitTextToSize(`${mark}  ${annexe.nom}`, W - 4) as string[];
      doc.text(lines, X + 2, y);
      y += lines.length * 5;
    }

    // Numérotation
    const pgCountV = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pgCountV; i++) { doc.setPage(i); pageFooter(doc, i, pgCountV); }
    doc.save(`bail_vide_${bail.locataire.nom}_${bail.locataire.prenom}.pdf`);
    return;
  }

  // ── CHEMIN MEUBLÉ (Articles 1-6 — Arrêté 29 mai 2015 Annexe 2) ───────────────

  // ARTICLE 1 — DÉSIGNATION DES PARTIES ──────────────────────────────────────
  y = h1("ARTICLE 1 — DÉSIGNATION DES PARTIES", y);
  y += 2;

  y = h2("Le Bailleur :", y);
  y = body(civProp + " " + nomProp, y, 5);
  if (adresseProp) y = body("Adresse : " + adresseProp, y, 5);
  if (parametres.telephone) y = body("Tél : " + parametres.telephone, y, 5);
  if (parametres.email) y = body("E-mail : " + parametres.email, y, 5);
  y += 4;

  y = chk(y);
  y = h2("Le(s) Locataire(s) :", y);
  y = body(civLoc + " " + nomLoc, y, 5);
  if (bail.locataire.date_naissance) {
    const lieuN = bail.locataire.lieu_naissance ? ` à ${bail.locataire.lieu_naissance}` : "";
    y = body(`Né(e) le ${formatDate(bail.locataire.date_naissance)}${lieuN}`, y, 5);
  }
  if (bail.locataire.telephone) y = body("Tél : " + bail.locataire.telephone, y, 5);
  if (bail.locataire.email) y = body("E-mail : " + bail.locataire.email, y, 5);
  y += 5;

  // ARTICLE 2 — OBJET DU CONTRAT ─────────────────────────────────────────────
  y = chk(y);
  y = h1("ARTICLE 2 — OBJET DU CONTRAT", y);
  y += 2;

  y = h2("I. Désignation du logement", y);
  y = body(`Type : ${bail.logement.type_bien} — Meublé`, y, 5);
  y = body("Adresse : " + adresseLog, y, 5);
  if (bail.logement.etage) y = body("Situation dans l'immeuble : " + bail.logement.etage, y, 5);
  y = body(`Surface habitable : ${bail.logement.surface_m2} m² (au sens de l'article 46 de la loi du 6 juillet 1989)`, y, 5);
  if (bail.contrat.nombre_pieces) y = body("Nombre de pièces principales : " + bail.contrat.nombre_pieces, y, 5);
  y = body(`B. Destination des locaux : ${bail.contrat.destination_locaux || "Usage d'habitation principale"}`, y, 5);
  y += 2;
  if (bail.logement.annexes) y = body("Autres parties du logement : " + bail.logement.annexes, y, 5);
  if (bail.logement.equipements_logement) y = body("Éléments d'équipements du logement : " + bail.logement.equipements_logement, y, 5);
  y = body(`Mode de chauffage : ${bail.logement.mode_chauffage || "____"}`, y, 5);
  y = body(`Production d'eau chaude sanitaire : ${bail.logement.mode_eau_chaude ? (bail.logement.mode_eau_chaude === "Individuel" ? "Individuelle" : "Collective") : "____"}`, y, 5);
  if (bail.logement.numero_lot) y = body("Numéro de lot : " + bail.logement.numero_lot, y, 5);
  if (bail.logement.quote_part) y = body("Quote-part des parties communes : " + bail.logement.quote_part, y, 5);
  const dpeClasseM = bail.logement.dpe_classe || "____";
  const dpeConsoM = bail.logement.dpe_conso ? `${bail.logement.dpe_conso} kWh/m2/an` : "____";
  const dpeGesM = bail.logement.dpe_ges ? `${bail.logement.dpe_ges} kg CO2/m2/an` : "____";
  const dpeDateM = bail.logement.dpe_date ? formatDate(bail.logement.dpe_date) : "____";
  y = body(`Classe de performance énergétique (DPE) : ${dpeClasseM}  —  Consommation : ${dpeConsoM}  —  Émissions GES : ${dpeGesM}`, y, 5);
  y = body(`Date du diagnostic : ${dpeDateM}`, y, 5);
  y += 5;

  // ARTICLE 3 — DATE ET DURÉE ─────────────────────────────────────────────────
  y = chk(y);
  y = h1("ARTICLE 3 — DATE DE PRISE D'EFFET ET DURÉE DU CONTRAT", y);
  y += 2;

  const dateDebutM = bail.contrat.date_debut ? formatDate(bail.contrat.date_debut) : "________________";
  y = body(`Le présent contrat de location prend effet le ${dateDebutM}.`, y);
  y += 2;

  const dureeAnsM = Math.floor(dureeMois / 12);
  const dureeResteM = dureeMois % 12;
  let dureeStrM = "";
  if (dureeAnsM > 0) dureeStrM += `${dureeAnsM} an${dureeAnsM > 1 ? "s" : ""}`;
  if (dureeResteM > 0) dureeStrM += (dureeAnsM > 0 ? " et " : "") + `${dureeResteM} mois`;

  if (bail.contrat.type_bail === "Étudiant") {
    y = body("Il est consenti pour une durée de neuf (9) mois à titre de bail étudiant (article 25-7 de la loi du 6 juillet 1989). Ce contrat ne se renouvelle pas par tacite reconduction.", y);
  } else {
    y = body(`Il est consenti pour une durée de ${dureeStrM} (${dureeMois} mois) à compter de sa prise d'effet.`, y);
    y += 2;
    if (bail.contrat.reconduction_tacite) {
      y = body("À l'expiration de cette durée, le contrat se renouvellera par tacite reconduction pour une durée identique, sauf congé délivré dans les conditions légales.", y);
    }
  }
  y += 5;

  // ARTICLE 4 — CONDITIONS FINANCIÈRES ───────────────────────────────────────
  y = chk(y);
  y = h1("ARTICLE 4 — CONDITIONS FINANCIÈRES", y);
  y += 2;

  y = h2("4-1  Loyer", y);
  y = body(`Le loyer mensuel est fixé à ${loyerHC.toFixed(2)} € (${loyerEnLettres} euros) hors charges.`, y, 5);
  y += 4;

  y = chk(y);
  y = h2("4-2  Modalités de paiement", y);
  const jourPM = bail.finances.date_paiement_prevue || "___";
  const modeM = bail.finances.mode_paiement || "Virement";
  y = body(`Le loyer est payable mensuellement, d'avance, le ${jourPM} de chaque mois, par ${modeM}.`, y, 5);
  y += 4;

  y = chk(y);
  y = h2("4-3  Révision du loyer", y);
  if (bail.contrat.indexation_irl) {
    const trim = bail.contrat.trimestre_irl_reference ? `T${bail.contrat.trimestre_irl_reference}` : "____";
    const anneeIRL = bail.contrat.irl_annee || "____";
    const valeurIRL = bail.contrat.irl_valeur || "____";
    y = body("Le loyer est révisé chaque année à la date anniversaire du contrat en fonction de la variation de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.", y, 5);
    y = body(`Indice de référence : ${trim} ${anneeIRL} — Valeur : ${valeurIRL}`, y, 5);
  } else {
    y = body("Le loyer ne fait pas l'objet d'une révision par indexation sur l'IRL.", y, 5);
  }
  y += 4;

  y = chk(y);
  y = h2("4-4  Récupération des charges locatives", y);
  if (regimeCharges === "Forfait") {
    y = body(`Les charges récupérables sont payées sous forme de forfait mensuel d'un montant de ${charges.toFixed(2)} € (${chargesEnLettres} euros). Ce forfait est révisé annuellement dans les mêmes conditions que le loyer et ne peut donner lieu à régularisation.`, y, 5);
  } else {
    y = body(`Les charges récupérables sont payées sous forme de provision mensuelle d'un montant de ${charges.toFixed(2)} € (${chargesEnLettres} euros). Une régularisation des charges sera effectuée chaque année sur la base des dépenses réellement engagées, après présentation des justificatifs.`, y, 5);
  }
  y += 4;

  y = chk(y);
  y = h2("4-5  Dépôt de garantie", y);
  y = body(`Un dépôt de garantie d'un montant de ${depotGarantie.toFixed(2)} € (${dgEnLettres} euros), correspondant à deux (2) mois de loyer hors charges, est versé par le(s) locataire(s) à la signature du présent contrat.`, y, 5);
  y = body("Ce dépôt sera restitué dans un délai maximum de deux (2) mois suivant la restitution des clés, déduction faite des sommes dues au bailleur.", y, 5);
  y += 5;

  // ARTICLE 5 — TRAVAUX ───────────────────────────────────────────────────────
  y = chk(y);
  y = h1("ARTICLE 5 — TRAVAUX", y);
  y += 2;
  y = h2("5-1  Travaux réalisés depuis le dernier contrat de location :", y);
  y = body(bail.contrat.travaux_realises || "Néant.", y, 5);
  y += 4;
  y = chk(y);
  y = h2("5-2  Travaux que le bailleur s'engage à réaliser pendant la location :", y);
  y = body(bail.contrat.travaux_prevus || "Néant.", y, 5);
  y += 5;

  // ARTICLE 6 — CLAUSES PARTICULIÈRES ────────────────────────────────────────
  y = chk(y);
  y = h1("ARTICLE 6 — CLAUSES PARTICULIÈRES", y);
  y += 2;
  y = body(bail.contrat.clauses_particulieres?.trim() || "Néant.", y, 5);
  y += 5;

  // CLAUSES RÉGLEMENTAIRES ────────────────────────────────────────────────────
  y = chk(y);
  y = h1("CLAUSES RÉGLEMENTAIRES", y);
  y += 2;

  y = h2("Clause résolutoire (art. 24 loi du 6 juillet 1989) :", y);
  y = body("Le présent contrat sera résilié de plein droit, après commandement demeuré infructueux pendant un délai de deux mois, en cas de : non-paiement du loyer ou des charges aux termes convenus ; non-versement du dépôt de garantie ; non-souscription d'une assurance couvrant les risques locatifs ; troubles de jouissance constatés par une décision de justice passée en force de chose jugée.", y, 5);
  const clausesResolM = bail.contrat.clauses_resolutoires ?? [];
  if (clausesResolM.length > 0) {
    y += 3;
    y = h2("Clauses résolutoires supplémentaires :", y);
    for (let ci = 0; ci < clausesResolM.length; ci++) {
      y = chk(y);
      y = body(`${ci + 1}. ${clausesResolM[ci]}`, y, 5);
      y += 2;
    }
  }
  y += 4;

  y = chk(y);
  y = h2("Solidarité et indivisibilité :", y);
  y = body("En cas de pluralité de locataires, chacun d'eux est solidaire de l'autre pour le paiement du loyer et des charges et pour l'exécution de l'ensemble des obligations nées du présent contrat.", y, 5);
  y += 4;

  y = chk(y);
  y = h2("Obligation d'assurance (art. 7 loi du 6 juillet 1989) :", y);
  y = body("Le locataire est tenu de souscrire une assurance garantissant les risques dont il doit répondre en sa qualité de locataire (incendie, dégâts des eaux, responsabilité civile). Il doit en justifier lors de la remise des clés puis, à chaque renouvellement du contrat, sur simple demande du bailleur.", y, 5);
  y += 6;

  // SIGNATURES ───────────────────────────────────────────────────────────────
  y = chk(y + 15);
  y = sep(y);
  y = h1("SIGNATURES", y);
  y += 4;

  const lieuSignM = `${parametres.lieu_signature || "________________"}, le ${bail.contrat.date_signature ? formatDate(bail.contrat.date_signature) : "________________"}`;
  doc.setFontSize(9);
  doc.setFont("arial", "normal");
  doc.text(lieuSignM, X, y);
  y += 10;

  doc.setFont("arial", "bold");
  doc.setFontSize(9);
  doc.text("Le Bailleur :", X, y);
  doc.setFont("arial", "normal");
  doc.text(nomProp, X, y + 5);
  if (parametres.signature_proprietaire) {
    try { doc.addImage(parametres.signature_proprietaire, "PNG", X, y + 8, 55, 24); } catch { /* skip */ }
  }
  doc.setLineWidth(0.3);
  doc.line(X, y + 36, X + 68, y + 36);

  doc.setFont("arial", "bold");
  doc.text("Le(s) Locataire(s) :", 115, y);
  doc.setFont("arial", "normal");
  doc.text(nomLoc, 115, y + 5);
  doc.setLineWidth(0.3);
  doc.line(115, y + 36, 185, y + 36);
  y += 44;

  // ANNEXES ─────────────────────────────────────────────────────────────────
  y = chk(y);
  y = sep(y);
  y = h1("LISTE DES ANNEXES REMISES AU LOCATAIRE", y);
  y += 3;
  doc.setFontSize(8.5);
  doc.setFont("arial", "italic");
  doc.text("Documents remis au locataire lors de la signature du présent contrat :", X, y);
  doc.setFont("arial", "normal");
  y += 5;
  const annexesBail = bail.annexes_bail ?? [];
  for (const annexe of annexesBail) {
    y = chk(y);
    const mark = annexe.remis ? "☑" : "☐";
    const lines = doc.splitTextToSize(`${mark}  ${annexe.nom}`, W - 4) as string[];
    doc.text(lines, X + 2, y);
    y += lines.length * 5;
  }

  // Numérotation des pages
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    pageFooter(doc, i, pageCount);
  }

  doc.save(`bail_meuble_${bail.locataire.nom}_${bail.locataire.prenom}.pdf`);
}

// ── Acte de cautionnement solidaire ───────────────────────────────────────────

function dots(n = 40): string { return "·".repeat(n); }

export function generateCautionnementPDF(
  caution: ActeCautionnement,
  bail: Bail,
  parametres: Parametres,
): void {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const W = 170;
  const X = 20;
  const LH = 5.5;

  const _bi659 = getBailleurIdentite(parametres);
  const nomProp = _bi659.nom;
  const adresseProp = `${_bi659.adresse || parametres.adresse}, ${parametres.code_postal} ${parametres.ville}${parametres.pays ? ` — ${parametres.pays}` : ""}`;
  const nomLoc = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  const adresseLog = `${bail.logement.adresse}, ${bail.logement.ville} ${bail.logement.code_postal}, France`;
  const loyerHC = bail.finances?.loyer_hc ?? 0;
  const charges = bail.finances?.charges ?? 0;
  const loyerTotal = bail.finances?.loyer_total ?? loyerHC + charges;
  const plafond = caution.plafond_garantie > 0 ? caution.plafond_garantie : 10000;
  const plafondStr = plafond.toFixed(2).replace(".", ",");
  const numLot = bail.logement.numero_lot || dots(10);

  function section(titre: string, yy: number): number {
    doc.setFontSize(10);
    doc.setFont("arial", "bold");
    doc.text(titre, X, yy);
    doc.setLineWidth(0.3);
    doc.line(X, yy + 1.5, X + W, yy + 1.5);
    return yy + 7;
  }

  function champ(label: string, valeur: string, yy: number, indent = 0): number {
    doc.setFontSize(10);
    doc.setFont("arial", "bold");
    const labelW = doc.getTextWidth(`${label} : `);
    doc.text(`${label} : `, X + indent, yy);
    doc.setFont("arial", "normal");
    const rest = W - indent - labelW;
    const vLines = doc.splitTextToSize(valeur, rest);
    doc.text(vLines, X + indent + labelW, yy);
    return yy + Math.max(vLines.length * LH, LH) + 1;
  }

  // ── Titre ──
  doc.setFontSize(15);
  doc.setFont("arial", "bold");
  doc.text("Acte de Cautionnement Solidaire", 105, 18, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(X, 21, 190, 21);

  let y = 28;

  // ── Désignations des parties ──
  y = section("Désignations des parties", y);
  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text("Entre les soussignés :", X, y);
  y += 7;

  y = champ("Nom et prénom du garant", dots(42), y);
  y = champ("Adresse complète du garant", dots(55), y);
  y = champ("Date et lieu de naissance du garant", dots(45), y);
  y = champ("Profession", dots(55), y);
  y = champ("Adresse e-mail", caution.garant_email || dots(40), y);
  y = champ("Téléphone", caution.garant_telephone || dots(30), y);
  y += 2;

  doc.setFont("arial", "italic");
  doc.text('Ci-après dénommé "le garant"', X + 5, y);
  y += 7;

  doc.setFont("arial", "normal");
  doc.text("Et", X, y);
  y += 6;

  y = champ("Nom et prénom du locataire", nomLoc, y);
  y = champ("Adresse complète de l'appartement loué", adresseLog, y);
  y += 2;

  doc.setFont("arial", "italic");
  doc.text('Ci-après dénommé "le locataire"', X + 5, y);
  y += 7;

  doc.setFont("arial", "bold");
  doc.text("Bailleur :", X, y);
  y += 6;
  y = champ("Nom et prénom du bailleur", nomProp, y);
  y = champ("Adresse complète du bailleur", adresseProp, y);
  y += 4;

  // ── Référence du contrat ──
  y = checkPage(doc, y);
  y = section("Référence du contrat de la location", y);
  doc.setFont("arial", "normal");
  const refText = `Bail signé le ${formatDate(bail.contrat?.date_debut)} pour l'appartement situé au ${bail.logement.adresse} à ${bail.logement.ville}, ${bail.logement.code_postal}${numLot && numLot !== dots(10) ? `. Lot Copropriété : n° ${numLot}` : ""}.`;
  const refLines = doc.splitTextToSize(refText, W);
  doc.text(refLines, X, y);
  y += refLines.length * LH + 6;

  // ── Objet du cautionnement ──
  y = checkPage(doc, y);
  y = section("Objet du cautionnement", y);
  doc.setFont("arial", "normal");

  const obj1 = "Le présent acte de cautionnement a pour objet de garantir le paiement des loyers, charges et accessoires dus par le locataire au titre du contrat de location précité.";
  let ls = doc.splitTextToSize(obj1, W);
  doc.text(ls, X, y); y += ls.length * LH + 4;

  const obj2 = "Le garant s'engage, en vertu du présent acte, à payer au bailleur, sur simple demande, toutes les sommes dues par le locataire en cas de défaillance de ce dernier, sans pouvoir exiger que le bailleur poursuive d'abord le locataire.";
  ls = doc.splitTextToSize(obj2, W);
  doc.text(ls, X, y); y += ls.length * LH + 6;

  // ── Montant garanti ──
  y = checkPage(doc, y);
  y = section("Montant garanti", y);
  doc.setFont("arial", "normal");

  const mont1 = `Le garant s'engage à garantir le paiement du loyer fixé à ${loyerHC.toFixed(2).replace(".", ",")} € par mois, ainsi que les charges s'élevant à ${charges.toFixed(2).replace(".", ",")} € par mois, soit un total de ${loyerTotal.toFixed(2).replace(".", ",")} € par mois. Ce montant pourra être révisé dans les conditions prévues au contrat de location.`;
  ls = doc.splitTextToSize(mont1, W);
  doc.text(ls, X, y); y += ls.length * LH + 4;

  const mont2 = `Le cautionnement est également applicable aux éventuels frais de réparation, d'entretien et aux dommages locatifs, ainsi qu'aux intérêts de retard, dans la limite de ${plafondStr} €.`;
  ls = doc.splitTextToSize(mont2, W);
  doc.text(ls, X, y); y += ls.length * LH + 6;

  // ── Durée ──
  y = checkPage(doc, y);
  y = section("Durée de l'engagement", y);
  doc.setFont("arial", "normal");

  const dur1 = "Le présent cautionnement est consenti pour toute la durée du bail initial, ainsi que pour ses renouvellements et ses reconductions éventuelles.";
  ls = doc.splitTextToSize(dur1, W);
  doc.text(ls, X, y); y += ls.length * LH + 4;

  const dur2 = "Le garant pourra se libérer de son engagement à l'issue de la durée du bail ou de ses renouvellements en envoyant une lettre recommandée avec accusé de réception, sous réserve d'un préavis de SIX MOIS. Toutefois, le garant reste engagé pour toutes les sommes dues par le locataire à la date de la résiliation.";
  ls = doc.splitTextToSize(dur2, W);
  doc.text(ls, X, y); y += ls.length * LH + 6;

  // ── Renonciation ──
  y = checkPage(doc, y);
  y = section("Renonciation au bénéfice de discussion et de division", y);
  doc.setFont("arial", "normal");

  const ren = "Le garant renonce expressément au bénéfice de discussion et de division, conformément à l'article 2298 du Code civil, ce qui signifie qu'il s'engage à payer les sommes dues sans que le bailleur soit dans l'obligation de poursuivre d'abord le locataire.";
  ls = doc.splitTextToSize(ren, W);
  doc.text(ls, X, y); y += ls.length * LH + 6;

  // ── Signature du garant ──
  y = checkPage(doc, y, 180);
  y = section("Signature du garant", y);
  doc.setFont("arial", "normal");

  const sig1 = `Je soussigné(e), ${dots(35)} , après avoir pris connaissance du contrat de location et des obligations qui en découlent pour le locataire, déclare accepter de me porter caution solidaire pour ce dernier.`;
  ls = doc.splitTextToSize(sig1, W);
  doc.text(ls, X, y); y += ls.length * LH + 5;

  const lieuActe = caution.lieu || parametres.lieu_signature || dots(20);
  doc.text(`Fait à ${lieuActe} , le ${caution.date ? formatDate(caution.date) : "….…/………/……..……"} .`, X, y);
  y += 8;

  // Mention manuscrite
  doc.setFont("arial", "bold");
  doc.text("Signature précédée de la mention manuscrite :", X, y);
  y += 6;
  doc.setFont("arial", "italic");
  doc.setFontSize(9.5);
  const mentionTexte = `"Je me porte caution solidaire pour le locataire ${nomLoc}, au profit du bailleur ${nomProp}, pour le paiement des loyers et charges liés à la location de l'appartement situé ${bail.logement.adresse} à ${bail.logement.ville}, en renonçant au bénéfice de discussion et de division, conformément aux dispositions de l'article 2298 du Code civil."`;
  doc.setFillColor(248, 248, 240);
  const mentionLines = doc.splitTextToSize(mentionTexte, W - 4);
  doc.rect(X, y - 3, W, mentionLines.length * 5 + 4, "F");
  doc.setLineWidth(0.2);
  doc.rect(X, y - 3, W, mentionLines.length * 5 + 4);
  doc.text(mentionLines, X + 2, y);
  y += mentionLines.length * 5 + 6;

  doc.setFont("arial", "bold");
  doc.setFontSize(10);
  doc.text("Signature du garant :", X, y);
  y += 6;
  // Grande zone vide pour la signature
  doc.setLineWidth(0.1);
  doc.rect(X, y, W, 42);
  y += 48;

  // ── Annexes ──
  y = checkPage(doc, y, 230);
  y = section("Annexes", y);
  doc.setFont("arial", "bold");
  doc.text("Documents justificatifs :", X, y);
  y += 6;
  doc.setFont("arial", "normal");
  const annexes = [
    "Pièce d'identité (1)",
    "Justificatif de domicile (1)",
    "Dernières fiches de paie (3)",
    "Dernier Avis d'impôt sur le revenu (1)",
    "Contrat de travail (1)",
  ];
  for (const ann of annexes) {
    doc.text(`• ${ann}`, X + 4, y);
    y += LH;
  }

  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    pageFooter(doc, i, pageCount);
  }

  doc.save(`cautionnement_${bail.locataire.nom}_${caution.date || "brouillon"}.pdf`);
}

// ── Attestation de dépôt de garantie ──────────────────────────────────────────

export function generateAttestationDGPDF(
  att: AttestationDepotGarantie,
  bail: Bail,
  parametres: Parametres,
): void {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const W = 170;
  const X = 20;
  const LH = 5.5;

  const nomProp = getBailleurIdentite(parametres).nom;
  const nomLoc = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  const civilite = att.civilite_locataire ?? "Madame";
  const montantLettres = nombreEnLettres(Math.round(att.montant));

  // En-tête propriétaire (gauche)
  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text(nomProp, X, 20);
  doc.text(parametres.adresse, X, 26);
  doc.text(`${parametres.code_postal} ${parametres.ville}`, X, 32);
  if (parametres.telephone) doc.text(parametres.telephone, X, 38);

  // Locataire (droite)
  doc.text(nomLoc, 190, 20, { align: "right" });
  doc.text(bail.logement.adresse, 190, 26, { align: "right" });
  doc.text(`${bail.logement.code_postal} ${bail.logement.ville}`, 190, 32, { align: "right" });

  let y = 52;

  // Lieu et date (aligné à droite, style lettre)
  doc.text(
    `${parametres.lieu_signature ?? ""}, le ${formatDate(att.date_versement)}`,
    190, y, { align: "right" },
  );
  y += 14;

  // Objet (gras, sans trait)
  doc.setFont("arial", "bold");
  doc.text("Objet : Attestation de réception du dépôt de garantie", X, y);
  y += 10;

  // Appel
  doc.setFont("arial", "normal");
  doc.text(`${civilite} ${bail.locataire.nom.toUpperCase()},`, X, y);
  y += 9;

  // Corps — paragraphe 1
  const p1 = `Je soussigné(e), ${nomProp}, propriétaire du logement situé au ${bail.logement.adresse}, atteste avoir reçu le ${formatDate(att.date_versement)}, de votre part, un dépôt de garantie d'un montant de ${montantLettres} euros conformément aux termes du bail signé en date du ${formatDate(att.date_bail)}.`;
  const lines1 = doc.splitTextToSize(p1, W);
  doc.text(lines1, X, y, { align: "justify", maxWidth: W });
  y += lines1.length * LH + 5;

  // Paragraphe 2
  const p2 = "Ce montant sera restitué selon les conditions stipulées dans le contrat de location et dans le respect des dispositions légales en vigueur.";
  const lines2 = doc.splitTextToSize(p2, W);
  doc.text(lines2, X, y, { align: "justify", maxWidth: W });
  y += lines2.length * LH + 5;

  // Paragraphe 3
  doc.text("Je reste à votre disposition pour toute question à ce sujet.", X, y);
  y += LH + 9;

  // Formule de politesse
  const politesse = `Veuillez agréer, ${civilite}, l'expression de mes salutations distinguées.`;
  doc.text(politesse, X, y);
  y += LH + 14;

  // Signature
  doc.setFont("arial", "bold");
  doc.text(nomProp, 140, y);
  doc.setFont("arial", "normal");
  if (parametres.signature_proprietaire) {
    try {
      doc.addImage(parametres.signature_proprietaire, "PNG", 120, y + 4, 65, 35);
    } catch { /* signature invalide */ }
  }

  doc.save(`attestation_depot_garantie_${bail.locataire.nom}.pdf`);
}

// ── État des lieux ─────────────────────────────────────────────────────────────

export async function generateEdlPDF(
  edl: EtatDesLieux,
  bail: Bail,
  parametres: Parametres,
  getFileFn?: (key: string) => Promise<string | null>,
): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const W = 170;
  const X = 20;
  const LH = 5;

  // Orange terracotta — doux et professionnel
  const OR: [number, number, number] = [220, 145, 75];
  const OR_LIGHT: [number, number, number] = [255, 249, 238];

  const nomProp = getBailleurIdentite(parametres).nom;
  const nomLoc = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  const adresseLog = `${bail.logement.adresse}, ${bail.logement.code_postal} ${bail.logement.ville}`;
  const typeLabel = edl.type === "Entrant" ? "ENTRANT" : "SORTANT";
  const pageTitle = `CONSTAT D'ÉTAT DES LIEUX ${typeLabel}`;

  // Bandeau orange répété sur chaque page
  function drawHeader(): void {
    doc.setFillColor(...OR);
    doc.rect(0, 0, 210, 16, "F");
    doc.setFont("arial", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(pageTitle, 105, 11, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }

  function addNewPage(): number {
    doc.addPage();
    drawHeader();
    return 26;
  }

  function chkPage(y: number, threshold = 262): number {
    return y > threshold ? addNewPage() : y;
  }

  function orangeBox(y: number, h: number, titre: string): void {
    doc.setFillColor(...OR_LIGHT);
    doc.setDrawColor(...OR);
    doc.setLineWidth(0.5);
    doc.rect(X, y, W, h, "FD");
    doc.setFillColor(...OR);
    doc.rect(X, y, W, 7, "F");
    doc.setFont("arial", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titre, X + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
  }

  // ── PAGE 1 ───────────────────────────────────────────────────────────────────
  drawHeader();
  let y = 24;

  // Date + heure sous le bandeau (droite)
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`${formatDate(edl.date)}${edl.heure ? " à " + edl.heure : ""}`, 190, 21, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // ── Encadré : Informations sur le bien ───────────────────────────────────────
  const details: string[] = [];
  if (bail.logement.etage) details.push(`Étage : ${bail.logement.etage}`);
  if (bail.logement.numero_lot) details.push(`Lot n° ${bail.logement.numero_lot}`);
  if (bail.logement.quote_part) details.push(`Quote-part : ${bail.logement.quote_part}`);
  const bienBoxH = 7 + 6 + 6 + (details.length > 0 ? 5 : 0) + 4;
  orangeBox(y, bienBoxH, "INFORMATIONS SUR LE BIEN");

  let by = y + 11;
  doc.setFontSize(9);

  // Ligne 1 : Type | Surface | Meublé
  doc.setFont("arial", "bold"); doc.text("Type :", X + 3, by);
  doc.setFont("arial", "normal"); doc.text(bail.logement.type_bien, X + 16, by);
  doc.setFont("arial", "bold"); doc.text("Surface :", X + 57, by);
  doc.setFont("arial", "normal"); doc.text(`${bail.logement.surface_m2} m²`, X + 75, by);
  doc.setFont("arial", "bold"); doc.text("Meublé :", X + 115, by);
  doc.setFont("arial", "normal"); doc.text(bail.logement.meuble === "Meublé" ? "Oui" : "Non", X + 132, by);
  by += 6;

  // Ligne 2 : Adresse
  doc.setFont("arial", "bold"); doc.text("Adresse :", X + 3, by);
  doc.setFont("arial", "normal");
  const addrLines = doc.splitTextToSize(adresseLog, 135);
  doc.text(addrLines, X + 22, by);
  by += addrLines.length * 5;

  // Ligne 3 : détails optionnels
  if (details.length > 0) {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(details.join("   ·   "), X + 3, by);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
  }

  y += bienBoxH + 5;

  // ── Parties : Bailleur | Locataire côte à côte ───────────────────────────────
  const colW = 80;
  const col2X = X + colW + 10;
  const partiesYStart = y;

  // Calcul hauteurs encadrés bailleur / locataire
  doc.setFontSize(8.5);
  const propAddr = parametres.adresse ? `${parametres.adresse}, ${parametres.code_postal} ${parametres.ville}` : null;
  const propAddrLines = propAddr ? doc.splitTextToSize(propAddr, colW - 4) : [];
  const bailleurH = 7 + 4 + // header + gap
    5 + // nom
    (propAddr ? propAddrLines.length * 4.5 : 0) +
    (parametres.telephone ? 4.5 : 0) +
    (parametres.email ? 4.5 : 0) + 4; // bottom padding

  const locNaiss = bail.locataire.date_naissance;
  const locataireH = 7 + 4 + // header + gap
    5 + // nom
    (locNaiss ? 4.5 : 0) +
    (bail.locataire.telephone ? 4.5 : 0) +
    (bail.locataire.email ? 4.5 : 0) + 4;

  const partiesH = Math.max(bailleurH, locataireH);

  // Bailleur (colonne gauche) — encadré complet
  doc.setFillColor(...OR_LIGHT);
  doc.setDrawColor(...OR);
  doc.setLineWidth(0.5);
  doc.rect(X, y, colW, partiesH, "FD");
  doc.setFillColor(...OR);
  doc.rect(X, y, colW, 7, "F");
  doc.setFont("arial", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("BAILLEUR", X + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  let propY = y + 11;
  doc.setFontSize(9);
  doc.setFont("arial", "bold");
  doc.text(nomProp, X + 2, propY); propY += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  if (propAddr) { doc.text(propAddrLines, X + 2, propY); propY += propAddrLines.length * 4.5; }
  if (parametres.telephone) { doc.text(parametres.telephone, X + 2, propY); propY += 4.5; }
  if (parametres.email) {
    doc.setFontSize(7.5);
    doc.text(parametres.email, X + 2, propY);
    doc.setFontSize(8.5);
  }

  // Locataire (colonne droite) — encadré complet
  const locLabelType = edl.type === "Entrant" ? "LOCATAIRE ENTRANT" : "LOCATAIRE SORTANT";
  doc.setFillColor(...OR_LIGHT);
  doc.setDrawColor(...OR);
  doc.setLineWidth(0.5);
  doc.rect(col2X, y, colW, partiesH, "FD");
  doc.setFillColor(...OR);
  doc.rect(col2X, y, colW, 7, "F");
  doc.setFont("arial", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(locLabelType, col2X + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  let locY2 = y + 11;
  doc.setFontSize(9);
  doc.setFont("arial", "bold");
  doc.text(nomLoc, col2X + 2, locY2); locY2 += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  if (locNaiss) { doc.text(`Né(e) le : ${formatDate(locNaiss)}`, col2X + 2, locY2); locY2 += 4.5; }
  if (bail.locataire.telephone) { doc.text(bail.locataire.telephone, col2X + 2, locY2); locY2 += 4.5; }
  if (bail.locataire.email) {
    doc.setFontSize(7.5);
    doc.text(bail.locataire.email, col2X + 2, locY2);
    doc.setFontSize(8.5);
  }

  y += partiesH + 6;

  // ── Encadré Documents et annexes ─────────────────────────────────────────────
  const annexesTxt = edl.annexes_documents ?? "";
  if (annexesTxt.trim()) {
    doc.setFontSize(9);
    const annexLines = doc.splitTextToSize(annexesTxt, W - 6);
    const annexBoxH = 7 + annexLines.length * 5 + 5;
    orangeBox(y, annexBoxH, "DOCUMENTS ET ANNEXES");
    doc.setFont("arial", "normal");
    doc.setFontSize(9);
    doc.text(annexLines, X + 3, y + 12);
    y += annexBoxH + 5;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(X, y, 190, y);
  y += 6;

  // ── Clés remises ─────────────────────────────────────────────────────────────
  const cles = edl.cles ?? [];
  if (cles.length > 0) {
    y = chkPage(y);
    doc.setFont("arial", "bold");
    doc.setFontSize(9);
    doc.text("Clés remises :", X, y);
    y += 5;
    doc.setFillColor(245, 235, 220);
    doc.rect(X, y - 3, 100, 6, "F");
    doc.setFontSize(8);
    doc.text("Type de clé / accès", X + 2, y);
    doc.text("Quantité", X + 72, y);
    doc.setLineWidth(0.2);
    doc.setDrawColor(...OR);
    doc.rect(X, y - 3, 100, 6);
    doc.line(X + 68, y - 3, X + 68, y + 3);
    doc.setDrawColor(0, 0, 0);
    y += 6;
    doc.setFont("arial", "normal");
    for (const cle of cles) {
      doc.rect(X, y - 3, 100, 5);
      doc.line(X + 68, y - 3, X + 68, y + 2);
      doc.text(cle.type || "—", X + 2, y);
      doc.text(cle.quantite || "0", X + 72, y);
      y += 5;
    }
    if (edl.cles_remises) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont("arial", "italic");
      const obsLines = doc.splitTextToSize(edl.cles_remises, 170);
      doc.text(obsLines, X, y);
      y += obsLines.length * 4 + 2;
    }
    doc.setFontSize(10);
    y += 3;
  } else if (edl.cles_remises) {
    doc.setFont("arial", "bold");
    doc.setFontSize(9);
    doc.text("Clés remises :", X, y);
    doc.setFont("arial", "normal");
    doc.text(edl.cles_remises, X + 32, y);
    y += 6;
  }

  // ── Codes d'accès ─────────────────────────────────────────────────────────────
  const codes = edl.codes_acces ?? [];
  if (codes.filter(c => c.label || c.code).length > 0) {
    y = chkPage(y);
    doc.setFont("arial", "bold");
    doc.setFontSize(9);
    doc.text("Codes d'accès :", X, y);
    y += 5;
    doc.setFont("arial", "normal");
    doc.setFontSize(8.5);
    for (const ca of codes) {
      if (!ca.label && !ca.code) continue;
      doc.text(`• ${ca.label || "—"} : ${ca.code || "—"}`, X + 2, y);
      y += 5;
    }
    y += 2;
  }

  doc.setLineWidth(0.3);
  doc.line(X, y, 190, y);
  y += 6;

  // ── Relevés de compteurs ──────────────────────────────────────────────────────
  const relevesPresents = edl.releves_compteurs.filter(r => r.valeur || r.numero);
  if (relevesPresents.length > 0) {
    y = chkPage(y);
    doc.setFont("arial", "bold");
    doc.setFontSize(10);
    doc.setFillColor(...OR);
    doc.rect(X, y - 4, W, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("RELEVÉS DES COMPTEURS", X + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.setFillColor(245, 235, 220);
    doc.rect(X, y - 4, W, 7, "F");
    doc.setFont("arial", "bold");
    doc.text("Type", X + 2, y);
    doc.text("N° compteur", X + 50, y);
    doc.text("Index", X + 110, y);
    doc.text("Unité", X + 145, y);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...OR);
    doc.rect(X, y - 4, W, 7);
    doc.setDrawColor(0, 0, 0);
    y += 7;

    doc.setFont("arial", "normal");
    for (const releve of relevesPresents) {
      y = chkPage(y);
      doc.text(releve.type, X + 2, y);
      doc.text(releve.numero || "—", X + 50, y);
      doc.text(releve.valeur || "—", X + 110, y);
      doc.text(releve.unite || "", X + 145, y);
      doc.setLineWidth(0.1);
      doc.line(X, y + 2, 190, y + 2);
      y += 7;
    }

    if (getFileFn) {
      for (const releve of relevesPresents) {
        if (releve.photo) {
          const imgData = await getFileFn(releve.photo).catch(() => null);
          if (imgData) {
            y = chkPage(y, 180);
            doc.setFontSize(8);
            doc.setFont("arial", "italic");
            doc.text(`Photo compteur : ${releve.type}`, X, y);
            y += 3;
            try { doc.addImage(imgData, "JPEG", X, y, 60, 40); }
            catch { try { doc.addImage(imgData, "PNG", X, y, 60, 40); } catch { /* skip */ } }
            y += 44;
          }
        }
      }
    }

    doc.setLineWidth(0.3);
    doc.line(X, y, 190, y);
    y += 6;
  }

  // ── Pièces ───────────────────────────────────────────────────────────────────
  const piecesPresentes = edl.pieces.filter(p => p.present);

  for (const piece of piecesPresentes) {
    y = chkPage(y, 250);

    doc.setFontSize(11);
    doc.setFont("arial", "bold");
    doc.setFillColor(...OR);
    doc.rect(X, y - 4, W, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(piece.nom.toUpperCase(), X + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...OR);
    doc.rect(X, y - 4, W, 8);
    doc.setDrawColor(0, 0, 0);
    y += 8;

    const allItems = piece.categories.flatMap(c => c.items);
    const itemsRemplis = allItems.filter(i => i.etat || i.quantite);
    if (itemsRemplis.length > 0) {
      // En-tête tableau : Élément | Qté | Caractéristiques | État | Observations & Commentaire
      doc.setFontSize(8.5);
      doc.setFont("arial", "bold");
      doc.setFillColor(245, 235, 220);
      doc.rect(X, y - 3, W, 6, "F");
      doc.setLineWidth(0.1);
      doc.rect(X, y - 3, W, 6);
      doc.text("Élément", X + 2, y);
      doc.text("Qté", X + 62, y);
      doc.text("Caractéristiques", X + 76, y);
      doc.text("État", X + 112, y);
      doc.text("Observations", X + 143, y);
      y += 6;

      doc.setFont("arial", "normal");
      doc.setFontSize(8.5);
      for (const el of itemsRemplis) {
        const caractStr = (el.caracteristiques ?? []).join(", ");
        const obsStr = [...(el.observations ?? []), ...(el.commentaire ? [el.commentaire] : [])].join(", ");
        const nomLines = doc.splitTextToSize(el.nom, 56) as string[];
        const natLines = doc.splitTextToSize(caractStr, 32) as string[];
        const cmtLines = doc.splitTextToSize(obsStr, 25) as string[];
        const maxLines = Math.max(nomLines.length, natLines.length, cmtLines.length, 1);
        const rowH = maxLines * 4.5;
        y = chkPage(y, rowH + 4);
        doc.text(nomLines, X + 2, y);
        if (el.quantite) doc.text(el.quantite, X + 62, y);
        if (caractStr) doc.text(natLines, X + 76, y);
        if (el.etat) doc.text(el.etat, X + 112, y);
        if (obsStr) doc.text(cmtLines, X + 143, y);
        doc.setLineWidth(0.05);
        doc.line(X, y + rowH - 3, X + W, y + rowH - 3);
        y += rowH;
      }
    } else {
      doc.setFontSize(8);
      doc.setFont("arial", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text("(Éléments non renseignés)", X + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    // Photos de la pièce + photos par élément
    if (getFileFn) {
      const piecePhotoKeys = piece.photos ?? [];
      const itemPhotoEntries: { label: string; key: string }[] = allItems
        .flatMap(i => (i.photos ?? []).map(k => ({ label: i.nom, key: k })));

      const allPhotoKeys = [
        ...piecePhotoKeys.map(k => ({ label: piece.nom, key: k })),
        ...itemPhotoEntries,
      ];

      if (allPhotoKeys.length > 0) {
        const loadedPhotos: { label: string; img: string }[] = [];
        for (const { label, key } of allPhotoKeys) {
          const imgData = await getFileFn(key).catch(() => null);
          if (imgData) loadedPhotos.push({ label, img: imgData });
        }
        if (loadedPhotos.length > 0) {
          y = chkPage(y, 55);
          doc.setFontSize(8);
          doc.setFont("arial", "italic");
          doc.text(`Photos — ${piece.nom}`, X, y);
          y += 3;
          let photoX = X;
          for (const { label, img } of loadedPhotos) {
            if (photoX + 50 > X + W) { photoX = X; y += 43; }
            y = chkPage(y, 50);
            try { doc.addImage(img, "JPEG", photoX, y, 44, 36); }
            catch { try { doc.addImage(img, "PNG", photoX, y, 44, 36); } catch { /* skip */ } }
            doc.setFontSize(6);
            doc.setFont("arial", "normal");
            const lblLines = doc.splitTextToSize(label, 44) as string[];
            doc.text(lblLines, photoX, y + 37);
            doc.setFontSize(8.5);
            photoX += 46;
          }
          y += 40;
        }
      }
    }
    y += 4;
  }

  // ── Commentaire général ───────────────────────────────────────────────────────
  if (edl.commentaire_general) {
    y = chkPage(y);
    doc.setFont("arial", "bold");
    doc.setFontSize(10);
    doc.setFillColor(...OR);
    doc.rect(X, y - 4, W, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("OBSERVATIONS GÉNÉRALES", X + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
    doc.setFont("arial", "normal");
    doc.setFontSize(9);
    y = addText(doc, edl.commentaire_general, X, y, W, LH);
    y += 5;
  }

  // ── Signatures ───────────────────────────────────────────────────────────────
  y = chkPage(y, 220);
  doc.setFont("arial", "bold");
  doc.setFontSize(10);
  doc.setFillColor(...OR);
  doc.rect(X, y - 4, W, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("SIGNATURES", X + 3, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text(`${parametres.lieu_signature ?? ""}, le ${formatDate(edl.date)}`, X, y);
  y += 10;

  doc.setFont("arial", "bold");
  doc.text("Le Bailleur :", X, y);
  doc.setFont("arial", "normal");
  doc.text(nomProp, X, y + 6);
  if (edl.signe_proprietaire_at) {
    doc.setFontSize(8);
    doc.setFont("arial", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text(`Signé le ${formatDate(edl.signe_proprietaire_at)}`, X, y + 13);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  }
  if (edl.signature_proprietaire) {
    try { doc.addImage(edl.signature_proprietaire, "PNG", X, y + 16, 60, 30); }
    catch { /* signature invalide */ }
  }

  doc.setFont("arial", "bold");
  doc.text("Le Locataire :", 120, y);
  doc.setFont("arial", "normal");
  doc.text(nomLoc, 120, y + 6);
  if (edl.signe_locataire_at) {
    doc.setFontSize(8);
    doc.setFont("arial", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text(`Signé le ${formatDate(edl.signe_locataire_at)}`, 120, y + 13);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  }
  if (edl.signature_locataire) {
    try { doc.addImage(edl.signature_locataire, "PNG", 120, y + 16, 60, 30); }
    catch { /* signature invalide */ }
  }


    // ── Page(s) légales ──────────────────────────────────────────────────────────
  doc.addPage();
  let ly = 20;
  const LX = 15;
  const LW = 180;

  // Titre légende
  doc.setFontSize(11);
  doc.setFont("arial", "bold");
  doc.setFillColor(230, 235, 248);
  doc.rect(LX, ly - 4, LW, 8, "F");
  doc.text("LÉGENDE ÉTAT GÉNÉRAL", 105, ly, { align: "center" });
  doc.setLineWidth(0.3);
  doc.rect(LX, ly - 4, LW, 8);
  ly += 10;

  const legende: [string, string][] = [
    ["NEUF", "État neuf, parfait, jamais habité ou entièrement refait."],
    ["BON ÉTAT", "État général très rapprochant du neuf, mais portant des traces d'usures et de vieillissement."],
    ["ÉTAT MOYEN", "Portant des traces d'usures et de vieillissement."],
    ["USAGE AVANCÉ", "État laissant apparaître un vieillissement prononcé, pouvant nécessiter une remise en état."],
    ["DÉGRADÉ", "Défauts d'entretien apparents ou détériorations apparentes, nécessitant une remise en état locative."],
  ];

  doc.setFontSize(9);
  for (const [titre, desc] of legende) {
    doc.setFont("arial", "bold");
    doc.text(`• ${titre} :`, LX, ly);
    doc.setFont("arial", "normal");
    const lines = doc.splitTextToSize(desc, LW - 30);
    doc.text(lines, LX + 30, ly);
    ly += Math.max(lines.length * 4.5, 5) + 2;
  }
  ly += 5;

  // Séparateur
  doc.setLineWidth(0.3);
  doc.line(LX, ly, LX + LW, ly);
  ly += 6;

  // Texte EDL entrant
  doc.setFontSize(10);
  doc.setFont("arial", "bold");
  doc.text("État des lieux d'entrée :", LX, ly);
  ly += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  const txtEntrant = "Les soussignés reconnaissent exactes les constatations sur l'état du logement, sous réserve du bon fonctionnement des canalisations, appareils et installations sanitaires, électriques et du chauffage qui n'a pu être vérifié ce jour, toute défectuosité dans le fonctionnement de ceux-ci devra être signalée dans le délai maximum de dix jours, et pendant le premier mois de la période de chauffe en ce qui concerne les éléments de chauffage. Lors de la première période de chauffe, le locataire dispose d'un mois pour indiquer au bailleur les éventuels dysfonctionnements des éléments de chauffage. Les co-signataires reconnaissent avoir reçu chacun un exemplaire du présent état des lieux et s'accordent pour y faire référence lors du départ du locataire.";
  const linesEntrant = doc.splitTextToSize(txtEntrant, LW);
  doc.text(linesEntrant, LX, ly);
  ly += linesEntrant.length * 4.5 + 6;

  // Texte EDL sortant
  doc.setFont("arial", "bold");
  doc.setFontSize(10);
  doc.text("État des lieux de sortie :", LX, ly);
  ly += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  const txtSortant = "Le locataire prend à sa charge les réparations locatives telles que définies à l'article du 1er du décret 87-712 du 26 août (travaux d'entretien courant, menues réparations). Le locataire est tenu de rendre le bien propre et nettoyé. Il est également tenu de s'assurer et de signaler au bailleur tout dommage, dès qu'il le constate. Si par négligence du propriétaire aucun état des lieux n'est dressé au début de la location, le locataire sera également présumé avoir reçu le logement en bon état.";
  const linesSortant = doc.splitTextToSize(txtSortant, LW);
  doc.text(linesSortant, LX, ly);
  ly += linesSortant.length * 4.5 + 6;

  ly = checkPage(doc, ly, 260);

  // Franchise
  doc.setFont("arial", "bold");
  doc.setFontSize(10);
  doc.text("Franchise :", LX, ly);
  ly += 5;
  doc.setFont("arial", "normal");
  doc.setFontSize(8.5);
  const txtFranchise = "Période durant laquelle les équipements du bien loué ne subissent pas d'altération. Certains équipements, dans le cadre de leur usage normal (un lavabo, par exemple), ne subissent pas d'altération physique sensible pendant leurs premières années de fonctionnement. Une franchise ou « période de neutralisation » peut être appliquée sur le coût du remplacement à l'identique. En cas de franchise, les coefficients d'abattement pour vétusté ne sont mis en œuvre qu'au-delà de cette période. La franchise est donc la période pendant laquelle il n'est pas appliqué d'abattement pour vétusté en début de vie théorique des matériaux ou équipements constituant les éléments du logement.";
  const linesFranchise = doc.splitTextToSize(txtFranchise, LW);
  doc.text(linesFranchise, LX, ly);
  ly += linesFranchise.length * 4.5 + 6;

  ly = checkPage(doc, ly, 260);

  // Notes finales
  const nomPropFull = getBailleurIdentite(parametres).nom;
  doc.setFontSize(8.5);
  doc.setFont("arial", "italic");
  const notes = [
    "Sous réserve de paiement des loyers jusqu'au terme du bail.",
    "Sous réserve du bon fonctionnement des canalisations, appareils et installations sanitaires, électriques et du chauffage qui n'a pu être vérifié ce jour.",
    `${nomPropFull} ne saurait en aucun cas être tenu(e) responsable des éventuelles dégradations qui viendraient à se produire sur les biens extérieurs (garage, cave) à posteriori de la signature du constat d'état des lieux de sortie.`,
  ];
  const notesText = notes.map(n => `• ${n}`).join(" ");
  const notesLines = doc.splitTextToSize(notesText, LW);
  ly = checkPage(doc, ly, 260);
  doc.text(notesLines, LX, ly);
  ly += notesLines.length * 4.5 + 5;

  // Séparateur
  doc.setLineWidth(0.3);
  doc.line(LX, ly, LX + LW, ly);
  ly += 6;

  // Preamble légal CONSTAT
  doc.setFontSize(11);
  doc.setFont("arial", "bold");
  const typeLabel2 = edl.type === "Entrant" ? "ENTRANT" : "SORTANT";
  doc.text(`CONSTAT D'ÉTAT DES LIEUX ${typeLabel2}`, 105, ly, { align: "center" });
  ly += 7;

  doc.setFontSize(8.5);
  doc.setFont("arial", "normal");
  const txtPreamble = "Le présent état des lieux établi contradictoirement entre les parties qui le reconnaissent exact, fait partie intégrante du contrat de location dont il ne peut être dissocié. L'état des lieux doit être rédigé le plus précisément possible, c'est le seul document ayant une valeur juridique. Si vous avez des observations à formuler, vous pouvez le faire par courrier recommandé uniquement dans les 10 jours suivant la réalisation de votre état des lieux.";
  const linesPreamble = doc.splitTextToSize(txtPreamble, LW);
  doc.text(linesPreamble, LX, ly);

  // Numérotation des pages
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    pageFooter(doc, i, pageCount);
  }

  const typeFile = edl.type === "Entrant" ? "entrant" : "sortant";
  doc.save(`edl_${typeFile}_${bail.locataire.nom}_${edl.date}.pdf`);
}

// ── PDF comparatif entrée / sortie ────────────────────────────────────────────

const ETAT_RANK: Record<string, number> = {
  "Neuf": 5, "Bon état": 4, "État moyen": 3, "Usage avancé": 2, "Dégradé": 1, "": 0,
};

function etatColor(etatE: string, etatS: string): [number, number, number] {
  if (!etatE || !etatS) return [220, 220, 220];
  const diff = ETAT_RANK[etatE] - ETAT_RANK[etatS];
  if (diff === 0) return [220, 240, 220];   // vert pâle
  if (diff === 1) return [255, 243, 205];   // orange pâle
  return [255, 220, 220];                   // rouge pâle
}

export async function generateEdlComparaisonPDF(
  edlEntrant: EtatDesLieux,
  edlSortant: EtatDesLieux,
  bail: Bail,
  parametres: Parametres,
  getFileFn?: (key: string) => Promise<string | null>,
): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const X = 15;
  const LH = 5;

  const nomProp = getBailleurIdentite(parametres).nom;
  const nomLoc = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  const adresseLog = `${bail.logement.adresse}, ${bail.logement.code_postal} ${bail.logement.ville}`;

  // Titre
  doc.setFontSize(14);
  doc.setFont("arial", "bold");
  doc.text("ÉTAT DES LIEUX — COMPARATIF ENTRÉE / SORTIE", 105, 18, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(15, 21, 195, 21);

  let y = 29;
  doc.setFontSize(9);
  doc.setFont("arial", "normal");
  doc.text(`Logement : ${adresseLog}`, X, y); y += 5;
  doc.text(`Bailleur : ${nomProp}   |   Locataire : ${nomLoc}`, X, y); y += 5;
  doc.text(`Entrée : ${formatDate(edlEntrant.date)}   |   Sortie : ${formatDate(edlSortant.date)}`, X, y); y += 7;

  // Légende
  doc.setFillColor(220, 240, 220); doc.rect(X, y - 3, 5, 4, "F");
  doc.text("Identique", X + 6, y);
  doc.setFillColor(255, 243, 205); doc.rect(X + 30, y - 3, 5, 4, "F");
  doc.text("Légèrement dégradé", X + 36, y);
  doc.setFillColor(255, 220, 220); doc.rect(X + 80, y - 3, 5, 4, "F");
  doc.text("Fortement dégradé", X + 86, y);
  y += 8;

  // Colonnes : Élément | Entrée | Sortie
  const colW = [55, 60, 60];
  const colX = [X, X + colW[0], X + colW[0] + colW[1]];

  function drawTableHeader(yy: number): number {
    doc.setFillColor(210, 220, 240);
    doc.rect(X, yy - 4, 180, 7, "F");
    doc.setFont("arial", "bold");
    doc.setFontSize(8);
    doc.text("Élément", colX[0] + 1, yy);
    doc.text(`Entrée — ${formatDate(edlEntrant.date)}`, colX[1] + 1, yy);
    doc.text(`Sortie — ${formatDate(edlSortant.date)}`, colX[2] + 1, yy);
    doc.setLineWidth(0.2);
    doc.rect(X, yy - 4, 180, 7);
    doc.line(colX[1], yy - 4, colX[1], yy + 3);
    doc.line(colX[2], yy - 4, colX[2], yy + 3);
    return yy + 7;
  }

  y = drawTableHeader(y);

  for (const pieceE of edlEntrant.pieces.filter(p => p.present)) {
    const pieceS = edlSortant.pieces.find(ps => ps.nom === pieceE.nom && ps.present);

    // Titre pièce
    y = checkPage(doc, y, 260);
    doc.setFillColor(230, 235, 248);
    doc.rect(X, y - 3, 180, 6, "F");
    doc.setFont("arial", "bold");
    doc.setFontSize(9);
    doc.text(pieceE.nom.toUpperCase(), X + 2, y);
    doc.setLineWidth(0.2);
    doc.rect(X, y - 3, 180, 6);
    y += 6;

    if (!pieceS) {
      doc.setFont("arial", "italic");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Pièce absente lors de l'état des lieux sortant", X + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 6;
      continue;
    }

    // Éléments de toutes les catégories
    const allItemsE = pieceE.categories.flatMap(c => c.items);
    for (const elE of allItemsE) {
      const elS = pieceS.categories.flatMap(c => c.items).find(i => i.nom === elE.nom);
      const [r, g, b] = etatColor(elE.etat, elS?.etat ?? "");
      const rowH = 6;

      y = checkPage(doc, y, 260);
      doc.setFillColor(r, g, b);
      doc.rect(X, y - 3, 180, rowH, "F");
      doc.setFont("arial", "normal");
      doc.setFontSize(8);
      doc.text(elE.nom, colX[0] + 1, y, { maxWidth: colW[0] - 2 });
      const entreeText = elE.etat + (elE.commentaire ? ` — ${elE.commentaire}` : "");
      const sortieText = (elS?.etat ?? "—") + (elS?.commentaire ? ` — ${elS.commentaire}` : "");
      const entreeLines = doc.splitTextToSize(entreeText || "—", colW[1] - 2);
      const sortieLines = doc.splitTextToSize(sortieText, colW[2] - 2);
      const maxLines = Math.max(entreeLines.length, sortieLines.length, 1);
      const actualH = Math.max(rowH, maxLines * LH + 2);

      doc.setFillColor(r, g, b);
      doc.rect(X, y - 3, 180, actualH, "F");
      doc.text(entreeLines, colX[1] + 1, y);
      doc.text(sortieLines, colX[2] + 1, y);
      doc.setLineWidth(0.05);
      doc.line(X, y + actualH - 3, X + 180, y + actualH - 3);
      doc.line(colX[1], y - 3, colX[1], y + actualH - 3);
      doc.line(colX[2], y - 3, colX[2], y + actualH - 3);
      y += actualH;
    }

    // Photos comparées
    if (getFileFn && (pieceE.photos.length > 0 || pieceS.photos.length > 0)) {
      const photos: { label: string; key: string }[] = [
        ...pieceE.photos.map(k => ({ label: "Entrée", key: k })),
        ...pieceS.photos.map(k => ({ label: "Sortie", key: k })),
      ];
      const loadedPhotos: { label: string; data: string }[] = [];
      for (const ph of photos) {
        const d = await getFileFn(ph.key).catch(() => null);
        if (d) loadedPhotos.push({ label: ph.label, data: d });
      }
      if (loadedPhotos.length > 0) {
        y = checkPage(doc, y, 200);
        doc.setFontSize(8);
        doc.setFont("arial", "italic");
        doc.text(`Photos — ${pieceE.nom}`, X, y); y += 4;
        let photoX = X;
        for (const ph of loadedPhotos) {
          if (photoX + 60 > 195) { photoX = X; y += 46; }
          y = checkPage(doc, y, 200);
          try { doc.addImage(ph.data, "JPEG", photoX, y, 55, 38); }
          catch { try { doc.addImage(ph.data, "PNG", photoX, y, 55, 38); } catch { /* skip */ } }
          doc.setFontSize(7);
          doc.text(ph.label, photoX + 2, y + 40);
          photoX += 58;
        }
        y += 46;
      }
    }

    y += 3;
  }

  // ── Récapitulatif des écarts ─────────────────────────────────────────────────
  {
    type EcartRow = { piece: string; el: string; etatE: string; etatS: string; kind: string };
    const ecartRows: EcartRow[] = [];
    for (const pieceEr of edlEntrant.pieces.filter(p => p.present)) {
      const pieceSr = edlSortant.pieces.find(ps => ps.nom === pieceEr.nom && ps.present);
      if (!pieceSr) continue;
      for (const cat of pieceEr.categories) {
        for (const itemEr of cat.items) {
          const itemSr = pieceSr.categories.flatMap(c => c.items).find(i => i.nom === itemEr.nom);
          if (!itemEr.etat || !itemSr?.etat || itemEr.etat === itemSr.etat) continue;
          const dr = ETAT_RANK[itemEr.etat] - ETAT_RANK[itemSr.etat];
          const isNormR = itemEr.etat === "Neuf" && itemSr.etat === "Bon état";
          ecartRows.push({ piece: pieceEr.nom, el: itemEr.nom, etatE: itemEr.etat, etatS: itemSr.etat, kind: dr < 0 ? "Amélioration" : isNormR ? "Usure normale" : "Dégradation potentielle" });
        }
      }
    }

    if (ecartRows.length > 0) {
      y = checkPage(doc, y, 250);

      // Header
      doc.setFontSize(10);
      doc.setFont("arial", "bold");
      doc.setFillColor(255, 240, 220);
      doc.setDrawColor(220, 145, 75);
      doc.setLineWidth(0.5);
      doc.rect(X, y - 4, 180, 8, "FD");
      doc.setTextColor(0, 0, 0);
      doc.text("RÉCAPITULATIF DES ÉCARTS", X + 2, y);
      doc.setDrawColor(0, 0, 0);
      y += 8;

      const nNorm = ecartRows.filter(e => e.kind === "Usure normale").length;
      const nDeg = ecartRows.filter(e => e.kind === "Dégradation potentielle").length;
      const nAmel = ecartRows.filter(e => e.kind === "Amélioration").length;
      doc.setFontSize(8);
      doc.setFont("arial", "normal");
      doc.text(
        `Total : ${ecartRows.length} écart${ecartRows.length > 1 ? "s" : ""}   ·   Usure normale : ${nNorm}   ·   Dégradations : ${nDeg}   ·   Améliorations : ${nAmel}`,
        X, y
      );
      y += 7;

      // Table columns: Pièce | Élément | État entrant | État sortant | Évolution
      const cx = [X, X + 35, X + 75, X + 112, X + 147];
      const cw = [35, 40, 37, 35, 33];

      // Table header row
      doc.setFillColor(210, 220, 240);
      doc.rect(X, y - 4, 180, 7, "F");
      doc.setFont("arial", "bold");
      doc.setFontSize(7.5);
      doc.text("Pièce", cx[0] + 1, y);
      doc.text("Élément", cx[1] + 1, y);
      doc.text("État entrant", cx[2] + 1, y);
      doc.text("État sortant", cx[3] + 1, y);
      doc.text("Évolution", cx[4] + 1, y);
      doc.setLineWidth(0.2);
      doc.rect(X, y - 4, 180, 7);
      for (const cxv of cx.slice(1)) { doc.line(cxv, y - 4, cxv, y + 3); }
      y += 7;

      doc.setFont("arial", "normal");
      for (const er of ecartRows) {
        y = checkPage(doc, y, 265);
        const rowFill: [number, number, number] = er.kind === "Dégradation potentielle" ? [255, 220, 220] : er.kind === "Usure normale" ? [255, 245, 200] : [220, 245, 220];
        doc.setFillColor(...rowFill);
        doc.rect(X, y - 3, 180, 6, "F");
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text(er.piece, cx[0] + 1, y, { maxWidth: cw[0] - 2 });
        doc.text(er.el, cx[1] + 1, y, { maxWidth: cw[1] - 2 });
        doc.text(er.etatE, cx[2] + 1, y, { maxWidth: cw[2] - 2 });
        doc.text(er.etatS, cx[3] + 1, y, { maxWidth: cw[3] - 2 });
        const kindClr: [number, number, number] = er.kind === "Dégradation potentielle" ? [180, 0, 0] : er.kind === "Usure normale" ? [140, 90, 0] : [0, 120, 0];
        doc.setTextColor(...kindClr);
        doc.text(er.kind, cx[4] + 1, y, { maxWidth: cw[4] - 2 });
        doc.setTextColor(0, 0, 0);
        doc.setLineWidth(0.05);
        doc.line(X, y + 3, X + 180, y + 3);
        for (const cxv of cx.slice(1)) { doc.line(cxv, y - 3, cxv, y + 3); }
        y += 6;
      }
      y += 5;
    }
  }

  // Signatures
  y = checkPage(doc, y, 230);
  doc.setFontSize(10);
  doc.setFont("arial", "bold");
  doc.text("SIGNATURES", X, y);
  doc.setLineWidth(0.3);
  doc.line(X, y + 2, 195, y + 2);
  y += 10;

  // Entrée
  doc.setFontSize(9);
  doc.setFont("arial", "bold");
  doc.text(`État des lieux entrant — ${formatDate(edlEntrant.date)}`, X, y); y += 6;
  doc.setFont("arial", "normal");
  doc.text("Propriétaire :", X, y);
  doc.text("Locataire :", X + 95, y); y += 4;
  if (edlEntrant.signature_proprietaire) {
    try { doc.addImage(edlEntrant.signature_proprietaire, "PNG", X, y, 55, 22); } catch { /* skip */ }
  }
  if (edlEntrant.signature_locataire) {
    try { doc.addImage(edlEntrant.signature_locataire, "PNG", X + 95, y, 55, 22); } catch { /* skip */ }
  }
  y += 26;

  // Sortie
  doc.setFont("arial", "bold");
  doc.text(`État des lieux sortant — ${formatDate(edlSortant.date)}`, X, y); y += 6;
  doc.setFont("arial", "normal");
  doc.text("Propriétaire :", X, y);
  doc.text("Locataire :", X + 95, y); y += 4;
  if (edlSortant.signature_proprietaire) {
    try { doc.addImage(edlSortant.signature_proprietaire, "PNG", X, y, 55, 22); } catch { /* skip */ }
  }
  if (edlSortant.signature_locataire) {
    try { doc.addImage(edlSortant.signature_locataire, "PNG", X + 95, y, 55, 22); } catch { /* skip */ }
  }

  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    pageFooter(doc, i, pageCount);
  }

  doc.save(`edl_comparatif_${bail.locataire.nom}_${edlSortant.date}.pdf`);
}
