const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  // Sécurité : token secret pour éviter les appels non autorisés
  const secret = process.env.NOTIFY_SECRET;
  if (req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // On ne traite que les déploiements réussis
  // Vercel envoie un POST avec un body JSON contenant "type"
  if (req.method === 'POST') {
    const body = req.body || {};
    // Si c'est un webhook Vercel, vérifier que c'est un deploy réussi
    if (body.type && body.type !== 'deployment.succeeded') {
      return res.status(200).json({ skipped: true, reason: 'Not a successful deployment' });
    }
  }

  // Lire le dernier article
  let articles = [];
  try {
    const dataPath = path.join(process.cwd(), 'data', 'actualites.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    articles = JSON.parse(raw).articles || [];
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read actualites.json', detail: e.message });
  }

  if (articles.length === 0) {
    return res.status(200).json({ skipped: true, reason: 'No articles' });
  }

  // Dernier article (le plus récent)
  const article = articles.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID || '2', 10);

  // Construire le HTML de l'email
  const imageBlock = article.image
    ? `<img src="${article.image}" alt="${article.title}" style="width:100%;height:auto;display:block;margin-bottom:28px;border:1px solid rgba(200,164,90,0.15);">`
    : '';

  const ctaBlock = article.link
    ? `<a href="${article.link}" style="display:inline-block;font-size:12px;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;color:#C8A45A;text-decoration:none;border-bottom:1px solid rgba(200,164,90,0.5);padding-bottom:3px;">${article.linkLabel || 'Lire la suite'} →</a>`
    : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${article.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b1120;font-family:'DM Sans',Arial,sans-serif;font-weight:300;color:#faf8f4;">
<div style="max-width:600px;margin:0 auto;background-color:#0b1120;">

  <!-- HEADER -->
  <div style="padding:40px 48px 32px;border-bottom:1px solid rgba(200,164,90,0.2);">
    <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#C8A45A;margin-bottom:12px;">Actualité</div>
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:600;color:#faf8f4;letter-spacing:0.02em;">Steve Moradel</div>
  </div>

  <!-- ARTICLE -->
  <div style="padding:40px 48px;">
    ${imageBlock}
    <div style="display:inline-block;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C8A45A;border:1px solid rgba(200,164,90,0.4);padding:4px 12px;margin-bottom:20px;">${article.tag}</div>
    <div style="font-size:12px;color:rgba(250,248,244,0.4);letter-spacing:0.05em;margin-bottom:16px;">${article.dateDisplay}</div>
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:600;line-height:1.3;color:#faf8f4;margin-bottom:20px;letter-spacing:0.01em;">${article.title}</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(250,248,244,0.75);margin-bottom:32px;">${article.text}</p>
    ${ctaBlock}
  </div>

  <div style="height:1px;background:rgba(200,164,90,0.15);margin:0 48px;"></div>

  <!-- FOOTER -->
  <div style="padding:32px 48px 40px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(250,248,244,0.45);margin-bottom:24px;">— Steve Moradel</p>
    <div style="margin-bottom:20px;">
      <a href="https://stevemoradel.com" style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(250,248,244,0.35);text-decoration:none;margin:0 12px;">Site</a>
      <a href="https://stevemoradel.com/#newsletter" style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(250,248,244,0.35);text-decoration:none;margin:0 12px;">Lettre</a>
    </div>
    <p style="font-size:11px;color:rgba(250,248,244,0.25);">
      Vous recevez cet email car vous êtes abonné(e) à la lettre de Steve Moradel.<br>
      <a href="{{unsubscribe}}" style="color:rgba(200,164,90,0.5);">Se désabonner</a>
    </p>
  </div>

</div>
</body>
</html>`;

  // 1. Créer la campagne Brevo
  const campaignRes = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Actualité — ${article.title.substring(0, 50)}`,
      subject: article.title,
      sender: { name: 'Steve Moradel', email: 'info@stevemoradel.com' },
      type: 'classic',
      htmlContent,
      recipients: { listIds: [LIST_ID] },
    }),
  });

  const campaignData = await campaignRes.json();

  if (!campaignRes.ok) {
    return res.status(500).json({ error: 'Campaign creation failed', detail: campaignData });
  }

  const campaignId = campaignData.id;

  // 2. Envoyer immédiatement
  const sendRes = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY },
  });

  if (!sendRes.ok) {
    const sendData = await sendRes.json();
    return res.status(500).json({ error: 'Send failed', detail: sendData });
  }

  return res.status(200).json({
    success: true,
    campaignId,
    article: article.title,
  });
};
