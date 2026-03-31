const dayjs = require("dayjs");
const { normalizeText } = require("./text");
const { parseNaturalDateWithAi } = require("../ai/geminiService");
const env = require("../config/env");

const WEEK_DAYS = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function toIsoMinute(date) {
  return dayjs(date).format("YYYY-MM-DD HH:mm");
}

function nextWeekDay(targetDay) {
  const now = dayjs();
  const current = now.day();
  const delta = ((targetDay - current + 7) % 7) || 7;
  return now.add(delta, "day");
}

function hasDateHint(input) {
  const normalized = normalizeText(input || "");
  if (!normalized) return false;
  if (
    normalized.includes("amanha")
    || normalized.includes("hoje")
    || /\bhj\b/.test(normalized)
    || normalized.includes("depois de amanha")
    || normalized.includes("proximo dia")
    || normalized.includes("dia seguinte")
    || normalized.includes("proxima semana")
  ) {
    return true;
  }
  if (
    normalized.includes("manha")
    || normalized.includes("tarde")
    || normalized.includes("noite")
    || normalized.includes("cedo")
    || normalized.includes("depois das")
  ) {
    return true;
  }
  if (
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(normalized)
    || /\b\d{4}-\d{2}-\d{2}\b/.test(normalized)
    || /\b\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?\b/.test(normalized)
  ) {
    return true;
  }
  if (/\b\d{1,2}[:h]\d{2}\b/.test(normalized)) return true;
  const dayWords = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  return dayWords.some((w) => normalized.includes(w));
}

function fromRules(input) {
  const raw = String(input || "").trim();
  if (
    (/^\d{4}-\d{2}-\d{2}T/i.test(raw) || raw.endsWith("Z") || /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(raw))
    && dayjs(raw).isValid()
  ) {
    return toIsoMinute(dayjs(raw).second(0).millisecond(0));
  }
  const text = raw.toLowerCase().trim();
  let base = dayjs();

  const isoDayMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?\b/);
  if (isoDayMatch) {
    const y = Number(isoDayMatch[1]);
    const mo = Number(isoDayMatch[2]);
    const d = Number(isoDayMatch[3]);
    base = dayjs(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    if (isoDayMatch[4] != null) {
      base = base.hour(Number(isoDayMatch[4])).minute(Number(isoDayMatch[5] || 0));
    } else {
      base = base.hour(9).minute(0);
    }
    const hasRelativeDay =
      text.includes("hoje")
      || /\bhj\b/.test(text)
      || text.includes("depois de amanha")
      || text.includes("depois de amanhã")
      || text.includes("amanha")
      || text.includes("amanhã")
      || text.includes("proximo dia")
      || text.includes("dia seguinte");
    const slashDate = /\b(\d{1,2})\/(\d{1,2})/.test(text);
    if (base.isValid() && !hasRelativeDay && !slashDate) {
      return toIsoMinute(base.second(0).millisecond(0));
    }
    base = dayjs();
  }

  const explicitDate = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]);
    const yearRaw = explicitDate[3];
    const currentYear = dayjs().year();
    const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : currentYear;
    const explicitBase = dayjs(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    if (explicitBase.isValid()) {
      base = explicitBase;
    }
  }

  if (!explicitDate) {
    const hyphenDate = text.match(/\b(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?\b/);
    if (hyphenDate) {
      const day = Number(hyphenDate[1]);
      const month = Number(hyphenDate[2]);
      const yearRaw = hyphenDate[3];
      const currentYear = dayjs().year();
      const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : currentYear;
      const hyphenBase = dayjs(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
      if (hyphenBase.isValid()) {
        base = hyphenBase;
      }
    }
  }

  if (text.includes("hoje") || /\bhj\b/.test(text)) {
    base = dayjs();
  } else if (text.includes("depois de amanha") || text.includes("depois de amanhã")) {
    base = base.add(2, "day");
  } else if (text.includes("amanha") || text.includes("amanhã")) {
    base = base.add(1, "day");
  } else if (text.includes("proximo dia") || text.includes("dia seguinte")) {
    base = base.add(1, "day");
  }
  if (text.includes("daqui") && text.includes("dias")) {
    const match = text.match(/daqui\s+(\d+)\s+dias?/);
    if (match) {
      base = base.add(Number(match[1]), "day");
    }
  }
  for (const [label, weekday] of Object.entries(WEEK_DAYS)) {
    if (text.includes(label)) {
      base = nextWeekDay(weekday);
      break;
    }
  }

  if (text.includes("proxima semana")) {
    base = base.add(7, "day");
  }

  if (text.includes("cedo")) {
    base = base.hour(9).minute(0);
  } else if (text.includes("tarde")) {
    base = base.hour(15).minute(0);
  } else if (text.includes("depois das")) {
    const hour = Number(text.match(/depois das\s+(\d{1,2})/)?.[1] || 18);
    base = base.hour(hour).minute(0);
  } else {
    const hhmm = text.match(/\b(\d{1,2})[:h](\d{2})\b/);
    if (hhmm) {
      base = base.hour(Number(hhmm[1])).minute(Number(hhmm[2]));
    } else {
      base = base.hour(9).minute(0);
    }
  }

  return toIsoMinute(base.second(0).millisecond(0));
}

async function parseDateText(input, context = {}) {
  const ruleBased = fromRules(input);
  if (!env.useAi || !env.geminiApiKey) {
    return ruleBased;
  }

  const aiDate = String((await parseNaturalDateWithAi(input, context)) || "").trim();
  if (aiDate && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(aiDate)) {
    return aiDate;
  }
  return ruleBased;
}

module.exports = {
  parseDateText,
  hasDateHint,
};
