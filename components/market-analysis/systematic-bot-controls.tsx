'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Localize } from '@deriv-com/translations';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import { cn } from '@/lib/utils';
import type { BotSettings, BotState, BotStrategy } from '@/hooks/use-trading-bot';
import type { BotTradeLog } from '@/lib/market-analyzer';

interface SystematicBotControlsProps {
  settings: BotSettings;
  state: BotState;
  onUpdateSettings: (partial: Partial<BotSettings>) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onToggleSimulation: () => void;
  isConnected: boolean;
  isAuthenticated: boolean;
  canTrade: boolean;
}

const STRATEGIES: { value: BotStrategy; label: string; desc: string }[] = [
  { value: 'statistical', label: 'Statistical Edge', desc: 'Trade the most frequent digit' },
  { value: 'reversion', label: 'Reversion', desc: 'Bet against long streaks' },
  { value: 'momentum', label: 'Momentum', desc: 'Follow current hot digits' },
  { value: 'balanced', label: 'Balanced', desc: 'Mix of multiple signals' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Lower threshold, more trades' },
];

export function SystematicBotControls({
  settings,
  state,
  onUpdateSettings,
  onStart,
  onStop,
  onReset,
  onToggleSimulation,
  isConnected,
  isAuthenticated,
  canTrade,
}: SystematicBotControlsProps) {
  const { localize } = useAppTranslations();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isRunning = state.isRunning;

  const handleStrategyChange = (val: BotStrategy) => {
    onUpdateSettings({ strategy: val });
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Localize i18n_default_text="Systematic Trading Bot" />
            {isRunning && (
              <Badge variant="default" className="animate-pulse">
                <Localize i18n_default_text="RUNNING" />
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Rule-based automated entries using live market analysis" />
          </p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={onStart}
              disabled={!isConnected || !isAuthenticated || !canTrade}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Localize i18n_default_text="Start Bot" />
            </Button>
          ) : (
            <Button onClick={onStop} variant="destructive">
              <Localize i18n_default_text="Stop Bot" />
            </Button>
          )}
          <Button onClick={onReset} variant="outline" size="sm">
            <Localize i18n_default_text="Reset" />
          </Button>
        </div>
      </div>

      {/* Simulation Toggle - Critical Safety */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
        <div>
          <div className="font-medium text-sm">
            <Localize i18n_default_text="Simulation Mode" />
          </div>
          <div className="text-xs text-muted-foreground">
            {settings.simulationMode
              ? localize('No real trades — logs only (recommended for testing)')
              : localize('REAL MONEY — bot will place actual contracts')}
          </div>
        </div>
        <button
          onClick={onToggleSimulation}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            settings.simulationMode ? 'bg-emerald-600' : 'bg-destructive'
          )}
          aria-pressed={!settings.simulationMode}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
              settings.simulationMode ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {!settings.simulationMode && (
        <div className="rounded-md border border-destructive/60 bg-destructive/5 p-3 text-xs text-destructive">
          <Localize i18n_default_text="WARNING: Real trading mode is active. The bot will use your account balance to place trades automatically." />
        </div>
      )}

      {/* Strategy Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          <Localize i18n_default_text="Active Strategy" />
        </Label>
        <Select value={settings.strategy} onValueChange={handleStrategyChange} disabled={isRunning}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <div>
                  <div>{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Core Parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="min-conf" className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Min Confidence (%)" />
          </Label>
          <Input
            id="min-conf"
            type="number"
            value={settings.minConfidence}
            onChange={(e) => onUpdateSettings({ minConfidence: Math.max(52, Math.min(94, parseInt(e.target.value) || 68)) })}
            min={52}
            max={94}
            disabled={isRunning}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stake-bot" className="text-xs text-muted-foreground">
            <Localize i18n_default_text="Bot Stake (USD)" />
          </Label>
          <Input
            id="stake-bot"
            type="number"
            value={settings.stake}
            onChange={(e) => onUpdateSettings({ stake: Math.max(1, Math.min(200, parseFloat(e.target.value) || 10)) })}
            min={1}
            step="0.5"
            disabled={isRunning}
          />
        </div>
      </div>

      {/* Advanced Controls */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced risk controls
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max Trades / Session</Label>
            <Input
              type="number"
              value={settings.maxTradesPerSession}
              onChange={(e) => onUpdateSettings({ maxTradesPerSession: Math.max(3, Math.min(100, parseInt(e.target.value) || 25)) })}
              disabled={isRunning}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max Loss Limit (USD)</Label>
            <Input
              type="number"
              value={settings.maxLossUSD}
              onChange={(e) => onUpdateSettings({ maxLossUSD: Math.max(10, Math.min(1000, parseFloat(e.target.value) || 150)) })}
              disabled={isRunning}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cooldown (seconds)</Label>
            <Input
              type="number"
              value={settings.cooldownSeconds}
              onChange={(e) => onUpdateSettings({ cooldownSeconds: Math.max(4, Math.min(120, parseInt(e.target.value) || 12)) })}
              disabled={isRunning}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Duration (ticks)</Label>
            <Input
              type="number"
              value={settings.duration}
              onChange={(e) => onUpdateSettings({ duration: Math.max(1, Math.min(20, parseInt(e.target.value) || 5)) })}
              disabled={isRunning}
            />
          </div>
        </div>
      )}

      {/* Live Performance */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            <Localize i18n_default_text="Bot Session Performance" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center text-sm pt-0">
          <div>
            <div className="text-muted-foreground text-[10px]">Trades</div>
            <div className="font-semibold tabular-nums text-lg">{state.performance.totalTrades}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">Win Rate</div>
            <div className="font-semibold tabular-nums text-lg">{state.performance.winRate}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px]">Net P/L</div>
            <div className={`font-semibold tabular-nums text-lg ${state.performance.netPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {state.performance.netPL >= 0 ? '+' : ''}{state.performance.netPL.toFixed(2)}
            </div>
          </div>
          <div className="col-span-3 text-[10px] text-muted-foreground pt-1 border-t">
            Session loss used: ${state.sessionLoss.toFixed(2)} / ${settings.maxLossUSD}
          </div>
        </CardContent>
      </Card>

      {/* Trade Log */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-muted-foreground">
            <Localize i18n_default_text="Bot Trade Log" /> ({state.logs.length})
          </div>
        </div>
        <div className="max-h-52 overflow-auto rounded-md border bg-background text-xs font-mono">
          {state.logs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Localize i18n_default_text="No bot trades yet. Start the bot to begin systematic scanning." />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-[10px] text-muted-foreground">
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Trade</th>
                  <th className="p-2">Conf</th>
                  <th className="p-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.slice(0, 12).map((log: BotTradeLog) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="p-2 text-[10px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-2">
                      {log.contractMode} {log.digit ?? ''} @ ${log.stake}
                      <div className="text-[9px] text-muted-foreground truncate max-w-[170px]">{log.reason}</div>
                    </td>
                    <td className="p-2 text-center">{log.confidence}</td>
                    <td className="p-2 text-center">
                      {log.result === 'win' && <span className="text-emerald-600">WIN</span>}
                      {log.result === 'loss' && <span className="text-red-600">LOSS</span>}
                      {log.result === 'pending' && <span className="text-amber-600">PENDING</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
