'use client';

import { useState } from 'react';
import { Localize } from '@deriv-com/translations';
import { AIMarketAgent } from './ai-market-agent';
import { SystematicBotControls } from './systematic-bot-controls';
import { TradingInstructions } from './trading-instructions';
import { GlobalMarketScanner } from './global-market-scanner';
import type { MarketAnalysis } from '@/lib/market-analyzer';
import type { BotSettings, BotState } from '@/hooks/use-trading-bot';
import type { ScannedMarket } from '@/hooks/use-market-scanner';
import { cn } from '@/lib/utils';

interface AnalysisCenterProps {
  // Analysis data
  analysis: MarketAnalysis | null;
  symbol: string | null;
  lastDigit: number | null;
  isConnected: boolean;
  isAuthenticated: boolean;

  // Bot
  botSettings: BotSettings;
  botState: BotState;
  onBotUpdateSettings: (p: Partial<BotSettings>) => void;
  onBotStart: () => void;
  onBotStop: () => void;
  onBotReset: () => void;
  onBotToggleSimulation: () => void;

  // For AI agent
  onRequestFullScan?: () => void;

  // To allow bot to drive trades
  canExecuteTrades: boolean;
  executeBotTrade?: (params: { contractMode: any; digit?: number; stake?: number; duration?: number }) => Promise<void>;

  // NEW: Global multi-market AI scanner (additive)
  scannerMarkets?: ScannedMarket[];
  scannerBest?: ScannedMarket | null;
  scannerIsScanning?: boolean;
  scannerLastScan?: Date | null;
  scannerTotal?: number;
  onScannerRefresh?: () => void;
  onSelectMarketForTrading?: (symbol: string) => void;
}

export function AnalysisCenter({
  analysis,
  symbol,
  lastDigit,
  isConnected,
  isAuthenticated,
  botSettings,
  botState,
  onBotUpdateSettings,
  onBotStart,
  onBotStop,
  onBotReset,
  onBotToggleSimulation,
  onRequestFullScan,
  canExecuteTrades,
  executeBotTrade,
  // Scanner props (additive - no impact on existing tabs)
  scannerMarkets = [],
  scannerBest = null,
  scannerIsScanning = false,
  scannerLastScan = null,
  scannerTotal = 10,
  onScannerRefresh,
  onSelectMarketForTrading,
}: AnalysisCenterProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'bot' | 'scanner' | 'guide'>('agent');

  const TabButton = ({ value, children }: { value: 'agent' | 'bot' | 'scanner' | 'guide'; children: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-colors',
        activeTab === value
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            <Localize i18n_default_text="Market Intelligence Center" />
          </h2>
          <p className="text-sm text-muted-foreground">
            <Localize i18n_default_text="Live systematic analysis + automated trading bot for Deriv Digits" />
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <TabButton value="agent">AI Agent</TabButton>
        <TabButton value="scanner">Global AI Scanner</TabButton>
        <TabButton value="bot">Trading Bot</TabButton>
        <TabButton value="guide">Instructions</TabButton>
      </div>

      {activeTab === 'agent' && (
        <AIMarketAgent
          analysis={analysis}
          symbol={symbol}
          lastDigit={lastDigit}
          isConnected={isConnected}
          onRequestScan={onRequestFullScan}
        />
      )}

      {activeTab === 'scanner' && (
        <GlobalMarketScanner
          markets={scannerMarkets}
          bestMarket={scannerBest}
          isScanning={scannerIsScanning}
          lastScanTime={scannerLastScan}
          totalMarketsScanned={scannerTotal}
          onRefresh={onScannerRefresh || (() => {})}
          onSelectMarket={onSelectMarketForTrading}
          isConnected={isConnected}
        />
      )}

      {activeTab === 'bot' && (
        <>
          <SystematicBotControls
            settings={botSettings}
            state={botState}
            onUpdateSettings={onBotUpdateSettings}
            onStart={onBotStart}
            onStop={onBotStop}
            onReset={onBotReset}
            onToggleSimulation={onBotToggleSimulation}
            isConnected={isConnected}
            isAuthenticated={isAuthenticated}
            canTrade={canExecuteTrades}
          />
          <div className="mt-3 text-[10px] text-center text-muted-foreground">
            The bot uses the same live analysis engine as the AI Agent.
          </div>
        </>
      )}

      {activeTab === 'guide' && <TradingInstructions />}
    </div>
  );
}
