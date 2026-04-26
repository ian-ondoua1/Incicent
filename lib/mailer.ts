import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? "noreply@incident-portal.cm";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body{font-family:'Outfit',Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px}
  .card{background:#fff;border-radius:8px;max-width:560px;margin:0 auto;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .logo{font-size:18px;font-weight:700;color:#0a0a0a;margin-bottom:24px}
  h2{font-size:20px;font-weight:700;color:#0a0a0a;margin:0 0 8px}
  p{font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 12px}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .btn{display:inline-block;margin-top:20px;padding:10px 24px;background:#0a0a0a;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500}
  .footer{text-align:center;font-size:12px;color:#9ca3af;margin-top:32px}
  hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
</style></head>
<body><div class="card">
  <div class="logo">Incident Portal — ETS MARCEL RECORDZ</div>
  ${content}
  <div class="footer">Cet email a été envoyé automatiquement. Ne pas répondre.</div>
</div></body></html>`;
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#6b7280", MEDIUM: "#3b82f6", HIGH: "#f59e0b", CRITICAL: "#ef4444",
};

export async function sendIncidentCreatedEmail({
  to, incidentId, title, priority, agency, createdBy,
}: {
  to: string[]; incidentId: string; title: string;
  priority: string; agency: string; createdBy: string;
}) {
  if (!process.env.SMTP_USER || to.length === 0) return;

  const color = PRIORITY_COLOR[priority] ?? "#6b7280";
  const html = baseTemplate(`
    <h2>Nouvel incident signalé</h2>
    <p>Un incident vient d'être créé et nécessite votre attention.</p>
    <hr>
    <p><strong>Titre :</strong> ${title}</p>
    <p><strong>Agence :</strong> ${agency}</p>
    <p><strong>Signalé par :</strong> ${createdBy}</p>
    <p><strong>Priorité :</strong> <span class="badge" style="background:${color}20;color:${color}">${priority}</span></p>
    <a href="${BASE_URL}/incidents/${incidentId}" class="btn">Voir l'incident</a>
  `);

  await transporter.sendMail({
    from: FROM, to: to.join(","),
    subject: `[${priority}] Nouvel incident : ${title}`,
    html,
  });
}

export async function sendStatusChangedEmail({
  to, incidentId, title, oldStatus, newStatus, changedBy,
}: {
  to: string[]; incidentId: string; title: string;
  oldStatus: string; newStatus: string; changedBy: string;
}) {
  if (!process.env.SMTP_USER || to.length === 0) return;

  const html = baseTemplate(`
    <h2>Statut d'incident mis à jour</h2>
    <p>Le statut d'un incident a changé.</p>
    <hr>
    <p><strong>Incident :</strong> ${title}</p>
    <p><strong>Ancien statut :</strong> ${oldStatus}</p>
    <p><strong>Nouveau statut :</strong> <strong>${newStatus}</strong></p>
    <p><strong>Modifié par :</strong> ${changedBy}</p>
    <a href="${BASE_URL}/incidents/${incidentId}" class="btn">Voir l'incident</a>
  `);

  await transporter.sendMail({
    from: FROM, to: to.join(","),
    subject: `Incident mis à jour : ${title} → ${newStatus}`,
    html,
  });
}

export async function sendSlaBreachEmail({
  to, incidentId, title, priority, agency,
}: {
  to: string[]; incidentId: string; title: string; priority: string; agency: string;
}) {
  if (!process.env.SMTP_USER || to.length === 0) return;

  const html = baseTemplate(`
    <h2 style="color:#ef4444">⚠️ SLA dépassé</h2>
    <p>Le délai de résolution SLA a été dépassé pour l'incident suivant :</p>
    <hr>
    <p><strong>Titre :</strong> ${title}</p>
    <p><strong>Agence :</strong> ${agency}</p>
    <p><strong>Priorité :</strong> ${priority}</p>
    <p>Veuillez traiter cet incident en urgence.</p>
    <a href="${BASE_URL}/incidents/${incidentId}" class="btn" style="background:#ef4444">Traiter maintenant</a>
  `);

  await transporter.sendMail({
    from: FROM, to: to.join(","),
    subject: `🚨 SLA dépassé [${priority}] : ${title}`,
    html,
  });
}
