import { jsPDF } from "jspdf";
import arialFonts from "./arial-fonts.json";

let registered = false;

export function registerArial(doc: jsPDF) {
  if (!registered) {
    doc.addFileToVFS("arial.ttf", (arialFonts as Record<string, string>)["arial.ttf"]);
    doc.addFont("arial.ttf", "arial", "normal");

    doc.addFileToVFS("arialbd.ttf", (arialFonts as Record<string, string>)["arialbd.ttf"]);
    doc.addFont("arialbd.ttf", "arial", "bold");

    doc.addFileToVFS("ariali.ttf", (arialFonts as Record<string, string>)["ariali.ttf"]);
    doc.addFont("ariali.ttf", "arial", "italic");

    doc.addFileToVFS("arialbi.ttf", (arialFonts as Record<string, string>)["arialbi.ttf"]);
    doc.addFont("arialbi.ttf", "arial", "bolditalic");

    registered = true;
  }
  doc.setFont("arial", "normal");
}
