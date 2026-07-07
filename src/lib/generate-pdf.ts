import { jsPDF } from "jspdf";
import type { Quittance, Locataire, Parametres } from "./types";
import { nombreEnLettres } from "./nombre-en-lettres";
import { registerArial } from "./register-arial";
import { getBailleurIdentite } from "./generate-contrats-pdf";

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function dernierJourDuMois(mois: number, annee: number): number {
  return new Date(annee, mois, 0).getDate();
}

export function generateQuittancePDF(
  quittance: Quittance,
  locataire: Locataire,
  parametres: Parametres,
): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  registerArial(doc);
  const pageWidth = 210;
  const total = quittance.loyer + quittance.charges;
  const moisNom = MOIS_FR[quittance.mois - 1];
  const dernier = dernierJourDuMois(quittance.mois, quittance.annee);

  // --- En-tête bleu ---
  doc.setFillColor(173, 216, 230);
  doc.rect(15, 15, 180, 20, "F");
  doc.setFontSize(10);
  doc.setFont("arial", "normal");
  doc.text("Location meublée à titre de résidence principale :", pageWidth / 2, 22, { align: "center" });
  doc.setFontSize(13);
  doc.setFont("arial", "bold");
  doc.text("Quittance de loyer", pageWidth / 2, 30, { align: "center" });

  // --- Cadre principal ---
  doc.setDrawColor(173, 216, 230);
  doc.setLineWidth(0.5);
  doc.rect(15, 40, 180, 230);

  // --- Titre du mois ---
  doc.setFontSize(22);
  doc.setFont("arial", "bold");
  doc.setTextColor(0, 0, 0);
  const titre = `Quittance de loyer du mois de`;
  const titre2 = `${moisNom} ${quittance.annee}`;
  doc.text(titre, pageWidth / 2, 58, { align: "center" });
  doc.text(titre2, pageWidth / 2, 70, { align: "center" });

  // --- Infos propriétaire (gauche, italique) ---
  doc.setFontSize(10);
  doc.setFont("arial", "italic");
  const bailleurId = getBailleurIdentite(parametres);
  const nomProp = bailleurId.nom;
  doc.text(nomProp, 25, 88);
  doc.text(bailleurId.adresse || parametres.adresse, 25, 94);
  doc.text(`${parametres.code_postal} ${parametres.ville}, ${parametres.pays}`, 25, 100);
  doc.text(parametres.telephone, 25, 106);

  // --- Infos locataire (droite, italique, en dessous du propriétaire) ---
  const nomLoc = `${locataire.nom.toUpperCase()}, ${locataire.prenom}`;
  doc.text(nomLoc, 185, 112, { align: "right" });
  doc.text(`${locataire.adresse_location}`, 185, 118, { align: "right" });
  doc.text(
    `${locataire.code_postal_location} ${locataire.ville_location}, ${locataire.pays_location}`,
    185, 124, { align: "right" },
  );

  // --- Fait à / date ---
  doc.setFont("arial", "normal");
  doc.text(
    `Fait à ${quittance.lieu_emission}, le ${formatDate(quittance.date_emission)}`,
    25, 136,
  );

  // --- Adresse de la location ---
  doc.setFontSize(11);
  doc.setFont("arial", "bold");
  doc.text("Adresse de la location :", 25, 150);
  doc.setLineWidth(0.3);
  doc.line(25, 151, 85, 151);

  doc.setFont("arial", "normal");
  doc.setFontSize(10);
  doc.text(
    `${locataire.adresse_location}, ${locataire.ville_location} ${locataire.code_postal_location} - ${locataire.pays_location}`,
    25, 157,
  );

  // --- Texte principal ---
  const totalEnLettres = nombreEnLettres(total);
  const texte = `Je soussigné(e) ${nomProp}, propriétaire du logement désigné ci-dessus, déclare avoir reçu de ${locataire.civilite} ${locataire.nom.toUpperCase()} ${locataire.prenom}, la somme de ${totalEnLettres} / ${total} euros, au titre du paiement du loyer et des charges pour la période de location du 1 ${moisNom} ${quittance.annee} au ${dernier} ${moisNom} ${quittance.annee} et lui en donne quittance, sous réserve de tous mes droits.`;

  doc.setFontSize(10);
  const lines = doc.splitTextToSize(texte, 160);
  doc.text(lines, 25, 170);

  // --- Détail du règlement ---
  const detailY = 170 + lines.length * 5 + 12;

  doc.setFontSize(11);
  doc.setFont("arial", "bold");
  doc.text("Détail du règlement :", 25, detailY);
  doc.setLineWidth(0.3);
  doc.line(25, detailY + 1, 85, detailY + 1);

  doc.setFont("arial", "normal");
  doc.setFontSize(10);
  doc.text("Loyer :", 25, detailY + 10);
  doc.text(`${quittance.loyer.toFixed(1)}  euros`, 80, detailY + 10);

  doc.text("Provision pour charges :", 25, detailY + 18);
  doc.text(`${quittance.charges.toFixed(1)}  euros`, 80, detailY + 18);

  doc.setFont("arial", "bold");
  doc.text("Total :", 25, detailY + 28);
  doc.text(`${total.toFixed(1)}  euros`, 80, detailY + 28);

  doc.setFont("arial", "normal");
  const dpParts = quittance.date_paiement.split("-");
  doc.text(`Date du paiement : le ${dpParts[2]} / ${dpParts[1]} / ${dpParts[0]}`, 25, detailY + 38);

  // --- Signature ---
  if (quittance.signature_data) {
    try {
      doc.addImage(quittance.signature_data, "PNG", 120, detailY + 10, 65, 45);
    } catch {
      // signature invalide, on ignore
    }
  }

  // --- Texte légal ---
  doc.setFontSize(8);
  doc.setFont("arial", "italic");
  const legal1 = "Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant du présent terme. Elle est à conserver pendant trois ans par le locataire (loi n° 89-462 du 6 juillet 1989 : art. 7-1).";
  const legalLines = doc.splitTextToSize(legal1, 160);
  doc.text(legalLines, 25, 252);

  doc.setFont("arial", "bold");
  doc.text("Texte de référence : - loi du 6.7.89 : art. 21", 25, 264);

  return doc;
}
