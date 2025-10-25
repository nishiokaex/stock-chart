import AsyncStorage from '@react-native-async-storage/async-storage'

export const MARKET_CUSTOM_SYMBOLS_KEY = 'market.customSymbols'

export type StoredCustomSymbol = {
  symbol: string
  label: string
}

export const loadCustomSymbols = async (): Promise<StoredCustomSymbol[]> => {
  try {
    const raw = await AsyncStorage.getItem(MARKET_CUSTOM_SYMBOLS_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as StoredCustomSymbol[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item) => typeof item?.symbol === 'string' && typeof item?.label === 'string',
    )
  } catch (error) {
    console.error('[market] Failed to load custom symbols', error)
    return []
  }
}

export const saveCustomSymbols = async (symbols: StoredCustomSymbol[]) => {
  try {
    await AsyncStorage.setItem(MARKET_CUSTOM_SYMBOLS_KEY, JSON.stringify(symbols))
  } catch (error) {
    console.error('[market] Failed to save custom symbols', error)
    throw error
  }
}
