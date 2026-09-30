const OpenAI = require('openai');

const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
const rand = () => Math.random().toString(36).slice(2, 5);

async function ask(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await new OpenAI({ apiKey: key }).chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Reply ONLY with JSON: {"items":["..."]}' },
        { role: 'user', content: prompt }
      ]
    });
    return JSON.parse(res.choices[0].message.content).items.map(clean).filter(Boolean);
  } catch (e) { console.error('OpenAI error:', e.message); return null; }
}

// Semantic, theme-based slugs for a URL (falls back to URL words if OpenAI is unavailable)
async function suggestSlugs(url, n = 5, avoid = []) {
  const out = await ask(`Suggest ${n} short, memorable, semantic URL slugs (2-4 lowercase words joined by hyphens) that describe the theme of the page at ${url}. Do not use: ${avoid.join(', ') || 'none'}.`);
  if (out && out.length) return out;
  const u = new URL(url);
  const base = clean(u.hostname.replace(/^www\./, '').split('.')[0] + ' ' + u.pathname.split('/').filter(Boolean).slice(0, 2).join(' ')) || 'link';
  return [base, ...Array.from({ length: n - 1 }, () => `${base}-${rand()}`)];
}

// Project-name ideas
async function suggestProjectNames(hint, n = 6) {
  const out = await ask(`Suggest ${n} short, catchy, unique project names (1-3 lowercase words joined by hyphens) for a link collection about: ${hint}.`);
  if (out && out.length) return out;
  const base = clean(hint) || 'my-links';
  return [base, ...Array.from({ length: n - 1 }, () => `${base}-${rand()}`)];
}

module.exports = { clean, suggestSlugs, suggestProjectNames };
