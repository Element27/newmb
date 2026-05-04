"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonday = getMonday;
exports.getNextMonday = getNextMonday;
exports.toISODate = toISODate;
exports.generateWeeklyPlan = generateWeeklyPlan;
exports.mergePlanDay = mergePlanDay;
const recommend_1 = require("./recommend");
const WEEKDAY_OCCASIONS = [
    "work",
    "work",
    "work",
    "casual",
    "casual",
    "travel",
    "casual",
];
function getMonday(input) {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
}
function getNextMonday(input) {
    const monday = getMonday(input);
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    if (monday <= date) {
        monday.setDate(monday.getDate() + 7);
    }
    return monday;
}
function toISODate(input) {
    return input.toISOString().slice(0, 10);
}
function cloneItems(items) {
    return items.map((item) => ({ ...item }));
}
function generateWeeklyPlan(userId, wardrobeItems, weekStart) {
    const usage = new Map();
    const monday = new Date(`${weekStart}T00:00:00.000Z`);
    const days = [];
    for (let index = 0; index < 7; index += 1) {
        const currentDate = new Date(monday);
        currentDate.setUTCDate(monday.getUTCDate() + index);
        const occasion = WEEKDAY_OCCASIONS[index] || "casual";
        const rotated = cloneItems(wardrobeItems).sort((a, b) => {
            const aUsage = usage.get(a.id) || 0;
            const bUsage = usage.get(b.id) || 0;
            return aUsage - bUsage;
        });
        const outfit = (0, recommend_1.recommendOutfit)(rotated, occasion);
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
function mergePlanDay(plan, date, patch) {
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
