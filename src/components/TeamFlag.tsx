// Map 3-letter country codes to 2-letter ISO 3166-1 alpha-2 codes
const flagCodeMap: Record<string, string> = {
  // Group A
  'MEX': 'mx',
  'CAN': 'ca',
  'MAR': 'ma',
  'CRO': 'hr',
  
  // Group B
  'ESP': 'es',
  'NED': 'nl',
  'ENG': 'gb',
  'DEN': 'dk',
  
  // Group C
  'ARG': 'ar',
  'COL': 'co',
  'CHI': 'cl',
  'PER': 'pe',
  
  // Group D
  'BRA': 'br',
  'URU': 'uy',
  'ECU': 'ec',
  'PAR': 'py',
  
  // Group E
  'GER': 'de',
  'BEL': 'be',
  'SUI': 'ch',
  'HUN': 'hu',
  
  // Group F
  'POR': 'pt',
  'FRA': 'fr',
  'AUT': 'at',
  'TUR': 'tr',
  
  // Group G
  'JPN': 'jp',
  'KOR': 'kr',
  'IRN': 'ir',
  'UZB': 'uz',
  
  // Group H
  'SEN': 'sn',
  'EGY': 'eg',
  'TUN': 'tn',
  'RSA': 'za',
  
  // Group I
  'USA': 'us',
  'MNE': 'me',
  'SVN': 'si',
  'GRL': 'gl',
  
  // Group J
  'AUS': 'au',
  'KSA': 'sa',
  'QAT': 'qa',
  'NZL': 'nz',
  
  // Group K
  'NGA': 'ng',
  'CIV': 'ci',
  'CMR': 'cm',
  'GHA': 'gh',
  
  // Group L
  'POL': 'pl',
  'UKR': 'ua',
  'CZE': 'cz',
  'ROU': 'ro',
}

interface TeamFlagProps {
  flagCode: string
  className?: string
}

export default function TeamFlag({ flagCode, className = '' }: TeamFlagProps) {
  const isoCode = flagCodeMap[flagCode] || flagCode.toLowerCase()
  
  return (
    <img
      src={`https://flagcdn.com/w40/${isoCode}.png`}
      alt={flagCode}
      className={`w-6 h-4 rounded-sm object-cover ${className}`}
      onError={(e) => {
        // Fallback to a placeholder if the flag fails to load
        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16"%3E%3Crect width="24" height="16" fill="%23e5e7eb"/%3E%3Ctext x="12" y="12" text-anchor="middle" font-size="8" fill="%236b7280"%3E?%3C/text%3E%3C/svg%3E'
      }}
    />
  )
}
