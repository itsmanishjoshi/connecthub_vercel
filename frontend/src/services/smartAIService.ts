/**
 * Smart AI Service — thin client; intent detection and execution are server-side.
 */

export type { ActionType, AIAction, AIResponse } from '@/services/aiService';
export { analyzeQuery, executeAction, undoAction } from '@/services/aiService';
