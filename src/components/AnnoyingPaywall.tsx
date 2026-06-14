import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, X } from 'lucide-react'

export default function AnnoyingPaywall() {
  const { profile } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)

  // O seu código PIX (Copia e Cola)
  const pixCode = "00020126580014BR.GOV.BCB.PIX013663d9984d-bf80-49d3-a340-e6a925f9bca1520400005303986540515.005802BR5922Gabriel Mayer Babinski6009SAO PAULO62140510YkKPLsxjNc63046468"

  // Controla o aparecimento do Pop-up
  useEffect(() => {
    if (profile?.payment_status === 'unpaid') {
      const initialTimeout = setTimeout(() => {
        setIsVisible(true)
        setCountdown(10)
      }, 3000)

      const interval = setInterval(() => {
        setIsVisible(true)
        setCountdown(10)
      }, 15000) // Aparece a cada 15 segundos

      return () => {
        clearTimeout(initialTimeout)
        clearInterval(interval)
      }
    }
  }, [profile])

  // Controla o cronômetro do botão de fechar
  useEffect(() => {
    if (isVisible && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, countdown])

  if (!isVisible || profile?.payment_status !== 'unpaid') return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-card border-2 border-red-500 rounded-2xl w-full max-w-md p-6 flex flex-col items-center text-center shadow-[0_0_50px_rgba(239,68,68,0.3)] relative overflow-hidden">
        
        {/* Fundo listrado de perigo */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)' }}></div>

        <div className="bg-red-500/20 p-3 rounded-full mb-3 animate-bounce relative z-10">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-black text-red-500 mb-2 uppercase relative z-10">Cadê o PIX?!</h2>
        
        <p className="text-sm font-medium mb-4 relative z-10">
          Você está usando o bolão de graça. Faça o PIX de R$ 15,00 agora mesmo para parar de ver este aviso e validar seus palpites!
        </p>

        {/* ÁREA DO QR CODE E PIX COPIA E COLA */}
        <div className="bg-muted p-4 rounded-lg w-full mb-6 relative z-10 border border-border/50 flex flex-col items-center">
          <p className="text-xs font-bold mb-3 uppercase text-muted-foreground">Escaneie com o app do banco</p>
          
          {/* Imagem gerada dinamicamente pela API com o seu código PIX */}
          <div className="bg-white p-2 rounded-xl mb-4 shadow-sm">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`}
              alt="QR Code do PIX"
              className="w-40 h-40 object-contain"
            />
          </div>

          <p className="text-xs font-bold mb-2 uppercase text-muted-foreground">Ou use o PIX Copia e Cola:</p>
          <div className="w-full bg-background p-3 rounded border shadow-inner">
            <p className="text-[11px] font-mono break-all select-all text-muted-foreground text-left">
              {pixCode}
            </p>
          </div>
        </div>

        {/* Botão de Fechar com Cronômetro */}
        <button
          onClick={() => setIsVisible(false)}
          disabled={countdown > 0}
          className={`relative z-10 w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
            countdown > 0 
              ? 'bg-muted text-muted-foreground cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25'
          }`}
        >
          {countdown > 0 ? (
            `Aguarde ${countdown} segundos para fechar...`
          ) : (
            <>
              <X className="h-5 w-5" /> Fechar (Por enquanto)
            </>
          )}
        </button>
      </div>
    </div>
  )
}