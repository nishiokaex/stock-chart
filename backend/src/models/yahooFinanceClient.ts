type YahooFinanceModule = typeof import('yahoo-finance2')
type YahooFinanceInstance = InstanceType<YahooFinanceModule['default']>

let yahooFinanceClientPromise: Promise<YahooFinanceInstance> | null = null

export const loadYahooFinance = async (): Promise<YahooFinanceInstance> => {
  const globalAny = globalThis as Record<string, unknown>

  if (globalAny.__dirname === undefined) {
    globalAny.__dirname = '/'
  }
  if (globalAny.__filename === undefined) {
    globalAny.__filename = '/index.js'
  }

  if (!yahooFinanceClientPromise) {
    yahooFinanceClientPromise = import('yahoo-finance2').then((module) => new module.default())
  }

  return yahooFinanceClientPromise
}

