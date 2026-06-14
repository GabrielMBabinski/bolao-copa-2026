import { useState, useEffect } from 'react'
import { X, AlertCircle, UserRoundSearch } from 'lucide-react'
// O arsenal de anúncios duvidosos - Usando ícones/silhuetas misteriosas
const adsList = [
  {
    id: 1,
    title: "MÃES SOLTEIRAS",
    text: "Misteriosa 'Mãe de 3' a 5km quer saber: 'Você já pagou o PIX?'",
    bgColor: "bg-red-100"
  },
  {
    id: 2,
    title: "MULHER CASADA",
    text: "'Esposa do Zé' está online e quer te mandar uma cobrança via Telegram...",
    bgColor: "bg-pink-100"
  },
  {
    id: 3,
    title: "AUMENTE SEU...",
    text: "PRAZO DE PAGAMENTO! Mentira, o prazo é agora. Pague o PIX!",
    bgColor: "bg-blue-100"
  },
  {
    id: 4,
    title: "MÉTODO PROIBIDO",
    text: "Aprenda como ser cobrado 24h por dia por um Bot do Telegram. Clique!",
    bgColor: "bg-amber-100"
  },
  {
    id: 5,
    title: "VOCÊ GANHOU!",
    text: "Visitante nº 999.999! Resgate seu prêmio: Uma cobrança no WhatsApp.",
    bgColor: "bg-lime-100"
  }
]

export default function FakeAds() {
  const [currentAd, setCurrentAd] = useState(adsList[0])
  const [isVisible, setIsVisible] = useState(false)

  const showRandomAd = () => {
    const unselectedAds = adsList.filter(ad => ad.id !== currentAd.id);
    const randomAd = unselectedAds[Math.floor(Math.random() * unselectedAds.length)]
    setCurrentAd(randomAd)
    setIsVisible(true)
  }

  useEffect(() => {
    const initialTimer = setTimeout(showRandomAd, 5000)
    return () => clearTimeout(initialTimer)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(showRandomAd, 20000)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9000] w-72 animate-in slide-in-from-bottom-10 fade-in duration-500 font-sans">
      <div className="bg-white border-[3px] border-dashed border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] relative flex flex-col p-2 group hover:cursor-pointer">
        
        {/* Cabeçalho falso do anúncio */}
        <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Ads by CobrançaAtiva
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 rounded px-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo do Anúncio (Com silhueta misteriosa e borrada) */}
        <div 
          className="flex gap-3 items-center"
          onClick={() => alert('Para de clicar em besteira e faz o PIX! R$ 15,00 agora!')}
        >
          {/* USANDO UM ÍCONE MISTERIOSO COM BORRÃO AESTHETIC */}
          <div className={`${currentAd.bgColor} p-3 rounded border border-gray-300 animate-pulse`}>
            <UserRoundSearch className="w-10 h-10 text-gray-600 blur-[2px]" /> {/* Blur adicionado aqui */}
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
        <div className="mt-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-700 font-black text-[11px] text-center py-1 uppercase border border-yellow-600 animate-bounce">
          Ver Perfil Completo &gt;&gt;
        </div>

      </div>
    </div>
  )
}