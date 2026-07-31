{/*import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
  */}

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { Trophy } from "lucide-react"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md flex flex-col items-center">
        <div className="bg-yellow-500/20 p-6 rounded-full mb-8">
          <Trophy className="h-16 w-16 text-yellow-500 animate-pulse" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
          O Bolão Chegou ao Fim!
        </h1>

        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          A Copa do Mundo foi um sucesso e os resultados finais já estão gravados na história.
          O site encontra-se em modo de manutenção e as atividades foram encerradas.
          Agradecemos a todos os participantes!
        </p>

        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm">
          Até a próxima Copa!
        </div>
      </div>
    </div>
  </React.StrictMode>,
)
