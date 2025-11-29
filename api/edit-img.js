// api/edit-img.js
require('dotenv').config();
const fetch = require('node-fetch');

// Forbidden words list (multi-language) adapted from user's snippet
const forbiddenWords = [
  "nude","nsfw","18+","sex","porn","erotic","naked","boobs","butt","vagina","penis",
  "breasts","fetish","hentai","xxx","adult","explicit","sensual","bikini","lingerie","swimsuit","swim suit","underwear","under wear","panties","bra","strip","topless","thong","wet","aroused","lewd","bdsm","kinky","latex","dominatrix","cosplay sexy","seductive","provocative","tank top","tanktop","crop top","croptop","tube top","tubetop","halter top","haltertop","sports bra","sportsbra","sheer top","sheertop","lace top","lacetop","fishnet top","fishnettop","see through","seethrough","mesh top","meshtop","deep v","deepv","plunge top","plungetop","nightwear","night wear","nights wear","shirt","suit","apron","pants","office lady","beach girl",
  // Spanish
  "desnudo","porno","erótico","pechos","culo","vagina","pene","adulto","top tanque","toptanque","top corto","topcorto","top tubo","toptubo","top halter","tophalter","sujetador deportivo","sujetadordeportivo","top transparente","toptransparente","top encaje","topencaje","top de red","topdered","ver a través","veratraves","top de malla","topdemalla","v profundo","vprofundo","top escotado","topescotado",
  // French
  "nu","sexe","érotique","seins","cul","vagin","pénis","adulte","débardeur","débardeurcourt","haut tube","hauttube","haut halter","hauthalter","soutien-gorge de sport","soutiengorgedesport","haut transparent","hauttransparent","haut en dentelle","hautendentelle","haut en filet","hautenfilet","voir à travers","voiràtravers","haut en maille","hautenmaille","col en v profond","colenvprofond","haut plongeant","hautplongeant",
  // Mandarin (simplified)
  "裸体","色情","胸部","屁股","阴道","阴茎","成人","背心","背心短款","抹胸","抹胸衣","吊带衫","吊带衣","运动文胸","运动胸罩","透明上衣","透明衣服","蕾丝上衣","蕾丝衣","网状上衣","网状衣服","透视","透视衣","深V","深V衣","低胸上衣","低胸衣",
  // Russian
  "нагота","порно","эротика","грудь","задница","влагалище","пенис","взрослый","майка","майкакороткая","топ-труба","топтруба","халтер-топ","халтертоп","спортивный бюстгальтер","спортивныйбюстгальтер","прозрачный топ","прозрачныйтоп","кружевной топ","кружевнойтоп","сетка топ","сеткатоп","просвечивающий","просвечивающийтоп","глубокий v","глубокийv","глубокий вырез","глубокийвырез",
  // Indonesian
  "berbugil","bokep","payudara","bokong","celana dalam","bra seksi","setengah telanjang","tank top","tanktop","crop top","croptop","tube top","tubetop","halter top","haltertop","bra olahraga","braolahraga","atasan transparan","atasantransparan","atasan renda","atasanrenda","atasan jaring","atasanjaring","lihat melalui","lihatmelalui","atasan mesh","atasanmesh","V dalam","Vdalam","atasan belahan dada","atasanbelahandada"
];

// Simple helper to check premium keys
const PREMIUM_KEYS = (process.env.PREMIUM_KEYS || '').split(',').filter(Boolean);
function isPremium(apiKey) {
  if (!apiKey) return false;
  return PREMIUM_KEYS.includes(apiKey);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = req.headers['x-api-key'] || '';
    if (!isPremium(apiKey)) {
      return res.status(403).json({ error: 'Feature for premium users only. Provide x-api-key header.' });
    }

    const { image_url: imageUrl, prompt } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: 'image_url is required' });
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    if (!/^[a-zA-Z\s]+$/.test(prompt)) {
      return res.status(400).json({ error: 'Teks hanya boleh berisi huruf alfabet (A-Z atau a-z) dan spasi saja!' });
    }

    const lower = prompt.toLowerCase();
    if (forbiddenWords.some(w => lower.includes(w))) {
      return res.status(400).json({ error: 'Mohon prompt tidak mengandung unsur dewasa🙏' });
    }

    // download image
    const fetched = await fetch(imageUrl);
    if (!fetched.ok) return res.status(400).json({ error: 'Gagal mengunduh gambar dari URL' });
    const mime = fetched.headers.get('content-type') || '';
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'URL harus mengarah ke file gambar' });
    }
    const arrayBuffer = await fetched.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Call Google Generative AI (Gemini)
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server not configured: GEMINI_API_KEY missing. Set it in Vercel env vars.' });
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      global.gemini = process.env.GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(global.gemini);

      const contents = [
        { text: prompt },
        { inlineData: { mimeType: mime, data: base64Image } }
      ];

      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp-image-generation",
        generationConfig: { responseModalities: ["Text","Image"] },
      });

      const aiResp = await model.generateContent(contents);
      const candidate = aiResp?.response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      let resultBuffer = null;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          resultBuffer = Buffer.from(part.inlineData.data, 'base64');
          break;
        }
      }
      if (!resultBuffer) {
        return res.status(500).json({ error: 'Gagal mendapatkan gambar dari AI' });
      }

      // Return as base64 to the client (Vercel-friendly)
      return res.json({
        ok: true,
        image_base64: resultBuffer.toString('base64'),
        mime
      });
    } catch (err) {
      console.error('AI error', err);
      return res.status(500).json({ error: 'Gagal memproses permintaan ke AI' });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
