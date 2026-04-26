import * as XLSX from "xlsx";

type Incident = {
  id: string; title: string; status: string; priority: string;
  category?: string | null; createdAt: string; resolvedAt?: string | null;
  slaBreached: boolean; creator: { name: string }; agency: { name: string; city: string };
};

function formatRows(incidents: Incident[]) {
  return incidents.map((inc) => ({
    "ID": inc.id,
    "Titre": inc.title,
    "Statut": inc.status,
    "Priorité": inc.priority,
    "Catégorie": inc.category ?? "",
    "Agence": inc.agency.name,
    "Ville": inc.agency.city,
    "Créé par": inc.creator.name,
    "Date création": new Date(inc.createdAt).toLocaleString("fr-FR"),
    "Date résolution": inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString("fr-FR") : "",
    "SLA dépassé": inc.slaBreached ? "Oui" : "Non",
  }));
}

export function exportToCSV(incidents: Incident[], filename = "incidents") {
  const rows = formatRows(incidents);
  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => `"${(r as Record<string, string>)[h] ?? ""}"`).join(";")),
  ].join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(incidents: Incident[], filename = "incidents") {
  const rows = formatRows(incidents);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  // Style colonnes
  ws["!cols"] = [
    { wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 12 },
    { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Incidents");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(incidents: Incident[], filename = "incidents") {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Rapport des Incidents — ETS MARCEL RECORDZ", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [["Titre", "Statut", "Priorité", "Agence", "Créé par", "Date", "SLA"]],
    body: incidents.map((inc) => [
      inc.title.slice(0, 50),
      inc.status,
      inc.priority,
      `${inc.agency.name} — ${inc.agency.city}`,
      inc.creator.name,
      new Date(inc.createdAt).toLocaleDateString("fr-FR"),
      inc.slaBreached ? "⚠️ Dépassé" : "✓ OK",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [10, 10, 10] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}.pdf`);
}
