"""
Configurazione logging strutturato per Gio.ia Web App
"""
import logging
import sys
import os

try:
    import colorlog
    COLORLOG_AVAILABLE = True
except ImportError:
    COLORLOG_AVAILABLE = False


def setup_logging(service_name: str = "web-app"):
    """
    Configura logging strutturato con colorlog.
    
    Args:
        service_name: Nome del servizio per identificare log
    """
    # Handler per stdout con colori
    handler = logging.StreamHandler(sys.stdout)
    
    # Livello da variabile ambiente o default INFO
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    handler.setLevel(getattr(logging, log_level, logging.INFO))
    
    if COLORLOG_AVAILABLE:
        # Formatter colorato
        formatter = colorlog.ColoredFormatter(
            f'%(log_color)s[%(levelname)s]%(reset)s %(cyan)s{service_name}%(reset)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            reset=True,
            log_colors={
                'DEBUG': 'white',
                'INFO': 'blue',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            },
            secondary_log_colors={},
            style='%'
        )
    else:
        # Formatter semplice se colorlog non disponibile
        formatter = logging.Formatter(
            f'[%(levelname)s] {service_name} | %(asctime)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    handler.setFormatter(formatter)
    
    # Configura root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))
    
    # Rimuovi handler esistenti
    root_logger.handlers = []
    
    # Aggiungi handler colorato
    root_logger.addHandler(handler)
    
    # Configura logger specifici per ridurre verbosità
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('aiohttp').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.error').setLevel(logging.INFO)
    
    return root_logger
