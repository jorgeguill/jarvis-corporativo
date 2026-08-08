// JARVIS RADAR — proxy de voz (ElevenLabs) robusto, com diagnóstico.
// Estratégia: tenta a voz natural preferida; se falhar, cai para uma voz
// masculina comprovada (Adam) — nunca deixa cair na voz mecânica do navegador.
// Para usar a voz clonada do Jorge depois: defina ELEVENLABS_VOICE_ID no Vercel.
const ADAM = 'pNInz6obpgDQGcFmaJgB';   // masculina, comprovada nesta conta
const ANTONI = 'ErXwobaYiN019PkySvjV'; // masculina, mais quente/natural

async function tryVoice(key, voice, model, text) {
  try {
    const r = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true },
        }),
      }
    );
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 200).replace(/[\r\n]+/g, ' ');
      return { ok: false, status: r.status, detail };
    }
    return { ok: true, buf: Buffer.from(await r.arrayBuffer()) };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e).slice(0, 200) };
  }
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const text = (url.searchParams.get('text') || 'Olá, aqui é o JARVIS.').slice(0, 800);
  const forced = url.searchParams.get('voice');
  const debug = url.searchParams.get('debug') === '1';
  const key = process.env.ELEVENLABS_API_KEY;

  res.setHeader('x-tts-haskey', key ? '1' : '0');
  if (!key) {
    res.setHeader('x-tts-stage', 'no-key');
    res.statusCode = 500;
    return res.end('NO_KEY');
  }

  // Ordem de tentativa: voz forçada (query) > voz do ambiente > Antoni > Adam.
  // Modelo estável eleven_flash_v2_5 (comprovado nesta conta).
  const preferred = forced || process.env.ELEVENLABS_VOICE_ID || ANTONI;
  const chain = [];
  chain.push(preferred);
  if (!chain.includes(ANTONI)) chain.push(ANTONI);
  if (!chain.includes(ADAM)) chain.push(ADAM);

  const tried = [];
  for (const voice of chain) {
    const out = await tryVoice(key, voice, 'eleven_flash_v2_5', text);
    if (out.ok) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('x-tts-stage', 'ok');
      res.setHeader('x-tts-voice', voice);
      res.statusCode = 200;
      return res.end(out.buf);
    }
    tried.push(voice + ':' + out.status + ':' + out.detail);
    console.error('ELEVENLABS_FAIL', voice, out.status, out.detail);
  }

  res.setHeader('x-tts-stage', 'all-failed');
  res.setHeader('x-tts-detail', encodeURIComponent(tried.join(' | ')).slice(0, 400));
  res.statusCode = 502;
  return res.end(debug ? 'ALL_FAILED ' + tried.join(' | ') : 'tts');
};
