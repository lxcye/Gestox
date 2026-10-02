import { jsPDF } from "jspdf";
import arialFonts from "./arial-fonts.json";

let vfsRegistered = false;

export function registerArial(doc: jsPDF) {
  if (!vfsRegistered) {
    doc.addFileToVFS("arial.ttf", (arialFonts as Record<string, string>)["arial.ttf"]);
    doc.addFileToVFS("arialbd.ttf", (arialFonts as Record<string, string>)["arialbd.ttf"]);
    doc.addFileToVFS("ariali.ttf", (arialFonts as Record<string, string>)["ariali.ttf"]);
    doc.addFileToVFS("arialbi.ttf", (arialFonts as Record<string, string>)["arialbi.ttf"]);
    vfsRegistered = true;
  }

  doc.addFont("arial.ttf", "arial", "normal");
  doc.addFont("arialbd.ttf", "arial", "bold");
  doc.addFont("ariali.ttf", "arial", "italic");
  doc.addFont("arialbi.ttf", "arial", "bolditalic");

  doc.setFont("arial", "normal");
}
