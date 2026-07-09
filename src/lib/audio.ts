// src/lib/audio.ts

export const siteAudio = new Audio("Kylian-dictador.mp3");
siteAudio.loop = true;
siteAudio.volume = 0.5; 

export const startAudioOnInteract = () => {
  if (siteAudio.paused) {
    siteAudio.play().catch((err) => {
      console.log("Aguardando interação do usuário para tocar o áudio.", err);
    });
  }
};