"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Bail, Locataire } from "@/lib/types";
import { saveBail, getLocataires } from "@/lib/store";

const TYPES_BIEN = ["Studio", "T1", "T2", "T3", "T4", "T5+", "Maison", "Autre"];
const TYPES_BAIL = ["Meublé", "Vide", "Étudiant", "Mobilité", "Professionnel", "Autre"];
const SITUATIONS = ["Salarié", "Étudiant", "Indépendant", "Retraité", "Sans emploi", "Autre"];
const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Prélèvement", "Autre"];

export default function NouveauBailPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [locatairesExistants, setLocatairesExistants] = useState<Locataire[]>([]);
  const [selectedLocataireId, setSelectedLocataireId] = useState("");
  const [erreurs, setErreurs] = useState<{ message: string; etape: number }[]>([]);

  // Champs locataire (pré-remplis si sélection)
  const [locNom, setLocNom] = useState("");
  const [locPrenom, setLocPrenom] = useState("");
  const [locTel, setLocTel] = useState("");
  const [locEmail, setLocEmail] = useState("");
  const [locNaissance, setLocNaissance] = useState("");
  const [locSituation, setLocSituation] = useState("Salarié");
  const [locGarant, setLocGarant] = useState("");
  const [locEntree, setLocEntree] = useState("");

  // Champs finances pré-remplis
  const [loyerHC, setLoyerHC] = useState("");
  const [chargesVal, setChargesVal] = useState("");

  useEffect(() => {
    setLocatairesExistants(getLocataires());
  }, []);

  function handleSelectLocataire(id: string) {
    setSelectedLocataireId(id);
    if (!id) return;
    const loc = locatairesExistants.find((l) => l.id === id);
    if (!loc) return;

    setLocNom(loc.nom);
    setLocPrenom(loc.prenom);
    setLocTel("");
    setLocEmail("");
    setLocNaissance("");
    setLocSituation("Salarié");
    setLocGarant("");
    setLocEntree(loc.date_debut_bail);
    setLoyerHC(loc.loyer.toString());
    setChargesVal(loc.charges.toString());
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (name: string) => (f.get(name) as string) || "";
    const n = (name: string) => parseFloat(g(name)) || 0;

    // Validation
    const errs: { message: string; etape: number }[] = [];

    // Étape 1 - Logement
    if (!g("log_adresse").trim()) errs.push({ message: "Adresse du logement manquante", etape: 1 });
    if (!g("log_cp").trim()) errs.push({ message: "Code postal du logement manquant", etape: 1 });
    if (!g("log_ville").trim()) errs.push({ message: "Ville du logement manquante", etape: 1 });

    // Étape 2 - Locataire
    if (!g("loc_nom").trim()) errs.push({ message: "Nom du locataire manquant", etape: 2 });
    if (!g("loc_prenom").trim()) errs.push({ message: "Prénom du locataire manquant", etape: 2 });
    if (!g("loc_entree")) errs.push({ message: "Date d'entrée du locataire manquante", etape: 2 });

    // Étape 3 - Contrat
    if (!g("bail_signature")) errs.push({ message: "Date de signature du bail manquante", etape: 3 });
    if (!g("bail_debut")) errs.push({ message: "Date de début du bail manquante", etape: 3 });

    // Étape 4 - Finances
    if (!g("loyer_hc") || n("loyer_hc") <= 0) errs.push({ message: "Loyer hors charges invalide ou manquant", etape: 4 });
    if (!g("charges") && g("charges") !== "0") errs.push({ message: "Montant des charges manquant", etape: 4 });

    if (errs.length > 0) {
      setErreurs(errs);
      // Aller à la première étape avec erreur
      setStep(errs[0].etape);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErreurs([]);

    const lhc = n("loyer_hc");
    const ch = n("charges");

    const bail: Bail = {
      id: crypto.randomUUID(),
      proprietaire_id: "1",
      logement: {
        adresse: g("log_adresse"),
        code_postal: g("log_cp"),
        ville: g("log_ville"),
        pays: g("log_pays") || "France",
        type_bien: g("log_type") as Bail["logement"]["type_bien"],
        meuble: g("log_meuble") as Bail["logement"]["meuble"],
        surface_m2: n("log_surface"),
        etage: g("log_etage"),
        numero_lot: g("log_lot"),
        annexes: g("log_annexes"),
        equipements_logement: "",
        mode_chauffage: "",
        mode_eau_chaude: "",
        quote_part: "",
        dpe_classe: "",
        dpe_conso: "",
        dpe_ges: "",
        dpe_date: "",
      },
      locataire: {
        locataire_id: selectedLocataireId,
        civilite: "Monsieur",
        nom: g("loc_nom"),
        prenom: g("loc_prenom"),
        date_naissance: g("loc_naissance"),
        lieu_naissance: "",
        telephone: g("loc_tel"),
        email: g("loc_email"),
        situation: g("loc_situation") as Bail["locataire"]["situation"],
        garant_nom: g("loc_garant"),
        date_entree: g("loc_entree"),
        date_sortie: "",
        en_place: true,
      },
      contrat: {
        type_bail: g("bail_type") as Bail["contrat"]["type_bail"],
        date_signature: g("bail_signature"),
        date_debut: g("bail_debut"),
        duree_mois: parseInt(g("bail_duree")) || 12,
        date_fin: g("bail_fin"),
        reconduction_tacite: g("bail_reconduction") === "on",
        depot_garantie: n("bail_depot"),
        indexation_irl: g("bail_irl") === "on",
        trimestre_irl_reference: 0,
        irl_annee: "",
        irl_valeur: "",
        regime_charges: g("bail_type") === "Vide" ? "Provision avec régularisation" : "Forfait",
        travaux_realises: "",
        travaux_prevus: "",
        destination_locaux: "Habitation principale",
        clauses_particulieres: "",
        clauses_resolutoires: [],
        nombre_pieces: "",
      },
      finances: {
        loyer_hc: lhc,
        charges: ch,
        loyer_total: lhc + ch,
        mode_paiement: g("fin_mode") as Bail["finances"]["mode_paiement"],
        date_paiement_prevue: g("fin_date_prevue"),
        locataire_id: selectedLocataireId,
      },
      revisions_loyer: [],
      regularisations_charges: [],
      incidents: [],
      documents: [],
      annexes_bail: [],
      historique_charges: [],
      signatures_contrat: {},
      investissement: {},
      created_at: "",
      updated_at: "",
    };

    saveBail(bail);
    router.push("/baux");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nouveau bail</h1>

      {/* Étapes */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {["Logement", "Locataire", "Contrat", "Finances"].map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i + 1)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              step === i + 1
                ? "bg-blue-600 text-white"
                : step > i + 1
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {/* Erreurs */}
      {erreurs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-red-800 mb-2">L'enregistrement a échoué :</p>
          <ul className="space-y-1">
            {erreurs.map((err, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>
                  {err.message}
                  <button
                    type="button"
                    onClick={() => setStep(err.etape)}
                    className="ml-2 text-red-600 underline hover:text-red-800"
                  >
                    (étape {err.etape})
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
        {/* Étape 1 : Logement */}
        <div className={step === 1 ? "" : "hidden"}>
          <h2 className="text-lg font-semibold mb-4">Informations sur le logement</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input name="log_adresse" required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                <input name="log_cp" required className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input name="log_ville" required className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                <input name="log_pays" defaultValue="France" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de bien</label>
                <select name="log_type" className="w-full border rounded-lg px-3 py-2">
                  {TYPES_BIEN.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meublé / Vide</label>
                <select name="log_meuble" className="w-full border rounded-lg px-3 py-2">
                  <option>Meublé</option>
                  <option>Vide</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
                <input name="log_surface" type="number" step="0.1" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Étage</label>
                <input name="log_etage" placeholder="Ex: 3ème" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot (copropriété)</label>
                <input name="log_lot" placeholder="Optionnel" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annexes</label>
              <input name="log_annexes" placeholder="Ex: parking, cave, balcon..." className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button type="button" onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Suivant
            </button>
          </div>
        </div>

        {/* Étape 2 : Locataire */}
        <div className={step === 2 ? "" : "hidden"}>
          <h2 className="text-lg font-semibold mb-4">Informations sur le locataire</h2>
          <div className="space-y-4">
            {/* Sélecteur locataire existant */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Lier à un locataire existant (les champs seront pré-remplis)
              </label>
              <select
                value={selectedLocataireId}
                onChange={(e) => handleSelectLocataire(e.target.value)}
                className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- Saisir manuellement --</option>
                {locatairesExistants.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.civilite} {l.prenom} {l.nom.toUpperCase()} — {l.adresse_location}, {l.ville_location}
                  </option>
                ))}
              </select>
              {selectedLocataireId && (
                <p className="text-xs text-blue-600 mt-2">
                  Locataire lié. Les données financières et le registre des paiements seront automatiquement connectés.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input name="loc_nom" required value={locNom} onChange={(e) => setLocNom(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input name="loc_prenom" required value={locPrenom} onChange={(e) => setLocPrenom(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance (optionnel)</label>
                <input name="loc_naissance" type="date" value={locNaissance} onChange={(e) => setLocNaissance(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situation</label>
                <select name="loc_situation" value={locSituation} onChange={(e) => setLocSituation(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  {SITUATIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input name="loc_tel" value={locTel} onChange={(e) => setLocTel(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input name="loc_email" type="email" value={locEmail} onChange={(e) => setLocEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du garant (si applicable)</label>
              <input name="loc_garant" value={locGarant} onChange={(e) => setLocGarant(e.target.value)} placeholder="Optionnel" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'entrée</label>
              <input name="loc_entree" type="date" required value={locEntree} onChange={(e) => setLocEntree(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => setStep(1)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300">
              Précédent
            </button>
            <button type="button" onClick={() => setStep(3)} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Suivant
            </button>
          </div>
        </div>

        {/* Étape 3 : Contrat */}
        <div className={step === 3 ? "" : "hidden"}>
          <h2 className="text-lg font-semibold mb-4">Informations sur le contrat</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de bail</label>
                <select name="bail_type" className="w-full border rounded-lg px-3 py-2">
                  {TYPES_BAIL.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de signature</label>
                <input name="bail_signature" type="date" required className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <input name="bail_debut" type="date" required className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (mois)</label>
                <input name="bail_duree" type="number" defaultValue="12" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input name="bail_fin" type="date" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dépôt de garantie (€)</label>
                <input name="bail_depot" type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex flex-col gap-3 pt-6">
                <label className="flex items-center gap-2">
                  <input name="bail_reconduction" type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-700">Reconduction tacite</span>
                </label>
                <label className="flex items-center gap-2">
                  <input name="bail_irl" type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Indexation IRL prévue</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => setStep(2)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300">
              Précédent
            </button>
            <button type="button" onClick={() => setStep(4)} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Suivant
            </button>
          </div>
        </div>

        {/* Étape 4 : Finances */}
        <div className={step === 4 ? "" : "hidden"}>
          <h2 className="text-lg font-semibold mb-4">Données financières</h2>
          <div className="space-y-4">
            {selectedLocataireId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                Montants pré-remplis depuis la fiche locataire. Vous pouvez les modifier.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loyer hors charges (€)</label>
                <input name="loyer_hc" type="number" step="0.01" required value={loyerHC} onChange={(e) => setLoyerHC(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charges (€)</label>
                <input name="charges" type="number" step="0.01" required value={chargesVal} onChange={(e) => setChargesVal(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                <select name="fin_mode" className="w-full border rounded-lg px-3 py-2">
                  {MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {(loyerHC || chargesVal) && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700">
                  Loyer total : <span className="text-lg font-bold text-blue-600">{((parseFloat(loyerHC) || 0) + (parseFloat(chargesVal) || 0)).toFixed(2)} €</span>
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de paiement prévue (jour du mois)</label>
              <input name="fin_date_prevue" placeholder="Ex: 5" className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button type="button" onClick={() => setStep(3)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300">
              Précédent
            </button>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Enregistrer le bail
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
