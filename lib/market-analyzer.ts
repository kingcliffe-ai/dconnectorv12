import type { ContractMode, TradeType } from './types';
import { getLastDigit } from './digit-stats';

export interface MarketSignal {
  contractMode: ContractMode;
  digit?: number;
  confidence: number; // 0-100
  expectedEdge: number; // estimated % advantage over random
  reason: string;
  tradeType: TradeType;
}

export interface MarketAnalysis {
  signals: MarketSignal[];
  bestSignal: MarketSignal | null;
  hotDigits: number[];
  coldDigits: number[];
  currentStreak: { digit: number; length: number };
  volatility: number; // 0-100 measure of recent variation in last digits
  totalTicksAnalyzed: number;
  recommendation: string;
  biasSummary: string;
}

export interface BotTradeLog {
  id: string;
  timestamp: string;
  symbol: string;
  contractMode: ContractMode;
  digit?: number;
  stake: number;
  duration: number;
  reason: string;
  confidence: number;
  result?: 'win' | 'loss' | 'pending';
  payout?: number;
}

export interface BotPerformance {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalStake: number;
  totalPayout: number;
  netPL: number;
}

const MAX_HISTORY = 200; // sliding window for analysis

/**
 * Extract last N digits from price history.
 */
export function extractRecentDigits(prices: number[], pipSize: number, count: number): number[] {
  return prices.slice(-count).map((p) => getLastDigit(p, pipSize));
}

/**
 * Detect current streak of identical last digits.
 */
export function detectStreak(digits: number[]): { digit: number; length: number } {
  if (digits.length === 0) return { digit: -1, length: 0 };
  let length = 1;
  const last = digits[digits.length - 1];
  for (let i = digits.length - 2; i >= 0; i--) {
    if (digits[i] === last) length++;
    else break;
  }
  return { digit: last, length };
}

/**
 * Calculate volatility as normalized standard deviation of recent digits (0-100).
 */
export function calculateVolatility(digits: number[]): number {
  if (digits.length < 3) return 30;
  const mean = digits.reduce((a, b) => a + b, 0) / digits.length;
  const variance = digits.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / digits.length;
  const std = Math.sqrt(variance);
  // Normalize: max possible std for 0-9 uniform is ~2.87, scale to 0-100
  return Math.min(100, Math.round((std / 2.87) * 100));
}

/**
 * Core systematic market analysis for digit contracts.
 * Uses frequency, streaks, reversion, momentum, and volatility filters.
 */
export function analyzeMarket(
  prices: number[],
  pipSize: number,
  currentLastDigit: number | null
): MarketAnalysis {
  if (prices.length < 10) {
    return {
      signals: [],
      bestSignal: null,
      hotDigits: [],
      coldDigits: [],
      currentStreak: { digit: -1, length: 0 },
      volatility: 40,
      totalTicksAnalyzed: prices.length,
      recommendation: 'Collecting market data for analysis...',
      biasSummary: 'Insufficient data',
    };
  }

  const recentDigits = extractRecentDigits(prices, pipSize, Math.min(MAX_HISTORY, prices.length));
  const counts = new Array(10).fill(0);
  recentDigits.forEach((d) => counts[d]++);

  const total = recentDigits.length;
  const percentages = counts.map((c) => (total > 0 ? (c / total) * 100 : 10));

  // Hot / Cold (top 3 and bottom 3)
  const indexed = percentages.map((p, i) => ({ digit: i, pct: p }));
  const sorted = [...indexed].sort((a, b) => b.pct - a.pct);
  const hotDigits = sorted.slice(0, 3).map((x) => x.digit);
  const coldDigits = sorted.slice(-3).map((x) => x.digit);

  const streak = detectStreak(recentDigits);
  const volatility = calculateVolatility(recentDigits.slice(-30));

  const signals: MarketSignal[] = [];

  // Strategy 1: Statistical Edge (highest probability)
  const bestStat = sorted[0];
  if (bestStat.pct > 13) {
    // Strong bias
    signals.push({
      contractMode: 'DIGITMATCH',
      digit: bestStat.digit,
      confidence: Math.min(92, Math.round(bestStat.pct * 5.5)),
      expectedEdge: Math.round((bestStat.pct - 10) * 1.8),
      reason: `Statistical edge: Digit ${bestStat.digit} appeared in ${bestStat.pct.toFixed(1)}% of recent ticks`,
      tradeType: 'matches-differs',
    });
  }

  // Strategy 2: Reversion after streak (anti-momentum)
  if (streak.length >= 3) {
    const oppositeDigit = (streak.digit + 5) % 10; // simple opposite
    signals.push({
      contractMode: 'DIGITDIFF',
      digit: streak.digit,
      confidence: Math.min(88, 55 + streak.length * 8),
      expectedEdge: 6 + streak.length,
      reason: `Reversion signal: ${streak.length} consecutive ${streak.digit}s — high probability of change`,
      tradeType: 'matches-differs',
    });
    // Also suggest OVER/UNDER away from streak digit
    if (streak.digit >= 5) {
      signals.push({
        contractMode: 'DIGITUNDER',
        digit: 4,
        confidence: 70 + Math.min(15, streak.length * 3),
        expectedEdge: 5,
        reason: `Streak reversion: Expect lower digits after run of ${streak.digit}`,
        tradeType: 'over-under',
      });
    } else {
      signals.push({
        contractMode: 'DIGITOVER',
        digit: 5,
        confidence: 70 + Math.min(15, streak.length * 3),
        expectedEdge: 5,
        reason: `Streak reversion: Expect higher digits after run of ${streak.digit}`,
        tradeType: 'over-under',
      });
    }
  }

  // Strategy 3: Momentum / Hot digit follow (for short term continuation)
  if (hotDigits.length > 0 && volatility < 55) {
    const hot = hotDigits[0];
    signals.push({
      contractMode: 'DIGITMATCH',
      digit: hot,
      confidence: Math.round(58 + (percentages[hot] - 10) * 2),
      expectedEdge: Math.round(percentages[hot] - 10),
      reason: `Momentum: Digit ${hot} is currently hot (${percentages[hot].toFixed(1)}%) with low volatility`,
      tradeType: 'matches-differs',
    });
  }

  // Strategy 4: Even / Odd bias
  const evenCount = counts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
  const evenPct = (evenCount / total) * 100;
  if (Math.abs(evenPct - 50) > 8) {
    const isEvenBias = evenPct > 50;
    signals.push({
      contractMode: isEvenBias ? 'DIGITEVEN' : 'DIGITODD',
      confidence: Math.min(85, Math.round(50 + Math.abs(evenPct - 50) * 1.6)),
      expectedEdge: Math.round(Math.abs(evenPct - 50) * 0.9),
      reason: `${isEvenBias ? 'Even' : 'Odd'} bias detected (${evenPct.toFixed(1)}% even)`,
      tradeType: 'even-odd',
    });
  }

  // Strategy 5: Over/Under based on distribution skew
  const highDigits = counts.slice(5).reduce((a, b) => a + b, 0);
  const highPct = (highDigits / total) * 100;
  if (highPct > 58) {
    signals.push({
      contractMode: 'DIGITOVER',
      digit: 4,
      confidence: Math.min(80, Math.round(48 + (highPct - 50))),
      expectedEdge: Math.round((highPct - 50) * 0.7),
      reason: `Upward skew: ${highPct.toFixed(1)}% of digits are 5-9`,
      tradeType: 'over-under',
    });
  } else if (highPct < 42) {
    signals.push({
      contractMode: 'DIGITUNDER',
      digit: 5,
      confidence: Math.min(80, Math.round(48 + (50 - highPct))),
      expectedEdge: Math.round((50 - highPct) * 0.7),
      reason: `Downward skew: Only ${highPct.toFixed(1)}% high digits recently`,
      tradeType: 'over-under',
    });
  }

  // Filter and rank signals by confidence
  const rankedSignals = signals
    .filter((s) => s.confidence > 52)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  const bestSignal = rankedSignals[0] || null;

  let recommendation = 'No strong systematic edge detected. Trade manually or wait for clearer signal.';
  if (bestSignal) {
    recommendation = `Best entry: ${bestSignal.contractMode} ${bestSignal.digit !== undefined ? bestSignal.digit : ''} — ${bestSignal.reason}. Confidence ${bestSignal.confidence}%`;
  }

  const biasSummary = `Hot: ${hotDigits.join(', ')} | Cold: ${coldDigits.join(', ')} | Streak: ${streak.length > 1 ? `${streak.length}x ${streak.digit}` : 'none'} | Vol: ${volatility}`;

  return {
    signals: rankedSignals,
    bestSignal,
    hotDigits,
    coldDigits,
    currentStreak: streak,
    volatility,
    totalTicksAnalyzed: total,
    recommendation,
    biasSummary,
  };
}

/**
 * Generate a human-readable AI-style narrative analysis.
 */
export function generateAIAnalysis(analysis: MarketAnalysis, symbol: string): string {
  const { bestSignal, hotDigits, coldDigits, currentStreak, volatility, totalTicksAnalyzed } = analysis;

  let narrative = `Live market scan on ${symbol} using ${totalTicksAnalyzed} ticks.\n\n`;

  if (bestSignal) {
    narrative += `PRIMARY SIGNAL: ${bestSignal.reason}\n`;
    narrative += `Recommended: ${bestSignal.contractMode}${bestSignal.digit !== undefined ? ' ' + bestSignal.digit : ''} (Confidence: ${bestSignal.confidence}%, Edge: +${bestSignal.expectedEdge}%)\n\n`;
  }

  narrative += `Market Profile:\n`;
  narrative += `- Hot digits: ${hotDigits.join(', ')}\n`;
  narrative += `- Cold digits: ${coldDigits.join(', ')}\n`;
  if (currentStreak.length > 1) {
    narrative += `- Current streak: ${currentStreak.length} consecutive ${currentStreak.digit}s\n`;
  }
  narrative += `- Volatility index: ${volatility}/100 (${volatility > 65 ? 'high' : volatility > 40 ? 'moderate' : 'low'})\n\n`;

  if (volatility > 70) {
    narrative += `Caution: High volatility detected. Consider shorter durations or wait for stabilization.\n`;
  } else if (bestSignal && bestSignal.confidence > 75) {
    narrative += `Strong systematic opportunity identified. Consider entering with disciplined stake sizing.\n`;
  }

  return narrative;
}

/**
 * Simple query responder for the AI Agent chat.
 * Interprets natural language against current analysis state.
 */
export function queryAIAgent(
  query: string,
  analysis: MarketAnalysis,
  symbol: string | null,
  lastDigit: number | null
): string {
  const q = query.toLowerCase().trim();
  const { bestSignal, hotDigits, coldDigits, currentStreak, volatility } = analysis;

  if (!symbol) return 'Waiting for market data connection...';

  if (q.includes('best') || q.includes('recommend') || q.includes('signal')) {
    if (bestSignal) {
      return `Current best systematic trade: ${bestSignal.contractMode} ${bestSignal.digit ?? ''}. ${bestSignal.reason}. Confidence ${bestSignal.confidence}%.`;
    }
    return 'No high-confidence signal right now. Market is relatively balanced.';
  }

  if (q.includes('hot') || q.includes('frequent')) {
    return `Hot digits right now: ${hotDigits.join(', ')}. These have shown up most frequently in the recent sample.`;
  }

  if (q.includes('cold') || q.includes('rare')) {
    return `Cold digits: ${coldDigits.join(', ')}. These have been under-represented recently.`;
  }

  if (q.includes('streak') || q.includes('run')) {
    if (currentStreak.length > 1) {
      return `We are currently in a streak of ${currentStreak.length} ${currentStreak.digit}s. Reversion strategies may be favored.`;
    }
    return 'No significant streak detected at the moment.';
  }

  if (q.includes('volatil') || q.includes('risk')) {
    return `Current volatility level is ${volatility}/100. ${volatility > 65 ? 'High risk environment — use smaller stakes.' : 'Relatively stable conditions.'}`;
  }

  if (q.includes('even') || q.includes('odd')) {
    return 'I analyze even/odd bias as part of the systematic scan. Check the live signals panel for current even or odd recommendations.';
  }

  if (q.includes('over') || q.includes('under')) {
    return 'Over/Under signals are generated when we detect skew in the upper or lower half of digits.';
  }

  if (q.includes('how') && q.includes('work')) {
    return 'The analyzer combines frequency analysis, streak detection, momentum, and volatility filters to surface edges that deviate from the theoretical 10% uniform distribution.';
  }

  // Default intelligent response
  return `Based on live data for ${symbol}, last digit was ${lastDigit}. ${bestSignal ? 'Top signal is ' + bestSignal.contractMode + (bestSignal.digit !== undefined ? ' ' + bestSignal.digit : '') + '.' : 'No dominant edge currently.'} Ask about hot digits, streaks, or best entry.`;
}
