export class FredConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FredConfigurationError"
  }
}

export function getFredApiKey(
  environment: Record<string, string | undefined> = process.env
): string {
  const apiKey = environment.FRED_API_KEY?.trim()

  if (!apiKey) {
    throw new FredConfigurationError(
      "FRED_API_KEY is not configured. Add it to .env.local before running FRED sync."
    )
  }

  return apiKey
}
