import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { siteAudio, startAudioOnInteract } from '@/lib/audio'

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    // Tenta tocar assim que o componente carrega
    startAudioOnInteract();

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    siteAudio.addEventListener('play', handlePlay);
    siteAudio.addEventListener('pause', handlePause);

    return () => {
      siteAudio.removeEventListener('play', handlePlay);
      siteAudio.removeEventListener('pause', handlePause);
    }
  }, [])

  const togglePlay = () => {
    if (siteAudio.paused) {
      siteAudio.play();
    } else {
      siteAudio.pause();
    }
  }

  return (
    <button 
      onClick={togglePlay}
      className="fixed bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-xl z-50 hover:scale-110 transition-transform flex items-center justify-center"
      aria-label="Alternar Som do Site"
    >
      {isPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
    </button>
  )
}