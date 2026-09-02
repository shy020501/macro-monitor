import { createProviderRegistry } from "@/lib/data-providers/registry"
import { AlphaVantageGoldProvider } from "@/lib/data-providers/market/alpha-vantage"
import {
  createPythonYFinanceBridgeRunner,
  YahooFinanceProvider,
} from "@/lib/data-providers/market/yahoo-finance"

interface MarketProviderRegistryOptions {
  environment?: Record<string, string | undefined>
  cwd?: string
}

export function createMarketProviderRegistry(
  options: MarketProviderRegistryOptions = {}
) {
  const environment = options.environment ?? process.env
  return createProviderRegistry([
    new YahooFinanceProvider(
      createPythonYFinanceBridgeRunner({
        pythonExecutable: environment.YFINANCE_PYTHON_PATH,
        cwd: options.cwd,
      })
    ),
    new AlphaVantageGoldProvider({
      apiKey: environment.ALPHA_VANTAGE_API_KEY,
    }),
  ])
}
