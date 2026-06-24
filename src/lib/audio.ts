// src/lib/audio.ts

export const siteAudio = new Audio('/Endrick-musica.mp3');
siteAudio.loop = true;
siteAudio.volume = 1.0; 

export const startAudioOnInteract = () => {
  if (siteAudio.paused) {
    siteAudio.play().catch((err) => {
      console.log("Aguardando interação do usuário para tocar o áudio.", err);
    });
  }
};