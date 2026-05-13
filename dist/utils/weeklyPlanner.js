import { recommendOutfit } from "./recommend.js";
const WEEKDAY_OCCASIONS = [
    "work",
    "work",
    "work",
    "casual",
    "casual",
    "travel",
    "casual",
];
export function getMonday(input) {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
}
export function getNextMonday(input) {
    const monday = getMonday(input);
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    if (monday <= date) {
        monday.setDate(monday.getDate() + 7);
    }
    return monday;
}
export function toISODate(input) {
    return input.toISOString().slice(0, 10);
}
function cloneItems(items) {
    return items.map((item) => ({ ...item }));
}
export function generateWeeklyPlan(userId, wardrobeItems, weekStart, primaryStyle) {
    const usage = new Map();
    const monday = new Date(`${weekStart}T00:00:00.000Z`);
    const days = [];
    for (let index = 0; index < 7; index += 1) {
        const currentDate = new Date(monday);
        currentDate.setUTCDate(monday.getUTCDate() + index);
        const occasion = WEEKDAY_OCCASIONS[index] || "casual";
        // Style-aware bias: promote/demote categories based on primaryStyle
        const styleScore = (item) => {
            const cat = item.category?.toLowerCase() || "";
            if (primaryStyle === "Feminine") {
                if (cat === "dress")
                    return -2;
                if (cat === "accessory")
                    return -1;
                if (cat === "outer" || cat === "shoes")
                    return 0;
            }
            else if (primaryStyle === "Masculine") {
                if (cat === "bottom" || cat === "outer")
                    return -2;
                if (cat === "top")
                    return -1;
                if (cat === "dress")
                    return 2; // deprioritize dresses
            }
            return 0;
        };
        const rotated = cloneItems(wardrobeItems).sort((a, b) => {
            const aUsage = usage.get(a.id) || 0;
            const bUsage = usage.get(b.id) || 0;
            return (aUsage + styleScore(a)) - (bUsage + styleScore(b));
        });
        const outfit = recommendOutfit(rotated, occasion);
        outfit.forEach((item) => usage.set(item.id, (usage.get(item.id) || 0) + 1));
        days.push({
            date: toISODate(currentDate),
            occasion,
            itemIds: outfit.map((item) => item.id),
            notes: "",
            locked: false,
        });
    }
    const now = new Date().toISOString();
    return {
        userId,
        weekStart,
        days,
        generatedAt: now,
        updatedAt: now,
    };
}
export function mergePlanDay(plan, date, patch) {
    const days = plan.days.map((day) => day.date === date
        ? {
            ...day,
            ...patch,
            date: day.date,
        }
        : day);
    return {
        ...plan,
        days,
        updatedAt: new Date().toISOString(),
    };
}
