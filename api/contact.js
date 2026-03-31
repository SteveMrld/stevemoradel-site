module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { prenom, nom, email, message } = req.body || {};
  if (!prenom || !nom || !email || !message) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const BREVO_API_KEY = process.env.BREVO_KEY || process.env.BREVO_API_KEY;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: `${prenom} ${nom}`, email: 'info@stevemoradel.com' },
      to: [{ email: 'info@stevemoradel.com', name: 'Steve Moradel' }],
      replyTo: { email, name: `${prenom} ${nom}` },
      subject: `Message de ${prenom} ${nom} — stevemoradel.com`,
      htmlContent: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
          <h2 style="font-size:1.4rem;margin-bottom:1rem;">Nouveau message via stevemoradel.com</h2>
          <p><strong>Nom :</strong> ${prenom} ${nom}</p>
          <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
          <hr style="border:none;border-top:1px solid #ddd;margin:1.5rem 0;">
          <p style="line-height:1.8;white-space:pre-wrap;">${message}</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    return res.status(500).json({ error: 'Envoi échoué', detail: err });
  }

  return res.status(200).json({ success: true });
};
