import type { PieceEDL, CategorieEDL, ItemEDL, ReleverCompteur } from "./types";

export const ETATS_OPTIONS = ["Neuf", "Bon état", "État moyen", "Usage avancé", "Dégradé"] as const;

export const ETATS_LEGENDES: Record<string, string> = {
  "Neuf":          "État neuf, parfait — jamais habité ou entièrement refait.",
  "Bon état":      "Très proche du neuf mais portant des traces d'usure et de vieillissement normales.",
  "État moyen":    "Portant des traces d'usure et de vieillissement visibles.",
  "Usage avancé":  "Vieillissement prononcé pouvant nécessiter une remise en état.",
  "Dégradé":       "Défauts d'entretien ou détériorations apparentes nécessitant une remise en état locative.",
};

export const NOMS_CATEGORIES_DEFAULT = [
  "Éléments structurels",
  "Installation électrique",
  "Équipements",
  "Mobilier",
] as const;

export function makeItem(nom: string): ItemEDL {
  return { id: crypto.randomUUID(), nom, quantite: "1", caracteristiques: [], etat: "Bon état", observations: ["RAS"], commentaire: "", photos: [] };
}

// Suggestions de caractéristiques par type d'élément
export function getCaracteristiquesSuggestions(nom: string): string[] {
  const n = nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("mur") || n.includes("cloison")) return ["Peinture blanche", "Peinture couleur", "Papier peint", "Crépi", "Carrelage mural", "Pierre", "Brique apparente", "Enduit lisse"];
  if (n.includes("sol") || n.includes("plancher") || n.includes("carrelage")) return ["Carrelage", "Parquet", "Stratifié", "Vinyle / Lino", "Moquette", "Béton ciré", "Tomette", "Marbre"];
  if (n.includes("parquet")) return ["Bois massif", "Contrecollé", "Stratifié", "Chêne", "Hêtre", "Pin", "Verni", "Huilé"];
  if (n.includes("fenetre") || n.includes("fenêtre") || n.includes("baie") || n.includes("velux")) return ["PVC", "Bois", "Aluminium", "Double vitrage", "Triple vitrage", "Simple vitrage", "Oscillo-battante", "Coulissante"];
  if (n.includes("porte") || n.includes("placard")) return ["Bois", "PVC", "Aluminium", "Vitrée", "Pleine", "Coulissante", "Battante", "Pliante", "Laquée"];
  if (n.includes("plafond")) return ["Peinture blanche", "Faux plafond", "Plâtre", "Bois", "Béton", "Tendu"];
  if (n.includes("volet") || n.includes("store")) return ["Bois", "PVC", "Aluminium", "Électrique", "Manuel", "Roulant", "Battant"];
  if (n.includes("prise")) return ["Simple", "Double", "Triple", "USB", "RJ45 / Internet", "TV"];
  if (n.includes("interrupteur")) return ["Simple", "Double", "Va-et-vient", "Variateur", "Détecteur"];
  if (n.includes("plafonnier") || n.includes("luminaire")) return ["LED", "Halogène", "Fluorescent", "Suspension", "Encastré", "Spot"];
  if (n.includes("radiateur") || n.includes("chauffage")) return ["Électrique", "Eau chaude", "Fonte", "Acier", "Inertie", "Sèche-serviettes"];
  if (n.includes("plaque") || n.includes("gaziniere") || n.includes("gazinière")) return ["Vitrocéramique", "Induction", "Gaz", "Électrique", "4 foyers", "5 foyers"];
  if (n.includes("four")) return ["Électrique", "Gaz", "Encastré", "Pose libre", "Multifonction", "Chaleur tournante"];
  if (n.includes("evier") || n.includes("évier")) return ["Inox", "Céramique", "Composite", "Simple bac", "Double bac"];
  if (n.includes("baignoire")) return ["Acrylique", "Fonte émaillée", "Balnéo", "Sabot", "Encastrée", "Îlot"];
  if (n.includes("douche")) return ["Acrylique", "Carrelée", "Paroi verre", "Rideau", "Italienne", "Cabine complète"];
  if (n.includes("wc") || n.includes("toilette")) return ["Suspendu", "À poser", "Double chasse", "Simple chasse", "Abattant inclus"];
  if (n.includes("lavabo") || n.includes("vasque")) return ["Céramique", "Inox", "Composite", "Encastré", "Colonne", "Semi-colonne"];
  if (n.includes("refrigerateur") || n.includes("réfrigérateur") || n.includes("frigo")) return ["Pose libre", "Encastré", "Simple porte", "Combiné", "Américain", "No-frost"];
  if (n.includes("lave")) return ["Pose libre", "Encastrée", "Encastré", "A+++", "A+", "Chargement frontal", "Chargement dessus"];
  return [];
}

export const OBSERVATIONS_PREDEFINIES = [
  "RAS", "Propre", "Traces d'usage", "Rayures légères", "Rayures importantes",
  "Taches", "Fissure légère", "Fissure importante", "Éclat",
  "Humidité", "Moisissure", "Peinture écaillée",
  "Fonctionnement correct", "Fonctionnement difficile", "À remplacer",
];

function makeCat(nom: string, itemNoms: string[]): CategorieEDL {
  return { id: crypto.randomUUID(), nom, items: itemNoms.map(makeItem) };
}

function makePiece(nom: string, present = true): PieceEDL {
  return {
    id: crypto.randomUUID(),
    nom,
    present,
    categories: [
      makeCat("Éléments structurels", ["Murs", "Sol", "Fenêtres", "Portes"]),
      makeCat("Installation électrique", ["Prises", "Interrupteurs", "Plafonnier"]),
      makeCat("Équipements", []),
      makeCat("Mobilier", []),
    ],
    photos: [],
  };
}

export function defaultPieces(): PieceEDL[] {
  return [
    makePiece("Entrée"),
    makePiece("Couloir", false),
    makePiece("Séjour / Salon"),
    makePiece("Chambre 1"),
    makePiece("Chambre 2", false),
    makePiece("Chambre 3", false),
    makePiece("Cuisine"),
    makePiece("Salle de bain"),
    makePiece("WC"),
    makePiece("Balcon / Terrasse", false),
    makePiece("Cave", false),
    makePiece("Garage", false),
    makePiece("Débarras", false),
    makePiece("Grenier", false),
  ];
}

export function defaultReleves(): ReleverCompteur[] {
  return [
    { id: crypto.randomUUID(), type: "Électricité", numero: "", valeur: "", unite: "kWh", photo: "" },
    { id: crypto.randomUUID(), type: "Eau froide", numero: "", valeur: "", unite: "m³", photo: "" },
    { id: crypto.randomUUID(), type: "Eau chaude", numero: "", valeur: "", unite: "m³", photo: "" },
    { id: crypto.randomUUID(), type: "Gaz", numero: "", valeur: "", unite: "m³", photo: "" },
  ];
}

export function defaultCles() {
  return [
    { id: crypto.randomUUID(), type: "Clé appartement", quantite: "1" },
    { id: crypto.randomUUID(), type: "Clé boîte aux lettres", quantite: "1" },
    { id: crypto.randomUUID(), type: "Badge / Digicode", quantite: "0" },
    { id: crypto.randomUUID(), type: "Clé garage", quantite: "0" },
    { id: crypto.randomUUID(), type: "Clé cave", quantite: "0" },
  ];
}
