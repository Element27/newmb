import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import Jimp from "jimp";
async function classifyWithGemini(imagePath, manualCategory) {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
    const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "jpeg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const base64Image = fs.readFileSync(imagePath).toString("base64");
    const systemPrompt = `You are a fashion categorization assistant. You must analyze the image and return a JSON object with exactly two keys: "category" and "label".
  
The "category" MUST be exactly one of these strings: "top", "bottom", "shoes", "outer", "dress", "accessory".
The "label" should be a short, descriptive name for the item (e.g., "blue denim jacket", "white sneakers").
${manualCategory ? `\nThe user has manually specified the category as "${manualCategory}". You MUST set "category" to "${manualCategory}" and only focus on generating an accurate "label".` : ""}
Respond ONLY with the JSON object, no markdown formatting.`;
    const response = await model.generateContent([
        systemPrompt,
        {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        }
    ]);
    const content = response.response.text();
    console.log("----- Gemini Classification Complete -----");
    console.log("Raw Content:", content);
    if (!content)
        throw new Error("No content from Gemini");
    const parsed = JSON.parse(content);
    console.log("Parsed Output:", parsed);
    const validCategories = ["top", "bottom", "shoes", "outer", "dress", "accessory"];
    let finalCategory = manualCategory || null;
    if (!manualCategory && parsed.category && validCategories.includes(parsed.category.toLowerCase())) {
        finalCategory = parsed.category.toLowerCase();
    }
    return {
        label: parsed.label || "unknown",
        category: finalCategory,
        confidence: 0.95
    };
}
async function classifyWithOpenAI(imagePath, manualCategory) {
    const apiKey = process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });
    const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "jpeg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const base64Image = fs.readFileSync(imagePath).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    const systemPrompt = `You are a fashion categorization assistant. You must analyze the image and return a JSON object with exactly two keys: "category" and "label".
  
The "category" MUST be exactly one of these strings: "top", "bottom", "shoes", "outer", "dress", "accessory".
The "label" should be a short, descriptive name for the item (e.g., "blue denim jacket", "white sneakers").
${manualCategory ? `\nThe user has manually specified the category as "${manualCategory}". You MUST set "category" to "${manualCategory}" and only focus on generating an accurate "label".` : ""}
Respond ONLY with the JSON object, no markdown formatting.`;
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: dataUrl,
                            detail: "low",
                        },
                    },
                ],
            },
        ],
        response_format: { type: "json_object" },
    });
    const content = response.choices?.[0]?.message?.content;
    console.log("----- OpenAI Classification Complete -----");
    console.log("Raw Content:", content);
    if (!content)
        throw new Error("No content from OpenAI");
    const parsed = JSON.parse(content);
    console.log("Parsed Output:", parsed);
    const validCategories = ["top", "bottom", "shoes", "outer", "dress", "accessory"];
    let finalCategory = manualCategory || null;
    if (!manualCategory && parsed.category && validCategories.includes(parsed.category.toLowerCase())) {
        finalCategory = parsed.category.toLowerCase();
    }
    return {
        label: parsed.label || "unknown",
        category: finalCategory,
        confidence: 0.95
    };
}
export async function classifyImage(imagePath, manualCategory) {
    try {
        if (process.env.GEMINI_API_KEY) {
            console.log("Using Gemini for classification...");
            return await classifyWithGemini(imagePath, manualCategory);
        }
        else if (process.env.OPENAI_API_KEY) {
            console.log("Using OpenAI for classification...");
            return await classifyWithOpenAI(imagePath, manualCategory);
        }
        else {
            console.warn("No GEMINI_API_KEY or OPENAI_API_KEY found, falling back to basic classification.");
            return { label: "unknown", category: manualCategory || null, confidence: 0 };
        }
    }
    catch (error) {
        console.error("Classification error:", error);
        return { label: "unknown", category: manualCategory || null, confidence: 0 };
    }
}
export async function extractAverageColorHex(imagePath) {
    try {
        const image = await Jimp.read(imagePath);
        image.resize(32, 32);
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;
        for (let y = 0; y < image.bitmap.height; y += 1) {
            for (let x = 0; x < image.bitmap.width; x += 1) {
                const { r, g, b, a } = Jimp.intToRGBA(image.getPixelColor(x, y));
                if (a === 0)
                    continue;
                red += r;
                green += g;
                blue += b;
                count += 1;
            }
        }
        if (count === 0) {
            return "#b8a18a";
        }
        const toHex = (value) => Math.round(value).toString(16).padStart(2, "0");
        return `#${toHex(red / count)}${toHex(green / count)}${toHex(blue / count)}`;
    }
    catch (error) {
        console.error("Color extraction error:", error);
        return "#b8a18a";
    }
}
