// Map 3-letter country codes to 2-letter ISO 3166-1 alpha-2 codes or regional codes
const codeMap: Record<string, string> = {
  // CONCACAF (6)
  'CAN': 'ca', 'USA': 'us', 'MEX': 'mx', 'CUW': 'cw', 'HAI': 'ht', 'PAN': 'pa',
  // AFC (AFC + AUS) (9)
  'JPN': 'jp', 'IRN': 'ir', 'UZB': 'uz', 'KOR': 'kr', 'JOR': 'jo', 'AUS': 'au', 'QAT': 'qa', 'KSA': 'sa', 'IRQ': 'iq',
  // OFC (1)
  'NZL': 'nz',
  // CONMEBOL (6)
  'ARG': 'ar', 'BRA': 'br', 'ECU': 'ec', 'URU': 'uy', 'COL': 'co', 'PAR': 'py',
  // CAF (10)
  'MAR': 'ma', 'TUN': 'tn', 'EGY': 'eg', 'ALG': 'dz', 'GHA': 'gh', 'CPV': 'cv', 'RSA': 'za', 'CIV': 'ci', 'SEN': 'sn', 'COD': 'cd',
  // UEFA (16)
  'ENG': 'gb-eng', 'FRA': 'fr', 'CRO': 'hr', 'POR': 'pt', 'NOR': 'no', 'NED': 'nl', 'GER': 'de', 'SUI': 'ch', 'AUT': 'at', 'BEL': 'be', 'ESP': 'es', 'SCO': 'gb-sct', 'TUR': 'tr', 'CZE': 'cz', 'SWE': 'se', 'BIH': 'ba',
}

interface TeamFlagProps {
  flagCode: string
  className?: string
}

export default function TeamFlag({ flagCode, className = '' }: TeamFlagProps) {
  const isoCode = codeMap[flagCode.toUpperCase()] || 'unknown'
  
  return (
    <img
      src={`https://flagcdn.com/w40/${isoCode}.png`}
      alt={flagCode}
      className={`w-6 h-4 rounded-sm object-cover shadow-sm ${className}`}
      onError={(e) => {
        // Fallback to a placeholder if the flag fails to load
        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16"%3E%3Crect width="24" height="16" fill="%23e5e7eb"/%3E%3Ctext x="12" y="12" text-anchor="middle" font-size="8" fill="%236b7280"%3E?%3C/text%3E%3C/svg%3E'
      }}
    />
  )
}
