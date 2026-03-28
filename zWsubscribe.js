export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_LIST_ID || '2', 10);
  if (!apiKey) return res.status(500).json({ error: 'Configuration manquante' });
  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ email: email.toLowerCase().trim(), listIds: [listId], updateEnabled: true }),
    });
    if (response.status === 201 || response.status === 204) return res.status(200).json({ success: true });
    const data = await response.json();
    if (data?.code === 'duplicate_parameter') return res.status(200).json({ success: true, already: true });
    return res.status(500).json({ error: 'Erreur Brevo' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
