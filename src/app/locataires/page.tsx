"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locataire } from "@/lib/types";
import { getLocataires, saveLocataire, deleteLocataire } from "@/lib/store";

const EMPTY_LOCATAIRE: Omit<Locataire, "id" | "proprietaire_id" | "created_at" | "updated_at"> = {
  civilite: "Madame",
  nom: "",
  prenom: "",
  adresse_location: "",
  code_postal_location: "",
  ville_location: "",
  pays_location: "France",
  loyer: 0,
  charges: 0,
  date_debut_bail: "",
  actif: true,
};

export default function LocatairesPage() {
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [editing, setEditing] = useState<Locataire | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLocataires(getLocataires());
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const locataire: Locataire = {
      id: editing?.id || crypto.randomUUID(),
      proprietaire_id: "1",
      civilite: form.get("civilite") as Locataire["civilite"],
      nom: form.get("nom") as string,
      prenom: form.get("prenom") as string,
      adresse_location: form.get("adresse_location") as string,
      code_postal_location: form.get("code_postal_location") as string,
      ville_location: form.get("ville_location") as string,
      pays_location: form.get("pays_location") as string,
      loyer: parseFloat(form.get("loyer") as string),
      charges: parseFloat(form.get("charges") as string),
      date_debut_bail: form.get("date_debut_bail") as string,
      actif: true,
      created_at: editing?.created_at || "",
      updated_at: "",
    };

    saveLocataire(locataire);
    setLocataires(getLocataires());
    setShowForm(false);
    setEditing(null);
  }

  function handleDelete(id: string) {
    if (confirm("Supprimer ce locataire ?")) {
      deleteLocataire(id);
      setLocataires(getLocataires());
    }
  }

  function handleEdit(loc: Locataire) {
    setEditing(loc);
    setShowForm(true);
  }

  const formData = editing || EMPTY_LOCATAIRE;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Locataires</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(!showForm); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? "Annuler" : "+ Ajouter"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Civilité</label>
              <select name="civilite" defaultValue={formData.civilite} className="w-full border rounded-lg px-3 py-2">
                <option>Madame</option>
                <option>Monsieur</option>
                <option>Madame et Monsieur</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input name="nom" defaultValue={formData.nom} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input name="prenom" defaultValue={formData.prenom} required className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de la location</label>
            <input name="adresse_location" defaultValue={formData.adresse_location} required className="w-full border rounded-lg px-3 py-2" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input name="code_postal_location" defaultValue={formData.code_postal_location} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input name="ville_location" defaultValue={formData.ville_location} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
              <input name="pays_location" defaultValue={formData.pays_location} required className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loyer (euros)</label>
              <input name="loyer" type="number" step="0.01" defaultValue={formData.loyer || ""} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Charges (euros)</label>
              <input name="charges" type="number" step="0.01" defaultValue={formData.charges || ""} required className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début du bail</label>
              <input name="date_debut_bail" type="date" defaultValue={formData.date_debut_bail} required className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>

          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            {editing ? "Modifier" : "Ajouter le locataire"}
          </button>
        </form>
      )}

      {/* Liste des locataires */}
      <div className="space-y-3">
        {locataires.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            Aucun locataire enregistré.
            <br />
            Cliquez sur "+ Ajouter" pour commencer.
          </div>
        ) : (
          locataires.map((loc) => (
            <div key={loc.id} className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {loc.civilite} {loc.prenom} {loc.nom.toUpperCase()}
                  {!loc.actif && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactif</span>}
                </p>
                <p className="text-sm text-gray-500">{loc.adresse_location}, {loc.ville_location}</p>
                <p className="text-sm text-gray-500">Loyer : {loc.loyer} € + {loc.charges} € de charges</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/locataires/${loc.id}/registre`}
                  className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
                >
                  Registre
                </Link>
                <Link
                  href={`/quittances/nouvelle?locataire=${loc.id}`}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200"
                >
                  Quittance
                </Link>
                <button
                  onClick={() => handleEdit(loc)}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(loc.id)}
                  className="text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
