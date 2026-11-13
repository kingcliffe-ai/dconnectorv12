'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DerivWS } from '@deriv/core';
import { analyzeMarket, type MarketAnalysis } from '../lib/market-analyzer';

export interface ScannedMarket {
  symbol: string;
  displayName: string;
  analysis: MarketAnalysis | null;
  lastPrice: number | null;
  confidence: number;
  edge: number;
  bestSignal: string;
  isBest: boolean;
}

export interface MarketScannerState {
  markets: ScannedMarket[];
  bestMarket: ScannedMarket | null;
  isScanning: boolean;
  lastScanTime: Date | null;
  totalMarketsScanned: number;
}

const DIGIT_MARKETS: Array<{ symbol: string; displayName: string }> = [
  { symbol: '1HZ10V', displayName: 'Volatility 10 (1s)' },
  { symbol: '1HZ25V', displayName: 'Volatility 25 (1s)' },
  { symbol: '1HZ50V', displayName: 'Volatility 50 (1s)' },
  { symbol: '1HZ75V', displayName: 'Volatility 75 (1s)' },
  { symbol: '1HZ100V', displayName: 'Volatility 100 (1s)' },
  { symbol: 'CRASH300N', displayName: 'Crash 300' },
  { symbol: 'BOOM300N', displayName: 'Boom 300' },
  { symbol: 'CRASH500', displayName: 'Crash 500' },
  { symbol: 'BOOM500', displayName: 'Boom 500' },
  { symbol: '1HZ150V', displayName: 'Volatility 150 (1s)' },
];

const MAX_PRICES = 120;
const SCAN_INTERVAL_MS = 1800;

export interface UseMarketScannerParams {
  ws: DerivWS | null;
  isConnected: boolean;
  isAuthenticated: boolean;
}

export function useMarketScanner({ ws, isConnected, isAuthenticated }: UseMarketScannerParams) {
  const [state, setState] = useState<MarketScannerState>({
    markets: [],
    bestMarket: null,
    isScanning: false,
    lastScanTime: null,
    totalMarketsScanned: DIGIT_MARKETS.length,
  });

  const pricesMapRef = useRef<Record<string, number[]>>({});
  const subscriptionsRef = useRef<Record<string, { unsubscribe: () => void }>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateMarketAnalysis = useCallback((symbol: string, displayName: string) => {
    const prices = pricesMapRef.current[symbol] || [];
    if (prices.length < 12) return null;

    const analysis = analyzeMarket(prices, 2, null); // pipSize 2 for most synthetics

    const confidence = analysis.bestSignal?.confidence || 0;
    const edge = analysis.bestSignal?.expectedEdge || 0;
    const bestSignal = analysis.bestSignal
      ? `${analysis.bestSignal.contractMode}${analysis.bestSignal.digit !== undefined ? ' ' + analysis.bestSignal.digit : ''}`
      : 'No strong signal';

    return {
      symbol,
      displayName,
      analysis,
      lastPrice: prices[prices.length - 1] || null,
      confidence,
      edge,
      bestSignal,
    };
  }, []);

  const recomputeRankings = useCallback(() => {
    const scanned: ScannedMarket[] = DIGIT_MARKETS.map((m) => {
      const partial = updateMarketAnalysis(m.symbol, m.displayName);
      if (partial) {
        return {
          ...partial,
          isBest: false,
        } as ScannedMarket;
      }
      return {
        symbol: m.symbol,
        displayName: m.displayName,
        analysis: null,
        lastPrice: null,
        confidence: 0,
        edge: 0,
        bestSignal: 'Collecting data...',
        isBest: false,
      };
    });

    // Rank by confidence * edge (systematic score)
    const ranked = [...scanned].sort((a, b) => {
      const scoreA = a.confidence * (1 + a.edge / 20);
      const scoreB = b.confidence * (1 + b.edge / 20);
      return scoreB - scoreA;
    });

    const best = ranked[0] && ranked[0].confidence > 55 ? ranked[0] : null;

    const finalMarkets = ranked.map((m, idx) => ({
      ...m,
      isBest: idx === 0 && best !== null,
    }));

    setState((prev) => ({
      ...prev,
      markets: finalMarkets,
      bestMarket: best,
      lastScanTime: new Date(),
      isScanning: true,
    }));
  }, [updateMarketAnalysis]);

  // Subscribe to ticks for a symbol using the shared WS
  const subscribeToSymbol = useCallback(
    (symbol: string) => {
      if (!ws || !isConnected) return;

      // Avoid duplicate subs
      if (subscriptionsRef.current[symbol]) return;

      // Request initial history + stream
      const request = {
        ticks_history: symbol,
        count: 60,
        end: 'latest',
        style: 'ticks',
        subscribe: 1,
      };

      ws.send(request).then((response: any) => {
        if (response.error) return;

        // Seed with history
        if (response.history?.prices) {
          pricesMapRef.current[symbol] = response.history.prices.slice(-MAX_PRICES).map((p: any) => Number(p));
        }

        // Listen for live ticks on this symbol
        const unsubscribe = ws.onMessage((data: any) => {
          if (data.tick && data.tick.symbol === symbol) {
            const price = Number(data.tick.quote);
            if (!price) return;

            const arr = pricesMapRef.current[symbol] || [];
            arr.push(price);
            if (arr.length > MAX_PRICES) arr.shift();
            pricesMapRef.current[symbol] = arr;

            // Throttled recompute
          }
        });

        subscriptionsRef.current[symbol] = { unsubscribe };
      }).catch(() => {});
    },
    [ws, isConnected]
  );

  // Start scanning all markets
  const startScanning = useCallback(() => {
    if (!ws || !isConnected || !isAuthenticated) return;

    setState((prev) => ({ ...prev, isScanning: true }));

    // Subscribe to all
    DIGIT_MARKETS.forEach((m) => {
      subscribeToSymbol(m.symbol);
    });

    // Periodic full re-analysis + ranking
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      recomputeRankings();
    }, SCAN_INTERVAL_MS);

    // Initial compute after short delay for data
    setTimeout(recomputeRankings, 2200);
  }, [ws, isConnected, isAuthenticated, subscribeToSymbol, recomputeRankings]);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Unsubscribe all
    Object.values(subscriptionsRef.current).forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {}
    });
    subscriptionsRef.current = {};

    setState((prev) => ({ ...prev, isScanning: false }));
  }, []);

  // Auto start when connected
  useEffect(() => {
    if (isConnected && isAuthenticated && !state.isScanning) {
      // Start automatically for live feed
      startScanning();
    }

    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const refreshScan = useCallback(() => {
    recomputeRankings();
  }, [recomputeRankings]);

  return {
    ...state,
    startScanning,
    stopScanning,
    refreshScan,
    digitMarketsCount: DIGIT_MARKETS.length,
  };
}
