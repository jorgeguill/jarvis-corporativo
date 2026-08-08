// JARVIS RADAR — proxy de voz (ElevenLabs) robusto, com diagnóstico.
// Tenta a melhor qualidade (multilingual_v2) e, se falhar, cai para flash_v2_5;
// tenta a voz preferida e, se falhar, cai para vozes masculinas comprovadas.
// Nunca deixa cair na voz mecânica do navegador (a menos que falte a chave).
// Voz clonada do Jorge no futuro: defina ELEVENLABS_VOICE_ID no Vercel.
const ADAM = 'pNInz6obpgDQGcFmaJgB';   // masculina, comprovada nesta conta
const ANTONI = 'ErXwobaYiN019PkySvjV'; // masculina, mais quente
const MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5'];

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
          voice_settings: { stability: 0.3, similarity_boost: 0.9, style: 0.45, use_speaker_boost: true },
        }),
      }
    );
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 180).replace(/[\r\n]+/g, ' ');
      return { ok: false, status: r.status, detail };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf || buf.length < 200) return { ok: false, status: 200, detail: 'audio vazio' };
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, status: 0, detail: String(e).slice(0, 180) };
  }
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const text = (url.searchParams.get('text') || 'Olá, aqui é o JARVIS.').slice(0, 800);
  const forced = url.searchParams.get('voice');
  const debug = url.searchParams.get('debug') === '1';
  const key = process.env.ELEVENLABS_API_KEY;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('x-tts-haskey', key ? '1' : '0');
  if (!key) {
    res.setHeader('x-tts-stage', 'no-key');
    res.statusCode = 500;
    return res.end('NO_KEY');
  }

  const preferred = forced || process.env.ELEVENLABS_VOICE_ID || ANTONI;
  const voices = [preferred];
  if (!voices.includes(ANTONI)) voices.push(ANTONI);
  if (!voices.includes(ADAM)) voices.push(ADAM);

  const tried = [];
  for (const voice of voices) {
    for (const model of MODELS) {
      const out = await tryVoice(key, voice, model, text);
      if (out.ok) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('x-tts-stage', 'ok');
        res.setHeader('x-tts-voice', voice);
        res.setHeader('x-tts-model', model);
        res.statusCode = 200;
        return res.end(out.buf);
      }
      tried.push(voice.slice(0, 6) + '/' + model.replace('eleven_', '') + ':' + out.status);
      console.error('ELEVENLABS_FAIL', voice, model, out.status, out.detail);
    }
  }

  res.setHeader('x-tts-stage', 'all-failed');
  res.setHeader('x-tts-detail', encodeURIComponent(tried.join(' | ')).slice(0, 400));
  res.statusCode = 502;
  return res.end(debug ? 'ALL_FAILED ' + tried.join(' | ') : 'tts');
};
