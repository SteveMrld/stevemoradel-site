const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  let articles = [];
  try {
    const dataPath = path.join(process.cwd(), 'data', 'actualites.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    articles = JSON.parse(raw).articles || [];
  } catch (e) {
    articles = [];
  }

  const items = articles
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(article => {
      const pubDate = new Date(article.date).toUTCString();
      const imageTag = article.image
        ? `<enclosure url="${article.image}" type="image/jpeg" length="0"/>`
        : '';
      return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <description><![CDATA[${article.text}${article.link ? ` <a href="${article.link}">${article.linkLabel || 'Lire la suite'} →</a>` : ''}]]></description>
      <link>${article.link || 'https://stevemoradel.com/#actualites'}</link>
      <guid isPermaLink="false">${article.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${article.tag}</category>
      ${imageTag}
    </item>`;
    })
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Steve Moradel — Actualités</title>
    <link>https://stevemoradel.com</link>
    <description>Actualités de Steve Moradel — auteur, entrepreneur, stratège, prospectiviste.</description>
    <language>fr</language>
    <atom:link href="https://stevemoradel.com/api/rss" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://stevemoradel.com/favicon.ico</url>
      <title>Steve Moradel</title>
      <link>https://stevemoradel.com</link>
    </image>
    ${items}
  </channel>
</rss>`;

  res.status(200).send(rss);
};
