"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendOutfit = recommendOutfit;
function isNeutral(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!m)
        return false;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const diff = max - min; // small diff => grayish
    return diff < 15 || (r < 40 && g < 40 && b < 40) || (r > 220 && g > 220 && b > 220);
}
function recommendOutfit(items, occasion) {
    const byCat = new Map([
        ["top", []],
        ["bottom", []],
        ["shoes", []],
        ["outer", []],
        ["dress", []],
        ["accessory", []],
    ]);
    for (const it of items || []) {
        const arr = byCat.get(it.category);
        if (arr)
            arr.push(it);
    }
    const pick = (list, preferNeutral = false) => {
        if (!list.length)
            return null;
        if (preferNeutral) {
            const neutral = list.find((i) => isNeutral(i.colorHex));
            if (neutral)
                return neutral;
        }
        return list[0] || null;
    };
    const result = [];
    // If there is a dress, prefer pairing dress + shoes, add outer for travel/work if available
    const dress = pick(byCat.get("dress"));
    const shoes = pick(byCat.get("shoes"), occasion === "work");
    const outer = pick(byCat.get("outer"), occasion !== "casual");
    const top = pick(byCat.get("top"), occasion === "work");
    const bottom = pick(byCat.get("bottom"), occasion === "work");
    const accessory = pick(byCat.get("accessory"), false);
    if (dress && shoes) {
        result.push(dress, shoes);
        if (occasion !== "casual" && outer)
            result.push(outer);
    }
    else {
        if (top)
            result.push(top);
        if (bottom)
            result.push(bottom);
        if (shoes)
            result.push(shoes);
        if (occasion === "travel" && outer)
            result.push(outer);
    }
    if (occasion === "casual" && accessory)
        result.push(accessory);
    // Ensure unique items and cap to 4 items
    const seen = new Set();
    const unique = result.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    return unique.slice(0, 4);
}
