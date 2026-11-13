'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { Localize } from '@deriv-com/translations';
import type { MarketAnalysis, MarketSignal } from '@/lib/market-analyzer';
import { queryAIAgent, generateAIAnalysis } from '@/lib/market-analyzer';

interface AIMarketAgentProps {
  analysis: MarketAnalysis | null;
  symbol: string | null;
  lastDigit: number | null;
  isConnected: boolean;
  onRequestScan?: () => void;
}

export function AIMarketAgent({
  analysis,
  symbol,
  lastDigit,
  isConnected,
  onRequestScan,
}: AIMarketAgentProps) {
  const { localize } = useAppTranslations();
  const [query, setQuery] = useState('');
  const [responses, setResponses] = useState<Array<{ q: string; a: string }>>([
    {
      q: 'Initial scan',
      a: 'AI Market Agent is live. Ask me about current signals, hot digits, streaks, volatility, or best entries.',
    },
  ]);

  const handleAsk = () => {
    if (!query.trim() || !analysis) return;

    const answer = queryAIAgent(query, analysis, symbol, lastDigit);
    setResponses((prev) => [...prev.slice(-4), { q: query.trim(), a: answer }]);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleAsk();
    }
  };

  const runFullScan = () => {
    if (analysis && symbol) {
      const full = generateAIAnalysis(analysis, symbol);
      setResponses((prev) => [
        ...prev.slice(-3),
        { q: 'Full live market scan', a: full },
      ]);
    }
    onRequestScan?.();
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Localize i18n_default_text="Market Analysis AI Agent" />
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runFullScan} disabled={!isConnected || !analysis}>
            <Localize i18n_default_text="Scan Live Feed" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <Localize i18n_default_text="Real-time systematic signal analysis on live Deriv ticks" />
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live Signals Summary */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            <Localize i18n_default_text="Current AI Signals" />
          </div>
          {analysis?.signals && analysis.signals.length > 0 ? (
            <div className="space-y-2">
              {analysis.signals.slice(0, 3).map((sig: MarketSignal, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between rounded-md border bg-muted/30 p-2.5 text-sm"
                >
                  <div>
                    <div className="font-semibold">
                      {sig.contractMode} {sig.digit !== undefined ? sig.digit : ''}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                      {sig.reason}
                    </div>
                  </div>
                  <Badge variant={sig.confidence > 78 ? 'default' : 'secondary'} className="shrink-0">
                    {sig.confidence}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              <Localize i18n_default_text="Analyzing live feed..." />
            </div>
          )}
        </div>

        {/* AI Chat */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            <Localize i18n_default_text="Ask the Agent" />
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={localize('What is the best trade right now?')}
              className="flex-1"
              disabled={!analysis}
            />
            <Button onClick={handleAsk} disabled={!query.trim() || !analysis}>
              <Localize i18n_default_text="Ask" />
            </Button>
          </div>

          <div className="max-h-[210px] overflow-y-auto space-y-3 rounded-md border bg-background p-3 text-sm">
            {responses.slice().reverse().map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  You: {r.q}
                </div>
                <div className="text-foreground leading-snug whitespace-pre-wrap">{r.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        {analysis && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Volatility</div>
              <div className="font-semibold text-lg tabular-nums">{analysis.volatility}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-muted-foreground">Ticks Analyzed</div>
              <div className="font-semibold text-lg tabular-nums">{analysis.totalTicksAnalyzed}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
