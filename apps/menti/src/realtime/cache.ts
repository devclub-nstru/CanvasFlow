import { Session, Slide } from "../core/database/models/index.js";

const sessionCache = new Map<string, { data: any; timestamp: number }>();
const slideCache = new Map<string, { data: any; timestamp: number }>();
const TTL_SESSION_MS = 5000;
const TTL_SLIDE_MS = 10000;

export async function getCachedSession(sessionId: string): Promise<any | null> {
  if (!sessionId) return null;
  const key = sessionId.toString();
  const cached = sessionCache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL_SESSION_MS) {
    return cached.data;
  }
  const session = await Session.findById(sessionId).lean();
  if (session) {
    sessionCache.set(key, { data: session, timestamp: Date.now() });
  }
  return session;
}

export function invalidateCachedSession(sessionId: string): void {
  if (sessionId) {
    sessionCache.delete(sessionId.toString());
  }
}

export async function getCachedSlide(slideId: string): Promise<any | null> {
  if (!slideId) return null;
  const key = slideId.toString();
  const cached = slideCache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL_SLIDE_MS) {
    return cached.data;
  }
  const slide = await Slide.findById(slideId).lean();
  if (slide) {
    slideCache.set(key, { data: slide, timestamp: Date.now() });
  }
  return slide;
}

export function invalidateCachedSlide(slideId: string): void {
  if (slideId) {
    slideCache.delete(slideId.toString());
  }
}
