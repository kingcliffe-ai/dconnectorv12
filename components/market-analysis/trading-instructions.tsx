'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Localize } from '@deriv-com/translations';

export function TradingInstructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Localize i18n_default_text="Systematic Digit Trading Guide" />
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm space-y-4 text-muted-foreground">
        <div>
          <h4 className="font-semibold text-foreground mt-1">How the Analyzer Works</h4>
          <p>
            The Market Analyzer continuously processes the last 200 ticks. It calculates frequency distribution, streak length, volatility, and skew to identify statistical deviations from the theoretical uniform 10% per digit.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">Available Strategies</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Statistical Edge</strong>: Enters on the digit that has appeared most frequently when its probability significantly exceeds 10%.</li>
            <li><strong>Reversion</strong>: After 3+ identical digits in a row, the probability of continuation drops. The bot favors the opposite outcome.</li>
            <li><strong>Momentum</strong>: In low-volatility regimes, hot digits often continue for a few more ticks.</li>
            <li><strong>Balanced</strong>: Uses a weighted combination of the above signals.</li>
            <li><strong>Aggressive</strong>: Lowers the entry threshold to capture more opportunities (higher risk).</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">Risk Management Built Into the Bot</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Minimum confidence filter (default 68%)</li>
            <li>Cooldown between trades to avoid overtrading</li>
            <li>Hard session trade count limit</li>
            <li>Maximum loss stop (auto halts the bot)</li>
            <li>Simulation mode enabled by default — switch off only when you fully understand the risk</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-foreground">Best Practices</h4>
          <p>
            1. Start in Simulation mode and observe signals for 15–30 minutes.<br />
            2. Use smaller stakes when first enabling real trading.<br />
            3. Avoid running the bot on very high volatility symbols or during major news.<br />
            4. Review the trade log regularly and adjust min confidence upward if win rate is below 55%.<br />
            5. The AI Agent provides natural language interpretation of the same underlying data.
          </p>
        </div>

        <div className="pt-2 border-t text-[11px] text-muted-foreground">
          This is an educational systematic tool. Past performance does not guarantee future results. Trade responsibly.
        </div>
      </CardContent>
    </Card>
  );
}
