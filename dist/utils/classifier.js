"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyImage = classifyImage;
const tf = __importStar(require("@tensorflow/tfjs"));
const mobilenet = __importStar(require("@tensorflow-models/mobilenet"));
const jimp_1 = __importDefault(require("jimp"));
const LABEL_TO_CATEGORY = {
    tshirt: "top",
    shirt: "top",
    blouse: "top",
    sweater: "top",
    hoodie: "top",
    jeans: "bottom",
    pants: "bottom",
    shorts: "bottom",
    skirt: "bottom",
    sneaker: "shoes",
    boot: "shoes",
    heel: "shoes",
    loafer: "shoes",
    shoe: "shoes",
    jacket: "outer",
    coat: "outer",
    cardigan: "outer",
    blazer: "outer",
    dress: "dress",
    hat: "accessory",
    belt: "accessory",
    bag: "accessory",
    scarf: "accessory",
    watch: "accessory",
};
function canonicalize(label) {
    const raw = String(label || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
    const alias = {
        tshirts: "tshirt",
        sweatshirt: "sweater",
        jumper: "sweater",
        pullover: "sweater",
        sneakers: "sneaker",
        boots: "boot",
        loafers: "loafer",
        heels: "heel",
        runningshoe: "sneaker",
        dressshoe: "shoe",
        flipflop: "shoe",
        sandal: "shoe",
        trousers: "pants",
        legging: "leggings",
    };
    return alias[raw] || raw;
}
function inferCategoryFromRaw(raw) {
    const s = String(raw || "").toLowerCase();
    if (/shirt|tee|blouse|sweater|hoodie|top/.test(s))
        return "top";
    if (/jeans|pant|trouser|skirt|short/.test(s))
        return "bottom";
    if (/shoe|sneaker|boot|loafer|heel|flip\s?flop|sandal/.test(s))
        return "shoes";
    if (/jacket|coat|cardigan|blazer/.test(s))
        return "outer";
    if (/dress/.test(s))
        return "dress";
    if (/hat|belt|bag|scarf|watch/.test(s))
        return "accessory";
    return null;
}
/**
 * Decodes an image using Jimp and converts it to a 3D Tensor for TensorFlow.js
 */
async function imageToTensor(imagePath) {
    const image = await jimp_1.default.read(imagePath);
    image.cover(224, 224); // MobileNet expects 224x224
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const data = image.bitmap.data;
    // Jimp data is RGBA, MobileNet expects RGB
    const buffer = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
        buffer[i * 3] = data[i * 4]; // R
        buffer[i * 3 + 1] = data[i * 4 + 1]; // G
        buffer[i * 3 + 2] = data[i * 4 + 2]; // B
    }
    return tf.tensor3d(buffer, [height, width, 3]);
}
async function classifyImage(imagePath) {
    try {
        // 1. Load the model
        const model = await mobilenet.load();
        // 2. Decode the image into a Tensor
        const tfImage = await imageToTensor(imagePath);
        // 3. Classify
        const results = await model.classify(tfImage);
        const top = results?.[0] || { className: "", probability: 0 };
        const rawLabel = top.className || "";
        const label = canonicalize(rawLabel);
        const category = LABEL_TO_CATEGORY[label] || inferCategoryFromRaw(rawLabel);
        // 4. Cleanup tensor
        tfImage.dispose();
        return { label, category, confidence: Number(top.probability || 0) };
    }
    catch (error) {
        console.error("Classification error:", error);
        return { label: "unknown", category: null, confidence: 0 };
    }
}
