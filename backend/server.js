import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const speechFile = path.resolve("./speech.mp3");
const textInput = "Bhagwat Gita based Advice giver is a wonderful project to build! Radhe Radhe!";

async function main(textInput) {
    const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: textInput,
    });
    console.log(speechFile);
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
}
main(textInput);