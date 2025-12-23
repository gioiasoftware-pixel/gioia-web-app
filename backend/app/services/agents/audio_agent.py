"""
Audio Agent - Specializzato per conversione audio in testo (speech-to-text).
Usa OpenAI Whisper API per la trascrizione.
"""
from .base_agent import BaseAgent
from openai import OpenAI
import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class AudioAgent(BaseAgent):
    """Agent specializzato per conversione audio->testo"""
    
    def __init__(self):
        # AudioAgent non usa Assistants API, solo Whisper API
        # Quindi non chiamiamo super().__init__()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY non configurata")
        
        self.client = OpenAI(api_key=api_key)
        self.name = "AudioAgent"
        logger.info(f"✅ Created {self.name}")
    
    async def transcribe_audio(
        self,
        audio_file: bytes,
        filename: str,
        language: Optional[str] = "it"
    ) -> Dict[str, Any]:
        """
        Converte audio in testo usando OpenAI Whisper API.
        
        Args:
            audio_file: Contenuto file audio (bytes)
            filename: Nome file (per determinare formato)
            language: Lingua audio (default: "it" per italiano)
        
        Returns:
            Dict con:
                - success: bool
                - text: Testo trascritto
                - error: Messaggio errore se success=False
        """
        try:
            # Determina formato file
            file_ext = filename.lower().split('.')[-1] if '.' in filename else 'webm'
            
            # Whisper accetta: mp3, mp4, mpeg, mpga, m4a, wav, webm
            supported_formats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg']
            if file_ext not in supported_formats:
                logger.warning(f"[AudioAgent] Formato {file_ext} non supportato, provo comunque")
            
            # Crea file temporaneo in memoria per OpenAI
            import io
            audio_io = io.BytesIO(audio_file)
            audio_io.name = f"audio.{file_ext}"
            
            # Chiama Whisper API con parametri ottimizzati
            # whisper-1 è il modello più recente e accurato disponibile tramite OpenAI API
            logger.info(f"[AudioAgent] Trascrizione audio: {filename} ({len(audio_file)} bytes), language={language}")
            
            # Prompt specifico per migliorare accuratezza nel dominio inventario vini
            # Aiuta il modello a riconoscere meglio termini tecnici come nomi di vini, quantità, movimenti
            prompt = (
                "Trascrivi il seguente audio in italiano. "
                "Questo è un messaggio relativo alla gestione di un inventario di vini. "
                "Termini comuni: vino, bottiglie, consumo, rifornimento, quantità, inventario, "
                "barolo, chianti, brunello, rosso, bianco, rosato, spumante. "
                "Usa punteggiatura corretta e scrivi i numeri in cifre (es: 5 bottiglie, non cinque bottiglie)."
            )
            
            transcript = self.client.audio.transcriptions.create(
                model="whisper-1",  # Modello più recente e accurato disponibile (ultimo aggiornamento: 2023)
                file=audio_io,
                language=language,  # "it" per italiano - migliora accuratezza
                response_format="text",  # Restituisce solo testo, non JSON
                prompt=prompt  # Prompt contestuale per migliorare accuratezza nel dominio specifico
            )
            
            # Se transcript è una stringa, è già il testo
            text = transcript if isinstance(transcript, str) else transcript.text
            
            if not text or not text.strip():
                return {
                    "success": False,
                    "error": "Audio non contiene parlato o non è stato possibile trascrivere"
                }
            
            logger.info(f"[AudioAgent] ✅ Trascrizione completata: {len(text)} caratteri")
            return {
                "success": True,
                "text": text.strip(),
                "language": language
            }
        
        except Exception as e:
            logger.error(f"[AudioAgent] ❌ Errore trascrizione: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore trascrizione audio: {str(e)}"
            }


