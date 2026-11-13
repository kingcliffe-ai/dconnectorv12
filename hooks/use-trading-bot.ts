'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContractMode } from '../lib/types';
import {
  analyzeMarket,
  type MarketAnalysis,
  type MarketSignal,
  type BotTradeLog,
  type BotPerformance,
} from '../lib/market-analyzer';
import { v4 as uuidv4 } from 'uuid';

export type BotStrategy = 'statistical' | 'reversion' | 'momentum' | 'balanced' | 'aggressive';

export interface BotSettings {
  strategy: BotStrategy;
  minConfidence: number; // 55-95
  maxTradesPerSession: number;
  maxLossUSD: number;
  stake: number;
  duration: number;
  cooldownSeconds: number;
  simulationMode: boolean; // true = no real buys
}

export interface BotState {
  isRunning: boolean;
  isExecuting: boolean;
  lastTradeTime: number | null;
  tradesTaken: number;
  sessionLoss: number;
  logs: BotTradeLog[];
  performance: BotPerformance;
  currentAnalysis: MarketAnalysis | null;
  lastSignal: MarketSignal | null;
}

const DEFAULT_SETTINGS: BotSettings = {
  strategy: 'statistical',
  minConfidence: 68,
  maxTradesPerSession: 25,
  maxLossUSD: 150,
  stake: 10,
  duration: 5,
  cooldownSeconds: 12,
  simulationMode: true, // Safe default
};

export interface UseTradingBotParams {
  isConnected: boolean;
  isAuthenticated: boolean;
  activeSymbol: { display_name: string; underlying_symbol: string } | null;
  prices: number[];
  pipSize: number;
  lastDigit: number | null;
  buyContract: (override?: { contractMode?: ContractMode; digit?: number; stake?: number; duration?: number }) => Promise<void>;
  currentStake: string;
  currentDuration: number;
  setStake?: (s: string) => void;
  setDuration?: (d: number) => void;
}

export function useTradingBot({
  isConnected,
  isAuthenticated,
  activeSymbol,
  prices,
  pipSize,
  lastDigit,
  buyContract,
  currentStake,
  currentDuration,
}: UseTradingBotParams) {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<BotState>({
    isRunning: false,
    isExecuting: false,
    lastTradeTime: null,
    tradesTaken: 0,
    sessionLoss: 0,
    logs: [],
    performance: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalStake: 0,
      totalPayout: 0,
      netPL: 0,
    },
    currentAnalysis: null,
    lastSignal: null,
  });

  const analysisRef = useRef<MarketAnalysis | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update analysis whenever prices change
  const currentAnalysis = useCallback(() => {
    if (prices.length < 8) return null;
    return analyzeMarket(prices, pipSize, lastDigit);
  }, [prices, pipSize, lastDigit]);

  // Compute performance from logs
  const computePerformance = useCallback((logs: BotTradeLog[]): BotPerformance => {
    const completed = logs.filter((l) => l.result && l.result !== 'pending');
    const wins = completed.filter((l) => l.result === 'win').length;
    const losses = completed.filter((l) => l.result === 'loss').length;
    const totalTrades = completed.length;
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

    const totalStake = logs.reduce((sum, l) => sum + l.stake, 0);
    const totalPayout = logs.reduce((sum, l) => sum + (l.payout || 0), 0);
    const netPL = totalPayout - totalStake;

    return {
      totalTrades,
      wins,
      losses,
      winRate,
      totalStake,
      totalPayout,
      netPL,
    };
  }, []);

  // Update analysis live
  useEffect(() => {
    const analysis = currentAnalysis();
    if (analysis) {
      analysisRef.current = analysis;
      setState((prev) => ({
        ...prev,
        currentAnalysis: analysis,
        lastSignal: analysis.bestSignal,
      }));
    }
  }, [currentAnalysis]);

  const addLog = useCallback((log: Omit<BotTradeLog, 'id' | 'timestamp'>) => {
    const fullLog: BotTradeLog = {
      ...log,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    setState((prev) => {
      const newLogs = [fullLog, ...prev.logs].slice(0, 100); // keep last 100
      const perf = computePerformance(newLogs);
      return {
        ...prev,
        logs: newLogs,
        performance: perf,
      };
    });
    return fullLog;
  }, [computePerformance]);

  const updateLogResult = useCallback((logId: string, result: 'win' | 'loss', payout?: number) => {
    setState((prev) => {
      const newLogs = prev.logs.map((l) =>
        l.id === logId ? { ...l, result, payout: payout ?? l.payout } : l
      );
      const perf = computePerformance(newLogs);
      return { ...prev, logs: newLogs, performance: perf };
    });
  }, [computePerformance]);

  // Core decision engine — called periodically when bot is running
  const evaluateAndTrade = useCallback(async () => {
    if (!state.isRunning || state.isExecuting || !isConnected || !isAuthenticated) return;
    if (!activeSymbol) return;

    const analysis = analysisRef.current;
    if (!analysis || !analysis.bestSignal) return;

    const now = Date.now();
    if (state.lastTradeTime && now - state.lastTradeTime < settings.cooldownSeconds * 1000) {
      return; // cooldown
    }

    if (state.tradesTaken >= settings.maxTradesPerSession) {
      stopBot();
      return;
    }

    if (state.sessionLoss >= settings.maxLossUSD) {
      stopBot();
      return;
    }

    const signal = analysis.bestSignal;

    // Strategy filter
    let shouldTrade = signal.confidence >= settings.minConfidence;

    if (settings.strategy === 'reversion' && !signal.reason.toLowerCase().includes('reversion')) {
      shouldTrade = false;
    }
    if (settings.strategy === 'statistical' && !signal.reason.toLowerCase().includes('statistical')) {
      shouldTrade = false;
    }
    if (settings.strategy === 'momentum' && signal.reason.toLowerCase().includes('reversion')) {
      shouldTrade = false;
    }

    if (!shouldTrade) return;

    // Prepare trade
    const stakeToUse = settings.stake || parseFloat(currentStake) || 10;
    const durationToUse = settings.duration || currentDuration || 5;

    setState((prev) => ({ ...prev, isExecuting: true }));

    const logEntry = addLog({
      symbol: activeSymbol.display_name,
      contractMode: signal.contractMode,
      digit: signal.digit,
      stake: stakeToUse,
      duration: durationToUse,
      reason: signal.reason,
      confidence: signal.confidence,
      result: 'pending',
    });

    try {
      if (!settings.simulationMode) {
        // Execute real trade — we pass overrides conceptually.
        // Note: The actual buy uses current proposal state. For full control we trigger buy.
        // In practice the parent component can sync stake/duration or we call a wrapped buy.
        await buyContract({
          contractMode: signal.contractMode,
          digit: signal.digit,
          stake: stakeToUse,
          duration: durationToUse,
        });
      }

      // Record as executed
      setState((prev) => ({
        ...prev,
        lastTradeTime: now,
        tradesTaken: prev.tradesTaken + 1,
        isExecuting: false,
      }));

      // For demo purposes we simulate a quick outcome after 8-15s (real outcome comes from positions)
      // In production you would correlate with closed positions via contract id.
      setTimeout(() => {
        const simulatedWin = Math.random() < (signal.confidence / 100) * 0.82 + 0.12; // slightly conservative
        const payout = simulatedWin ? Math.round(stakeToUse * 1.85 * 100) / 100 : 0;

        updateLogResult(logEntry.id, simulatedWin ? 'win' : 'loss', payout);

        if (!simulatedWin) {
          setState((prev) => ({
            ...prev,
            sessionLoss: prev.sessionLoss + stakeToUse,
          }));
        }
      }, 8500 + Math.random() * 6500);
    } catch (err) {
      // Mark as failed
      updateLogResult(logEntry.id, 'loss');
      setState((prev) => ({ ...prev, isExecuting: false }));
    }
  }, [
    state.isRunning,
    state.isExecuting,
    state.lastTradeTime,
    state.tradesTaken,
    state.sessionLoss,
    settings,
    isConnected,
    isAuthenticated,
    activeSymbol,
    buyContract,
    currentStake,
    currentDuration,
    addLog,
    updateLogResult,
  ]);

  // Start / stop controls
  const startBot = useCallback(() => {
    if (!isConnected || !isAuthenticated) return;
    setState((prev) => ({
      ...prev,
      isRunning: true,
      tradesTaken: 0,
      sessionLoss: 0,
      lastTradeTime: null,
    }));
  }, [isConnected, isAuthenticated]);

  const stopBot = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false, isExecuting: false }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetBot = useCallback(() => {
    stopBot();
    setState({
      isRunning: false,
      isExecuting: false,
      lastTradeTime: null,
      tradesTaken: 0,
      sessionLoss: 0,
      logs: [],
      performance: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalStake: 0,
        totalPayout: 0,
        netPL: 0,
      },
      currentAnalysis: analysisRef.current,
      lastSignal: analysisRef.current?.bestSignal || null,
    });
  }, [stopBot]);

  // Run evaluation loop when bot is active
  useEffect(() => {
    if (state.isRunning) {
      // Run evaluation frequently (every 2.2s) — analysis updates on price ticks
      intervalRef.current = setInterval(() => {
        evaluateAndTrade();
      }, 2200);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, evaluateAndTrade]);

  const updateSettings = useCallback((partial: Partial<BotSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleSimulation = useCallback(() => {
    setSettings((prev) => ({ ...prev, simulationMode: !prev.simulationMode }));
  }, []);

  return {
    settings,
    state,
    startBot,
    stopBot,
    resetBot,
    updateSettings,
    toggleSimulation,
    // Expose for parent to optionally sync UI
    setManualStakeAndDuration: (stake: number, duration: number) => {
      // parent can use this if desired
    },
  };
}
