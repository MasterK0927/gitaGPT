import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
dotenv.config();

let logs=[]; // Array to store logs

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '-', // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const MAX_LOGS = 5; // Maximum number of logs to keep

app.get("/logs", async (req, res) => {
  const logsToSend = logs.slice(-MAX_LOGS); // Get the last MAX_LOGS logs
  res.json(logsToSend); // Send the logs array as JSON response
});

app.get("/clearlogs", async (req, res) => {
  logs.splice(0, logs.length - MAX_LOGS); // Remove all logs except the last MAX_LOGS
  res.sendStatus(200); // Send a success response
});

app.get("/voices", async (req, res) => {
  // No need to retrieve voices for OpenAI TTS
  res.send([]);
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  logs.push(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  logs.push(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    ` .\\bin\\rhubarb.exe -f json -o "audios/message_${message}.json" "audios/message_${message}.wav" -r phonetic`
  );
  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
  logs.push(`Lip sync done in ${new Date().getTime() - time}ms`);
};

const main = async (textInput, fileName) => {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: textInput,
    speed: 0.9,
  });
  console.log(fileName);
  logs.push(fileName);
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.writeFile(fileName, buffer);
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body?.message;
  if (!userMessage) {
    // Handle case when no user message is provided
    return res.send({
      messages: [
        {
          text: "Devotee, Radhe Radhe! I am your Bhagwat Gita based Advice giver. Ask me anything.",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I can help you with your problems and give you advice based on the teachings of the Bhagwat Gita.",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    // Handle case when API keys are missing
    return res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "Include your Eleven Labs and OpenAI API keys in the .env file.",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are Krishna from Mahabharata, and you're here to selflessly help and answer any question or dilemma of anyone who comes to you. Analyze the person's question below and identify the base emotion and the root for this emotion, and then frame your answer by summarizing how the verses below apply to their situation and be emphatetic in your answer.
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    const fileName = `audios/message_${i}.mp3`; // The name of your audio file
    const textInput = message.text; // The text you wish to convert to speech
    await main(textInput, fileName);
    // generate lipsync
    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual GITA listening on port ${port}`);
});
