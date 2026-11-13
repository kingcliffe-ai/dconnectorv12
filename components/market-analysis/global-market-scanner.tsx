'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Localize } from '@deriv-com/translations';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import type { ScannedMarket } from '@/hooks/use-market-scanner';
import { cn } from '@/lib/utils';

interface GlobalMarketScannerProps {
  markets: ScannedMarket[];
  bestMarket: ScannedMarket | null;
  isScanning: boolean;
  lastScanTime: Date | null;
  totalMarketsScanned: number;
  onRefresh: () => void;
  onSelectMarket?: (symbol: string) => void;
  isConnected: boolean;
}

export function GlobalMarketScanner({
  markets,
  bestMarket,
  isScanning,
  lastScanTime,
  totalMarketsScanned,
  onRefresh,
  onSelectMarket,
  isConnected,
}: GlobalMarketScannerProps) {
  const { localize } = useAppTranslations();

  const topMarkets = useMemo(() => markets.slice(0, 6), [markets]);
  const rankedByEdge = useMemo(() => [...markets].sort((a, b) => b.edge - a.edge).slice(0, 4), [markets]);

  // Simple SVG bar chart for confidence (flex + SVG for beauty, no extra deps)
  const ConfidenceBars = ({ items }: { items: ScannedMarket[] }) => (
    <div className="space-y-2">
      {items.map((m, idx) => {
        const width = Math.max(8, Math.min(100, m.confidence));
        const isTop = idx === 0;
        return (
          <div key={m.symbol} className="flex items-center gap-2 text-xs">
            <div className="w-28 truncate font-medium text-foreground/90">{m.displayName}</div>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isTop ? 'bg-emerald-500' : m.confidence > 72 ? 'bg-primary' : 'bg-amber-500'
                )}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-12 text-right tabular-nums font-mono text-muted-foreground">
              {m.confidence.toFixed(0)}%
            </div>
            {onSelectMarket && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                onClick={() => onSelectMarket(m.symbol)}
                disabled={!isConnected}
              >
                Trade
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );

  // SVG Analysis Chart: Signal strength + mini trend lines for top markets
  const SignalAnalysisChart = () => {
    const top3 = topMarkets.slice(0, 3);
    if (top3.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">Waiting for live market data across Deriv symbols...</div>;

    const maxEdge = Math.max(...top3.map(m => m.edge || 1), 12);

    return (
      <div className="mt-3 rounded-lg border bg-background/60 p-3">
        <div className="text-[10px] uppercase tracking-[1px] text-muted-foreground mb-2 flex items-center justify-between">
          <span>AI Signal Strength Chart (Live)</span>
          <span className="font-mono">{lastScanTime ? lastScanTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
        </div>

        <svg viewBox="0 0 320 92" className="w-full h-[92px] text-foreground">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1="30" y1={20 + i * 18} x2="310" y2={20 + i * 18}
              stroke="currentColor" strokeOpacity={0.08} strokeWidth="1"
            />
          ))}

          {top3.map((market, idx) => {
            const yBase = 28 + idx * 22;
            const barWidth = Math.max(12, ((market.edge || 0) / maxEdge) * 160);
            const confHeight = (market.confidence / 100) * 14;

            // Color per market
            const color = idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#f59e0b';

            return (
              <g key={market.symbol}>
                {/* Market label */}
                <text x="4" y={yBase + 4} fontSize="9" fill="currentColor" opacity="0.75">{market.displayName.slice(0, 14)}</text>

                {/* Edge bar */}
                <rect
                  x="32" y={yBase - 6} width={barWidth} height="11"
                  rx="2" fill={color} fillOpacity="0.85"
                />

                {/* Confidence dot / mini bar */}
                <rect
                  x="32" y={yBase + 7} width={confHeight * 1.8} height="3.5"
                  rx="1" fill={color} fillOpacity="0.5"
                />

                {/* Value labels */}
                <text x={38 + barWidth} y={yBase + 3} fontSize="8" fill="currentColor" opacity="0.6">
                  {market.edge > 0 ? `+${market.edge}` : '0'} edge
                </text>
              </g>
            );
          })}

          {/* Axis label */}
          <text x="32" y="88" fontSize="7" fill="currentColor" opacity="0.4">Edge → | Confidence overlay</text>
        </svg>

        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <div>Best tradable: <span className="font-medium text-foreground">{bestMarket?.displayName || 'Scanning...'}</span></div>
          <div>{totalMarketsScanned} markets monitored</div>
        </div>
      </div>
    );
  };

  const aiSummary = useMemo(() => {
    if (!bestMarket) return 'AI is scanning all Deriv digit markets for statistical edges. Connect and wait for live ticks.';
    return `Strongest systematic opportunity right now is ${bestMarket.displayName} with ${bestMarket.confidence}% confidence and +${bestMarket.edge} edge. ${bestMarket.bestSignal}.`;
  }, [bestMarket]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Localize i18n_default_text="Global AI Market Scanner" />
            {isScanning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
          <p className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Live scan across all Deriv digit-supporting markets for the cleanest tradable edges" />
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={!isConnected}>
          <Localize i18n_default_text="Rescan Now" />
        </Button>
      </div>

      {/* AI Narrative Summary */}
      <Card className="border-primary/20 bg-muted/20">
        <CardContent className="pt-4 text-sm leading-snug">
          <div className="font-medium mb-1 text-primary">AI Signal Agent says:</div>
          {aiSummary}
        </CardContent>
      </Card>

      {/* The Analysis Chart */}
      <SignalAnalysisChart />

      {/* Ranked Markets List */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
          <span>Top Tradable Markets (ranked by AI edge + confidence)</span>
          <Badge variant="secondary" className="text-[10px]">{markets.filter(m => m.confidence > 55).length} strong signals</Badge>
        </div>

        <div className="space-y-1.5">
          {topMarkets.length > 0 ? (
            topMarkets.map((m) => (
              <div
                key={m.symbol}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
                  m.isBest ? 'border-emerald-500/60 bg-emerald-500/5' : 'bg-background'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="font-medium truncate">{m.displayName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono tabular-nums">{m.symbol}</div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="text-emerald-600 font-semibold tabular-nums">{m.confidence.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground -mt-0.5">conf</div>
                  </div>
                  <div>
                    <div className="font-semibold tabular-nums">+{m.edge}</div>
                    <div className="text-[10px] text-muted-foreground -mt-0.5">edge</div>
                  </div>
                  <Badge variant={m.confidence > 78 ? 'default' : 'outline'} className="text-[10px] px-1.5">
                    {m.bestSignal.length > 18 ? m.bestSignal.slice(0, 16) + '…' : m.bestSignal}
                  </Badge>

                  {onSelectMarket && (
                    <Button
                      size="sm"
                      variant={m.isBest ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => onSelectMarket(m.symbol)}
                      disabled={!isConnected}
                    >
                      <Localize i18n_default_text="Trade This" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground border rounded-md">
              Connecting to Deriv live feed to scan all markets...
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-center text-muted-foreground pt-1">
        Scanner runs continuously on authenticated Deriv connection. Best markets update automatically.
      </div>
    </div>
  );
}
