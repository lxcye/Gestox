import { jsPDF } from "jspdf";
import type { BailRevisionLoyer, BailRegularisationCharges, Bail, Parametres } from "./types";
import { registerArial } from "./register-arial";

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function periodeToFrancais(periode: string): string {
  const map: Record<string, string> = {
    "Q1": "premier trimestre",
    "Q2": "deuxième trimestre",
    "Q3": "troisième trimestre",
    "Q4": "quatrième trimestre",
  };
  const [annee, q] = periode.split("-");
  return `${map[q] ?? q} ${annee}`;
}


function entete(doc: jsPDF, bail: Bail, parametres: Parametres, dateDoc: string): number {
  doc.setFontSize(10);
  doc.setFont("arial", "normal");

  // Propriétaire (gauche)
  doc.text(`${parametres.nom.toUpperCase()} ${parametres.prenom}`, 20, 20);
  doc.text(parametres.adresse, 20, 26);
  doc.text(`${parametres.code_postal} ${parametres.ville}`, 20, 32);
  doc.text(parametres.telephone, 20, 38);
  let yProp = 38;
  if (parametres.email) {
    yProp = 44;
    doc.text(parametres.email, 20, 44);
  }

  // Locataire (droite, en dessous du propriétaire)
  const yLoc = yProp + 12;
  const nomLoc = `${bail.locataire.nom.toUpperCase()} ${bail.locataire.prenom}`;
  doc.text(nomLoc, 190, yLoc, { align: "right" });
  doc.text(`${bail.logement.adresse}`, 190, yLoc + 6, { align: "right" });
  doc.text(`${bail.logement.code_postal} ${bail.logement.ville}`, 190, yLoc + 12, { align: "right" });
  if (bail.locataire.email) {
    doc.text(bail.locataire.email, 190, yLoc + 18, { align: "right" });
  }

  const yDate = yLoc + (bail.locataire.email ? 30 : 24);
  doc.text(`${parametres.lieu_signature}, le ${formatDate(dateDoc)}`, 20, yDate);

  return yDate; // retourne la position Y après l'en-tête
}

// ── Révision de loyer ──────────────────────────────────────────────────────────

export function generateRevisionLoyerPDF(
  revision: BailRevisionLoyer,
  bail: Bail,
  parametres: Parametres,
): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const yDate = entete(doc, bail, parametres, revision.date_courrier);

  // Titre
  doc.setFontSize(14);
  doc.setFont("arial", "bold");
  doc.text("Révision annuelle du loyer", 105, yDate + 14, { align: "center" });
  doc.setLineWidth(0.4);
  doc.line(40, yDate + 16, 170, yDate + 16);

  // Nom + prénom du locataire (sans formule de politesse)
  const nomLocataire = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()}`;
  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text(nomLocataire, 20, yDate + 26);

  // Corps
  const adresseLogement = `${bail.logement.adresse}, ${bail.logement.ville} ${bail.logement.code_postal}`;
  const trimestreStr = revision.periode_irl_nouveau ? periodeToFrancais(revision.periode_irl_nouveau) : "—";
  const augMax = (revision.loyer_max - revision.ancien_loyer).toFixed(2);
  const augChoisie = (revision.loyer_choisi - revision.ancien_loyer).toFixed(2);
  const appliqueMax = Math.abs(revision.loyer_choisi - revision.loyer_max) < 0.01;

  const p1 = `Conformément aux dispositions de l'article 17-1 de la loi n°89-462 du 6 juillet 1989, et aux termes de notre contrat de location en date du ${formatDate(revision.date_contrat)}, je vous informe que, en tant que propriétaire de votre logement situé au ${adresseLogement}, je procède à la révision annuelle du loyer.`;

  const p2 = `Cette révision est calculée sur la base de l'indice de référence des loyers (IRL) publié par l'INSEE, conformément aux conditions prévues dans le contrat de location. À ce titre, l'indice applicable pour la révision du loyer au ${formatDate(revision.date_courrier)} est celui du ${trimestreStr} ; d'une valeur de ${revision.indice_nouveau.toFixed(2).replace(".", ",")} et paru au journal officiel en date du ${formatDate(revision.date_jo_irl)}.`;

  let p3: string;
  if (appliqueMax) {
    p3 = `Ainsi, après application de l'indice de référence des loyers, le montant de votre loyer mensuel passera de ${revision.ancien_loyer.toFixed(2)}€ à ${revision.loyer_max.toFixed(2)}€, soit une augmentation de ${augMax}€.`;
  } else {
    p3 = `Ainsi, après application de l'indice de référence des loyers, le montant de votre loyer mensuel peut passer de ${revision.ancien_loyer.toFixed(2)}€ à ${revision.loyer_max.toFixed(2)}€ au maximum, soit une augmentation de ${augMax}€ maximum. Toutefois, j'ai choisi de limiter cette révision à une augmentation de ${augChoisie}€, portant le montant de votre loyer mensuel à ${revision.loyer_choisi.toFixed(2)}€.`;
  }

  const p4 = `Cette révision prendra effet à compter du ${formatDate(revision.date_effet)}, conformément aux termes de notre contrat.`;
  const p5 = `Je vous prie de bien vouloir prendre note de ce nouveau montant de loyer et reste à votre disposition pour toute précision complémentaire.`;
  const p6 = `Je vous prie d'agréer, l'expression de mes salutations distinguées.`;

  let y = yDate + 34;
  const lineH = 5;

  for (const para of [p1, p2, p3, p4, p5, p6]) {
    const lines = doc.splitTextToSize(para, 170);
    doc.text(lines, 20, y);
    y += lines.length * lineH + 6;
  }

  y += 8;
  doc.text("Cordialement,", 20, y);
  y += 8;
  doc.text(`${parametres.prenom} ${parametres.nom.toUpperCase()}`, 140, y);
  if (parametres.signature_proprietaire) {
    try {
      doc.addImage(parametres.signature_proprietaire, "PNG", 120, y + 4, 65, 45);
    } catch { /* signature invalide */ }
  }

  return doc;
}

// ── Régularisation de charges ─────────────────────────────────────────────────

export function generateRegularisationChargesPDF(
  regul: BailRegularisationCharges,
  bail: Bail,
  parametres: Parametres,
): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);

  const yDate = entete(doc, bail, parametres, regul.date);

  doc.setFontSize(14);
  doc.setFont("arial", "bold");
  doc.text("Régularisation de charges locatives", 105, yDate + 14, { align: "center" });
  doc.setLineWidth(0.4);
  doc.line(30, yDate + 16, 180, yDate + 16);

  const nomLocataire = `${bail.locataire.prenom} ${bail.locataire.nom.toUpperCase()},`;
  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text(nomLocataire, 20, yDate + 26);

  const intro = `Je vous prie de bien vouloir trouver ci-dessous, votre régularisation de charge concernant la période du ${formatDate(regul.periode_debut)} au ${formatDate(regul.periode_fin)}.`;
  const introLines = doc.splitTextToSize(intro, 170);
  doc.text(introLines, 20, yDate + 33);

  let y = yDate + 33 + introLines.length * 5 + 8;

  const colX = [20, 130, 162];

  // En-têtes tableau
  doc.setFillColor(220, 230, 242);
  doc.rect(20, y - 4, 172, 8, "F");
  doc.setFont("arial", "bold");
  doc.setFontSize(9);
  doc.text("Intitulé des charges", colX[0] + 1, y);
  doc.text("Montant mensuel (€)", colX[1], y, { align: "right" });
  doc.text("Montant annuel (€)", 192, y, { align: "right" });
  doc.setLineWidth(0.3);
  doc.rect(20, y - 4, 172, 8);
  y += 8;

  // Lignes provisions
  doc.setFont("arial", "normal");
  for (const ligne of regul.lignes) {
    doc.text(ligne.intitule, colX[0] + 1, y);
    doc.text(ligne.montant_mensuel_provision.toFixed(2), colX[1], y, { align: "right" });
    doc.text((ligne.montant_mensuel_provision * 12).toFixed(2), 192, y, { align: "right" });
    doc.setLineWidth(0.1);
    doc.line(20, y + 2, 192, y + 2);
    y += 7;
  }

  const totalProvMensuel = regul.lignes.reduce((s, l) => s + l.montant_mensuel_provision, 0);
  doc.setFont("arial", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 4, 172, 7, "F");
  doc.text("Total des provisions charges individuelles", colX[0] + 1, y);
  doc.text(totalProvMensuel.toFixed(2), colX[1], y, { align: "right" });
  doc.text((totalProvMensuel * 12).toFixed(2), 192, y, { align: "right" });
  doc.setLineWidth(0.3);
  doc.rect(20, y - 4, 172, 7);
  y += 10;

  // Lignes réelles
  doc.setFont("arial", "normal");
  for (const ligne of regul.lignes) {
    doc.text(ligne.intitule, colX[0] + 1, y);
    doc.text(ligne.montant_mensuel_reel.toFixed(2), colX[1], y, { align: "right" });
    doc.text((ligne.montant_mensuel_reel * 12).toFixed(2), 192, y, { align: "right" });
    doc.setLineWidth(0.1);
    doc.line(20, y + 2, 192, y + 2);
    y += 7;
  }

  const totalReelMensuel = regul.lignes.reduce((s, l) => s + l.montant_mensuel_reel, 0);
  doc.setFont("arial", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 4, 172, 7, "F");
  doc.text("Total charges individuelles réelles", colX[0] + 1, y);
  doc.text(totalReelMensuel.toFixed(2), colX[1], y, { align: "right" });
  doc.text((totalReelMensuel * 12).toFixed(2), 192, y, { align: "right" });
  doc.setLineWidth(0.3);
  doc.rect(20, y - 4, 172, 7);
  y += 10;

  const solde = totalReelMensuel * 12 - totalProvMensuel * 12;
  doc.setFillColor(220, 230, 242);
  doc.rect(20, y - 4, 172, 7, "F");
  doc.text("Solde à régulariser", colX[0] + 1, y);
  doc.text("-", colX[1], y, { align: "right" });
  const soldeStr = solde >= 0 ? `+${solde.toFixed(2)}` : solde.toFixed(2);
  doc.text(soldeStr, 192, y, { align: "right" });
  doc.setLineWidth(0.3);
  doc.rect(20, y - 4, 172, 7);
  y += 10;

  if (regul.quote_part) {
    doc.setFont("arial", "italic");
    doc.setFontSize(8);
    doc.text(`Le montant des charges est réparti selon la quote-part de ${regul.quote_part} vous incombant dans la copropriété.`, 20, y);
    y += 8;
  }

  // Page 2
  doc.addPage();

  doc.setFontSize(9);
  doc.setFont("arial", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("Régularisation de charges locatives — suite", 105, 15, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 28;

  doc.setFontSize(10);
  doc.setFont("arial", "normal");

  const totalReelAnnuel = totalReelMensuel * 12;
  const abssolde = Math.abs(solde);
  let texteRecap: string;
  if (solde < 0) {
    texteRecap = `Total des charges locatives annuelles effectives à la charge du locataire : ${totalReelAnnuel.toFixed(2)}€ ; Soit un trop perçu de ${abssolde.toFixed(2)} € en votre faveur.`;
  } else if (solde > 0) {
    texteRecap = `Total des charges locatives annuelles effectives à la charge du locataire : ${totalReelAnnuel.toFixed(2)}€ ; Soit un complément de ${abssolde.toFixed(2)} € à votre charge.`;
  } else {
    texteRecap = `Total des charges locatives annuelles effectives à la charge du locataire : ${totalReelAnnuel.toFixed(2)}€ ; Aucun solde à régulariser.`;
  }

  doc.setFont("arial", "bold");
  const recapLines = doc.splitTextToSize(texteRecap, 170);
  doc.text(recapLines, 20, y);
  y += recapLines.length * 5 + 8;

  if (regul.nouvelles_provisions_mensuelles > 0) {
    const texteProv = `Afin de mieux correspondre aux charges réelles et d'éviter de trop grandes variations lors de la prochaine régularisation, je vous informe que les provisions mensuelles pour charges seront désormais fixées à ${regul.nouvelles_provisions_mensuelles.toFixed(2)} € par mois à partir du ${formatDate(regul.date_effet_nouvelles_provisions)}.`;
    doc.setFont("arial", "normal");
    const provLines = doc.splitTextToSize(texteProv, 170);
    doc.text(provLines, 20, y);
    y += provLines.length * 5 + 10;
  }

  doc.setFont("arial", "normal");
  doc.text("Je reste à votre disposition pour toute précision concernant ce calcul.", 20, y);
  y += 12;
  doc.text("Cordialement,", 20, y);
  y += 8;
  doc.text(`${parametres.prenom} ${parametres.nom.toUpperCase()}`, 140, y);

  if (parametres.signature_proprietaire) {
    try {
      doc.addImage(parametres.signature_proprietaire, "PNG", 120, y + 4, 65, 45);
    } catch { /* signature invalide */ }
  }

  doc.setFontSize(8);
  doc.setFont("arial", "italic");
  doc.setTextColor(150, 150, 150);
  doc.setPage(1);
  doc.text("1/2", 105, 290, { align: "center" });
  doc.setPage(2);
  doc.text("2/2", 105, 290, { align: "center" });

  return doc;
}
