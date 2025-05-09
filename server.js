require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const qna = require('./qna'); // Your QnA map

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DG_URL = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&vad_events=true';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

wss.on('connection', (client) => {
  console.log('🔌 Browser connected');

  const dgSocket = new WebSocket(DG_URL, {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      Origin: 'http://localhost'
    }
  });

  dgSocket.binaryType = 'arraybuffer';

  client.on('message', (chunk) => {
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(chunk);
    }
  });

  dgSocket.on('message', async (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.channel?.alternatives?.[0]?.transcript && data.speech_final) {
      const userText = data.channel.alternatives[0].transcript.toLowerCase().trim();
      console.log('🧠 Transcript:', userText);

      // Match from QnA
      let answer = qna[userText];
      if (!answer) {
        const matchedKey = Object.keys(qna).find(q => userText.includes(q));
        answer = matchedKey ? qna[matchedKey] : "Sorry, I don't know the answer to that yet.";
      }

      // Send transcript + answer back to browser
      client.send(JSON.stringify({ transcript: userText, answer }));

      // TTS the answer
      try {
        const ttsRes = await fetch(
          'https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${DEEPGRAM_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: answer })
          }
        );

        const ttsAudio = await ttsRes.arrayBuffer();
        client.send(ttsAudio);
        console.log('🔊 Sent TTS audio');
      } catch (err) {
        console.error('❌ TTS error:', err);
      }
    }
  });

  client.on('close', () => {
    console.log('❌ Browser disconnected');
    dgSocket.close();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
