const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = [
  "", "dix", "vingt", "trente", "quarante", "cinquante",
  "soixante", "soixante", "quatre-vingt", "quatre-vingt",
];

function convertirBloc(n: number): string {
  if (n === 0) return "";
  if (n < 20) return UNITES[n];

  const dizaine = Math.floor(n / 10);
  const unite = n % 10;

  if (dizaine === 7 || dizaine === 9) {
    const base = DIZAINES[dizaine];
    const reste = n - dizaine * 10 + 10;
    if (reste === 11 && dizaine === 7) return base + " et onze";
    return base + "-" + UNITES[reste];
  }

  if (unite === 0) {
    if (dizaine === 8) return "quatre-vingts";
    return DIZAINES[dizaine];
  }

  if (unite === 1 && dizaine !== 8) {
    return DIZAINES[dizaine] + " et un";
  }

  return DIZAINES[dizaine] + "-" + UNITES[unite];
}

function convertirCentaines(n: number): string {
  if (n === 0) return "";
  if (n < 100) return convertirBloc(n);

  const centaines = Math.floor(n / 100);
  const reste = n % 100;

  let result = "";
  if (centaines === 1) {
    result = "cent";
  } else {
    result = UNITES[centaines] + " cent";
  }

  if (reste === 0 && centaines > 1) {
    return result + "s";
  }

  if (reste > 0) {
    result += " " + convertirBloc(reste);
  }

  return result;
}

export function nombreEnLettres(n: number): string {
  if (n === 0) return "zéro";

  const entier = Math.floor(n);
  const decimales = Math.round((n - entier) * 100);

  let result = "";

  if (entier >= 1000000) {
    const millions = Math.floor(entier / 1000000);
    const reste = entier % 1000000;
    if (millions === 1) {
      result = "un million";
    } else {
      result = convertirCentaines(millions) + " millions";
    }
    if (reste > 0) result += " " + nombreEnLettresEntier(reste);
  } else {
    result = nombreEnLettresEntier(entier);
  }

  if (decimales > 0) {
    result += " euros et " + nombreEnLettresEntier(decimales) + " centimes";
  } else {
    result += " euros";
  }

  return result;
}

function nombreEnLettresEntier(n: number): string {
  if (n === 0) return "";
  if (n < 1000) return convertirCentaines(n);

  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;

  let result = "";
  if (milliers === 1) {
    result = "mille";
  } else {
    result = convertirCentaines(milliers) + " mille";
  }

  if (reste > 0) {
    result += " " + convertirCentaines(reste);
  }

  return result;
}
