const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const secret = process.env.NOTIFY_SECRET;
  if (req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const BREVO_API_KEY = process.env.BREVO_KEY || process.env.BREVO_API_KEY;

  // Récupérer automatiquement l'ID de la liste Stevemoradel
  let LIST_ID = null;
  try {
    const listsRes = await fetch('https://api.brevo.com/v3/contacts/lists?limit=50', {
      headers: { 'api-key': BREVO_API_KEY }
    });
    const listsData = await listsRes.json();
    const lists = listsData.lists || [];
    const match = lists.find(l => l.name && l.name.toLowerCase().includes('stevemoradel'));
    if (match) LIST_ID = match.id;
    else if (lists.length > 0) LIST_ID = lists[0].id;
  } catch(e) {}

  if (!LIST_ID) {
    return res.status(500).json({ error: 'Brevo list not found' });
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

  const article = articles.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const imageBlock = article.image
    ? `<img src="${article.image}" alt="${article.title}" style="width:100%;height:auto;display:block;margin-bottom:28px;">`
    : '';

  const ctaBlock = article.link
    ? `<a href="${article.link}" style="display:inline-block;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#C8A45A;text-decoration:none;border-bottom:1px solid rgba(200,164,90,0.5);padding-bottom:3px;">${article.linkLabel || 'Lire la suite'} →</a>`
    : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0b1120;font-family:Arial,sans-serif;color:#faf8f4;">
<div style="max-width:600px;margin:0 auto;background-color:#0b1120;">
  <div style="padding:40px 48px 32px;border-bottom:1px solid rgba(200,164,90,0.2);">
    <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#C8A45A;margin-bottom:12px;">Actualité</div>
    <div style="font-family:Georgia,serif;font-size:28px;color:#faf8f4;">Steve Moradel</div>
  </div>
  <div style="padding:40px 48px;">
    ${imageBlock}
    <div style="display:inline-block;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#C8A45A;border:1px solid rgba(200,164,90,0.4);padding:4px 12px;margin-bottom:20px;">${article.tag}</div>
    <div style="font-size:12px;color:rgba(250,248,244,0.4);margin-bottom:16px;">${article.dateDisplay}</div>
    <h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.3;color:#faf8f4;margin-bottom:20px;">${article.title}</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(250,248,244,0.75);margin-bottom:32px;">${article.text}</p>
    ${ctaBlock}
  </div>
  <div style="height:1px;background:rgba(200,164,90,0.15);margin:0 48px;"></div>
  <div style="padding:32px 48px 40px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(250,248,244,0.45);margin-bottom:24px;">— Steve Moradel</p>
    <p style="font-size:11px;color:rgba(250,248,244,0.25);">
      Vous recevez cet email car vous êtes abonné(e) à la lettre de Steve Moradel.<br>
      <a href="{{unsubscribe}}" style="color:rgba(200,164,90,0.5);">Se désabonner</a>
    </p>
  </div>
</div>
</body></html>`;

  const campaignRes = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
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

  const sendRes = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY },
  });

  if (!sendRes.ok) {
    const sendData = await sendRes.json();
    return res.status(500).json({ error: 'Send failed', detail: sendData });
  }

  return res.status(200).json({ success: true, campaignId, article: article.title, listId: LIST_ID });
};
