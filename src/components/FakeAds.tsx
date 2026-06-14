import { useState, useEffect } from 'react'
import { X, AlertCircle, Heart, Zap, Gift, Flame, TrendingUp } from 'lucide-react'

// O arsenal de anúncios duvidosos
const adsList = [
  {
    id: 1,
    title: "MÃES SOLTEIRAS",
    text: "A 5km de distância querendo ver os seus palpites da rodada hoje à noite no sigilo!",
    bgColor: "bg-red-100 text-red-500",
    icon: Flame
  },
  {
    id: 2,
    title: "MULHER CASADA",
    text: "Ela está sozinha em casa e quer compartilhar os placares exatos da final com você...",
    bgColor: "bg-pink-100 text-pink-500",
    icon: Heart
  },
  {
    id: 3,
    title: "AUMENTE SEU...",
    text: "SCORE NO BOLÃO! Com esta pílula asiática milagrosa aprovada por especialistas.",
    bgColor: "bg-blue-100 text-blue-500",
    icon: Zap
  },
  {
    id: 4,
    title: "MÉTODO PROIBIDO",
    text: "Jovem fatura R$ 50.000 por dia apostando em escanteio. Assista antes que o governo apague!",
    bgColor: "bg-emerald-100 text-emerald-600",
    icon: TrendingUp
  },
  {
    id: 5,
    title: "VOCÊ GANHOU!",
    text: "Você é o visitante nº 999.999 do site! Clique aqui para resgatar seu iPhone 15.",
    bgColor: "bg-amber-100 text-amber-500",
    icon: Gift
  }
]

export default function FakeAds() {
  const [currentAd, setCurrentAd] = useState(adsList[0])
  const [isVisible, setIsVisible] = useState(false)

  const showRandomAd = () => {
    const unselectedAds = adsList.filter(ad => ad.id !== currentAd.id)
    const randomAd = unselectedAds[Math.floor(Math.random() * unselectedAds.length)]
    setCurrentAd(randomAd)
    setIsVisible(true)
  }

  useEffect(() => {
    const initialTimer = setTimeout(showRandomAd, 5000)
    return () => clearTimeout(initialTimer)
  }, [])

  // NOVA LÓGICA DE SUSTO: Não usamos mais window.open aqui!
  const handleScareTactics = () => {
    setIsVisible(false)
    
    setTimeout(showRandomAd, 20000)

    setTimeout(() => {
      // 1. O navegador pausa tudo e exibe a mensagem
      alert('⚠️ AMEAÇA DETECTADA! Seu dispositivo foi exposto a 3 Cavalos de Troia.\n\nVocê será redirecionado para instalar um Antivírus imediatamente.')
      
      // 2. Assim que ele clica em "OK", esta linha executa e sequestra a aba atual!
      window.location.href = 'https://www.avast.com/pt-br/download-thank-you.php?product=AVAST-ONE-MOD-WIN-AV-FAD&locale=pt-br&direct=1'
    }, 100)
  }

  const IconComponent = currentAd.icon

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9000] w-72 animate-in slide-in-from-bottom-10 fade-in duration-500 font-sans">
      
      {/* O GOLPE DE MESTRE: Trocamos a <div> por uma tag <a>. 
        Nenhum bloqueador de pop-up do mundo bloqueia um link clicado pelo usuário!
      */}
      <a 
        href="https://www.avast.com/pt-br/download-thank-you.php?product=AVAST-ONE-MOD-WIN-AV-FAD&locale=pt-br&direct=1"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white border-[3px] border-dashed border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] relative flex flex-col p-2 group hover:cursor-pointer transition-transform hover:scale-105 select-none no-underline"
        onClick={handleScareTactics}
      >
        
        {/* Cabeçalho falso do anúncio */}
        <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Ads by BolãoFree
          </span>
          
          <span className="bg-gray-200 text-gray-500 rounded px-1 group-hover:bg-red-500 group-hover:text-white transition-colors flex items-center justify-center">
            <X className="h-4 w-4" />
          </span>
        </div>

        {/* Corpo do Anúncio */}
        <div className="flex gap-3 items-center">
          <div className={`${currentAd.bgColor} p-3 rounded border border-gray-300 animate-pulse`}>
            <IconComponent className="w-10 h-10 blur-[2px]" />
          </div>
          
          <div className="flex flex-col flex-1">
            <span className="text-blue-700 font-black text-sm leading-tight underline mb-1 uppercase decoration-red-500">
              {currentAd.title}
            </span>
            <span className="text-gray-700 text-xs leading-tight font-medium">
              {currentAd.text}
            </span>
          </div>
        </div>
        
        {/* Botão falso de CTA */}
        <div className="mt-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-700 font-black text-[11px] text-center py-1 uppercase border border-yellow-600 animate-bounce group-hover:from-red-600 group-hover:to-red-700 group-hover:text-white transition-all">
          Clique aqui e descubra &gt;&gt;
        </div>

      </a>
    </div>
  )
}