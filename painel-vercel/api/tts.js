// JARVIS RADAR — proxy de voz (ElevenLabs) com diagnóstico
// Voz masculina padrão: Antoni (mais quente/humana que a Adam narradora).
// Para usar a voz clonada do Jorge depois, basta definir ELEVENLABS_VOICE_ID no Vercel — sem mudar código.
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const text = (url.searchParams.get('text') || 'Olá, aqui é o JARVIS.').slice(0, 800);
  const voice = url.searchParams.get('voice') || process.env.ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV'; // Antoni (masculina, natural)
  const debug = url.searchParams.get('debug') === '1';
  const key = process.env.ELEVENLABS_API_KEY;

  // Diagnóstico nos headers (não afeta o usuário)
  res.setHeader('x-tts-haskey', key ? '1' : '0');
  res.setHeader('x-tts-keylen', key ? String(key.length) : '0');

  if (!key) {
    res.setHeader('x-tts-stage', 'no-key');
    res.statusCode = 500;
    return res.end('NO_KEY');
  }

  try {
    const r = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.38, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
        }),
      }
    );

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300).replace(/[\r\n]+/g, ' ');
      console.error('ELEVENLABS_FAIL', r.status, detail);
      res.setHeader('x-tts-stage', 'upstream-error');
      res.setHeader('x-tts-status', String(r.status));
      res.setHeader('x-tts-detail', encodeURIComponent(detail));
      res.statusCode = 502;
      return res.end(debug ? 'UPSTREAM ' + r.status + ' ' + detail : 'tts');
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('x-tts-stage', 'ok');
    res.statusCode = 200;
    return res.end(buf);
  } catch (e) {
    console.error('TTS_EXCEPTION', String(e));
    res.setHeader('x-tts-stage', 'exception');
    res.setHeader('x-tts-detail', encodeURIComponent(String(e)).slice(0, 300));
    res.statusCode = 502;
    return res.end(debug ? 'EXCEPTION ' + String(e) : 'tts');
  }
};
