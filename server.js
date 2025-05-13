require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const qna = require('./qna'); // Your QnA map

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DG_URL = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&utterances=true&punctuate=true&model=base&smart_format=true';

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

  client.on('message', async (chunk) => {
  if (typeof chunk === 'string' || chunk instanceof Buffer) {
    try {
      const msg = JSON.parse(chunk.toString());
      console.log(msg)
      if (msg.welcome) {
        const welcomeText = "Hello! I am your custom test voice chat assistant. I have been created by Soumya. How can I help you today?";
        // ✅ Force JSON string to be treated as UTF-8 text frame
        const welcomeJSON = JSON.stringify({ transcript: "", answer: welcomeText });
       
        // Wait before sending text to browser client.send(JSON.stringify({ transcript: userText, answer }));
        setTimeout(() => {
          client.send(welcomeJSON, { binary: false }, (err) => {
            if (err) return console.error("❌ Failed to send welcome JSON:", err);
            console.log("✅ Welcome JSON sent");

            fetch(  
              'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=mp3',
              {
                method: 'POST',
                headers: {
                  Authorization: `Token ${DEEPGRAM_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: welcomeText }),
              }
            )
            .then((res) => res.arrayBuffer())
            .then((audioBuffer) => {
              setTimeout(() => {
               
                client.send(Buffer.from(audioBuffer), { binary: true }, (err) => {
                  if (err) console.error("❌ Failed to send audio:", err);
                  else console.log("✅ Welcome audio sent");
                });


              }, 50); // Extra small delay between text & audio
              client.send(welcomeJSON)
            });
          });
        }, 50); // Delay ensures socket is ready



        // client.send(welcomeJson, { binary: false }, (err) => {
        //   if (err) console.error("❌ Error sending welcome JSON:", err);
        //   else console.log("✅ Welcome text sent");
        // });
       

        // // TTS from Deepgram
        // const ttsRes = await fetch(
        //   'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=mp3',
        //   {
        //     method: 'POST',
        //     headers: {
        //       Authorization: `Token ${DEEPGRAM_API_KEY}`,
        //       'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ text: welcomeText })
        //   }
        // );
        // const ttsAudio = await ttsRes.arrayBuffer();
        //  // Send text to frontend
       
        // client.send(ttsAudio);
        // console.log("👋 Sent welcome message + TTS");



        // 🔄 Wait just a few ms to ensure JSON is flushed
        // setTimeout(async () => {
        //   const ttsRes = await fetch(
        //     'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=mp3',
        //     {
        //       method: 'POST',
        //       headers: {
        //         Authorization: `Token ${DEEPGRAM_API_KEY}`,
        //         'Content-Type': 'application/json'
        //       },
        //       body: JSON.stringify({ text: welcomeText })
        //     }
        //   );
        //   const audioBuffer = await ttsRes.arrayBuffer();
        //   // ✅ Send audio as binary
        //   client.send(Buffer.from(audioBuffer), { binary: true }, (err) => {
        //     if (err) console.error("❌ Error sending audio:", err);
        //     else console.log("✅ Welcome audio sent");
        //   });
        //   console.log("✅ Welcome text and audio sent");
        // }, 300); // 🔁 100ms delay

        
        return;
      }
    } catch (err) {
      // Binary audio chunk (not JSON)
    }

    // Send audio to Deepgram
    if (dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(chunk);
    }
  }
});


  dgSocket.on('message', async (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.channel?.alternatives?.[0]?.transcript && data.speech_final) {
      const userText = data.channel.alternatives[0].transcript.toLowerCase().trim();
      console.log('🧠 Transcript:', userText);
      const transcript=userText
      // // Match from QnA
      // let answer = qna[userText];
      // if (!answer) {
      //   const matchedKey = Object.keys(qna).find(q => userText.includes(q));
      //   answer = matchedKey ? qna[matchedKey] : "Sorry, I don't know the answer to that yet.";
      // }
      const result = await fetch("http://localhost:5001/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      })
      .then(res => res.json());
      console.log(result)
      const answer = result.answer || "Sorry, I don't know the answer to that yet.";
      // Send transcript + answer back to browser
      client.send(JSON.stringify({ transcript: userText, answer }));
      const ttsBody = {
        text: answer,
        speed: 1.0,       // 🔁 0.5 = slow, 2.0 = fast
        pitch: 0.0,       // 🔁 -12 = deep, +12 = high
        volume: 0.0       // 🔁 -96 to +16
      };

      // TTS the answer
      try {
        const ttsRes = await fetch(
          'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=mp3',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${DEEPGRAM_API_KEY}`,
              'Content-Type': 'application/json'
            },
            // body: JSON.stringify({ text: answer })
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
