/**
 * AnchoredFlowStockChart - Componente grafico Flow+Stock per desktop
 * 
 * Rendering del grafico ancorato a stock di oggi usando Chart.js
 * Gestisce:
 * - Serie stock (linea)
 * - Serie inflow (area sopra baseline)
 * - Serie outflow (area sotto baseline)
 * - POI (punti di interesse)
 * - Preset periodo (day/week/month/quarter/year)
 * - Caso vino non venduto (linea piatta, nessuna area)
 */

/**
 * Crea e renderizza il grafico Flow+Stock ancorato
 * @param {HTMLCanvasElement} canvas - elemento canvas
 * @param {Object} chartData - dati del grafico da buildAnchoredFlowStockChart
 * @param {Object} options - opzioni di rendering
 * @returns {Chart} istanza Chart.js
 */
function renderAnchoredFlowStockChart(canvas, chartData, options = {}) {
    console.log('[AnchoredFlowStockChart] render chiamata', { canvas, chartData, options });
    
    // Verifica Chart.js
    if (typeof Chart === 'undefined') {
        console.error('[AnchoredFlowStockChart] Chart.js non disponibile');
        return null;
    }
    console.log('[AnchoredFlowStockChart] Chart.js disponibile');
    
    const buildAnchoredFlowStockChart = window.AnchoredFlowStockChartBuilder?.build;
    if (!buildAnchoredFlowStockChart) {
        console.error('[AnchoredFlowStockChart] Builder non disponibile');
        return null;
    }
    const {
        points,
        yDomain,
        yTickFormatter,
        tooltipForIndex,
        hasNoMovement,
        anchorStock, // Stock di oggi (per riferimento)
        mediaStock, // Media stock nel periodo (usata per baseline)
    } = chartData;

    // Colori brand (da tokens CSS o fallback)
    const colors = {
        inflow: options.inflowColor || '#87AE73', // Verde salvia per rifornimenti
        outflow: options.outflowColor || '#9a182e', // Granaccia (colore logo) per consumi
        stock: options.stockColor || '#333333', // Grigio scuro
        baseline: options.baselineColor || '#666666', // Grigio medio
        poi: options.poiColor || '#000000', // Nero
    };

    // Labels per asse X (formato data)
    const labels = points.map(p => {
        if (chartData.granularity === 'hour') {
            return p.t.toLocaleString('it-IT', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return p.t.toLocaleDateString('it-IT', { 
            day: '2-digit', 
            month: '2-digit',
            year: chartData.range.to.getTime() - chartData.range.from.getTime() > 90 * 24 * 60 * 60 * 1000 
                ? 'numeric' 
                : undefined
        });
    });

    // Dataset per stock line (baseline = 0 normalizzato, che corrisponde alla MEDIA stock)
    const stockLineData = points.map(p => p.stockNorm);

    // Dataset per linea "Stock di Oggi" (linea guida orizzontale alla quota dello stock di oggi)
    // anchorStock è lo stock di oggi in valori assoluti, normalizzato rispetto a mediaStock
    const todayStockNorm = anchorStock - mediaStock; // normalizzato rispetto alla media
    const todayStockLineData = points.map(() => todayStockNorm); // linea orizzontale alla quota di oggi

    // Dataset per aree (normalizzate rispetto alla MEDIA stock):
    // - Rifornimenti (Inflow): da stockNorm (y0 = base = linea stock) a stockNorm + inflow (y1) - sopra baseline (rialzo)
    // - Consumi (Outflow): da stockNorm - outflow (y0) a stockNorm (y1 = base = linea stock) - sotto baseline (ribasso)
    // Entrambe le aree partono dalla linea stock (stockNorm) come base d'appoggio
    const inflowAreaTop = points.map(p => p.inflow_y1); // top dell'area rifornimenti (stockNorm + inflow)
    const outflowAreaBottom = points.map(p => p.outflow_y0); // bottom dell'area consumi (stockNorm - outflow)
    const stockLineBase = stockLineData; // base comune per entrambe le aree (stockNorm)

    // POI markers (solo dove c'è movimento)
    const poiInData = points.map(p => p.hasInflow ? p.poiInY : null);
    const poiOutData = points.map(p => p.hasOutflow ? p.poiOutY : null);

    // Se non ci sono movimenti, enfatizza la linea stock
    const stockLineWidth = hasNoMovement ? 3 : 2;
    const stockLineStyle = hasNoMovement ? false : [5, 5]; // dashed se c'è movimento, solid (false) se no movement

    const datasets = [];

    // IMPORTANTE: In Chart.js, fill: '-1' riempie verso il dataset precedente nell'array.
    // L'ordine nell'array è cruciale per far funzionare correttamente il fill.
    
    // STRATEGIA: Usiamo l'area rifornimenti come esempio positivo
    // Rifornimenti (funziona): base_inflow → inflow_area con fill: '-1' verso base (area sopra base)
    // Consumi (speculare ma invertito): outflow_area → base_outflow con fill: '+1' verso base (area sotto base)
    // IMPORTANTE: Per consumi dobbiamo invertire l'ordine perché l'area è SOTTO la base

    // 1. Outflow area (consumi) - DEVE essere PRIMA della base nell'array
    // fill: '+1' riempie verso il dataset successivo (base stock) - verso l'ALTO fino alla base
    // IMPORTANTE: L'area consumi deve essere un'area colorata SOTTO la stock line, come nell'esempio
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: 'Consumi',
            data: outflowAreaBottom, // bottom dell'area (stockNorm - outflow)
            type: 'line',
            borderColor: colors.outflow + '80', // bordo rosso semi-trasparente
            backgroundColor: colors.outflow + '40', // area rossa semi-trasparente (deve essere visibile!)
            fill: '+1', // riempie verso il dataset successivo (base stock) - verso l'ALTO fino alla base
            pointRadius: 0,
            order: 0, // renderizzata sotto la stock line
            tension: 0.4,
            // Assicura che l'area sia sempre visibile
            spanGaps: false,
        });
    }

    // 2. Base invisibile per area consumi (linea stock) - DEVE essere DOPO l'area nell'array
    // Serve come target per fill: '+1' dell'area consumi
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: '_base_outflow', // dataset interno, nascosto
            data: stockLineBase, // linea stock (base per area consumi)
            type: 'line',
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            borderWidth: 0,
            pointRadius: 0,
            fill: false,
            order: 0, // ordine basso, renderizzato per primo
            tension: 0.4,
        });
    }

    // 3. Stock line (sempre visibile, enfatizzata se no movement)
    const stockLineDataset = {
        label: 'Stock',
        data: stockLineData,
        type: 'line',
        borderColor: colors.stock,
        backgroundColor: 'transparent',
        borderWidth: stockLineWidth,
        pointRadius: 0,
        order: 1,
        tension: 0.4,
    };
    
    // borderDash deve essere un array o false/undefined, non una stringa
    if (stockLineStyle !== false) {
        stockLineDataset.borderDash = stockLineStyle;
    }
    
    datasets.push(stockLineDataset);

    // 4. Base invisibile per area rifornimenti (linea stock) - serve come base d'appoggio
    // SPECCHIO di base_outflow: stessa logica ma per area sopra
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: '_base_inflow', // dataset interno, nascosto
            data: stockLineBase, // linea stock (base per area rifornimenti)
            type: 'line',
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            borderWidth: 0,
            pointRadius: 0,
            fill: false,
            order: 1, // stesso ordine della stock line
            tension: 0.4,
        });
    }

    // 5. Inflow area (rifornimenti) - SPECCHIO di consumi
    // Parte dalla base stock e va verso l'alto (rialzo)
    // fill: '-1' riempie verso il dataset precedente (base stock)
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: 'Rifornimenti',
            data: inflowAreaTop, // top dell'area (stockNorm + inflow)
            type: 'line',
            borderColor: colors.inflow + '80', // bordo verde semi-trasparente
            backgroundColor: colors.inflow + '40', // area verde semi-trasparente
            fill: '-1', // riempi verso il dataset precedente nell'array (base stock)
            pointRadius: 0,
            order: 2, // renderizzata sopra la stock line
            tension: 0.4,
            spanGaps: false,
        });
    }

    // 4.5. Linea "Stock di Oggi" (linea guida orizzontale azzurrina alla quota dello stock di oggi)
    // Questa linea parte dall'asse Y e raggiunge la quantità di oggi (ultimo punto disponibile)
    // È solo una guida visiva, non interattiva
    datasets.push({
        label: '_today_stock', // dataset interno, nascosto (non appare in tooltip grazie al filter)
        data: todayStockLineData, // quota normalizzata dello stock di oggi
        type: 'line',
        borderColor: '#87CEEB', // azzurro chiaro (sky blue)
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0, // nessun hover point
        fill: false,
        order: -1, // renderizzata per prima visivamente, sotto tutto (anche sotto area consumi)
        tension: 0, // linea retta orizzontale
        // borderDash non impostato = linea continua (Chart.js si aspetta array o undefined, non false)
    });

    // 5. POI markers (solo se non no movement o se esplicitamente richiesti)
    if (!hasNoMovement && options.showPOI !== false) {
        if (poiInData.some(v => v !== null)) {
            datasets.push({
                label: '_poi_inflow',
                data: poiInData,
                type: 'scatter',
                borderColor: colors.poi,
                backgroundColor: colors.poi,
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: false,
                order: 4,
            });
        }

        if (poiOutData.some(v => v !== null)) {
            datasets.push({
                label: '_poi_outflow',
                data: poiOutData,
                type: 'scatter',
                borderColor: colors.poi,
                backgroundColor: colors.poi,
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: false,
                order: 4,
            });
        }
    }

    // Verifica che ci siano dataset validi
    if (datasets.length === 0) {
        console.error('[AnchoredFlowStockChart] Nessun dataset da renderizzare');
        return null;
    }
    
    // Verifica che i dataset abbiano dati
    const datasetsWithData = datasets.filter(ds => {
        const hasData = Array.isArray(ds.data) && ds.data.length > 0;
        if (!hasData) {
            console.warn('[AnchoredFlowStockChart] Dataset senza dati:', ds.label);
        }
        return hasData;
    });
    
    if (datasetsWithData.length === 0) {
        console.error('[AnchoredFlowStockChart] Nessun dataset con dati validi');
        return null;
    }
    
    console.log('[AnchoredFlowStockChart] Datasets validi:', {
        total: datasets.length,
        withData: datasetsWithData.length,
        labels: datasets.map(ds => ds.label)
    });

    // Configurazione Chart.js
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Assicura che il grafico si ridimensioni correttamente
            resizeDelay: 0,
            animation: {
                duration: 0, // Disabilita animazione iniziale per debug
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: !hasNoMovement,
                    position: 'top',
                    labels: {
                        filter: (item) => !item.text.startsWith('_'), // nascondi dataset interni
                        usePointStyle: true,
                        padding: 15,
                    },
                },
                tooltip: {
                    enabled: true,
                    filter: function(tooltipItem) {
                        // Nascondi dataset interni (baseline, POI, ecc.) dal tooltip
                        const label = tooltipItem.dataset.label || '';
                        return !label.startsWith('_');
                    },
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            if (datasetLabel.startsWith('_')) return null; // nascondi dataset interni (doppio controllo)

                            const index = context.dataIndex;
                            const tooltip = tooltipForIndex(index);
                            if (!tooltip) return null;

                            // IMPORTANTE: tooltip.stock è già stock reale (non normalizzato)
                            // tooltipForIndex restituisce: stock = stockNorm + mediaStock
                            if (datasetLabel === 'Stock') {
                                return `Stock: ${Math.round(tooltip.stock)} bottiglie (Media: ${Math.round(tooltip.mediaStock)}, Oggi: ${Math.round(tooltip.anchorStock)})`;
                            } else if (datasetLabel === 'Rifornimenti') {
                                return `Rifornimenti: ${tooltip.inflow} bottiglie`;
                            } else if (datasetLabel === 'Consumi') {
                                return `Consumi: ${tooltip.outflow} bottiglie`;
                            }
                            return null;
                        },
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const tooltip = tooltipForIndex(index);
                            if (!tooltip) return '';
                            return tooltip.at.toLocaleString('it-IT', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: chartData.granularity === 'hour' ? '2-digit' : undefined,
                                minute: chartData.granularity === 'hour' ? '2-digit' : undefined,
                            });
                        },
                    },
                },
                title: {
                    display: hasNoMovement,
                    text: hasNoMovement 
                        ? `Nessun movimento negli ultimi ${getPeriodLabel(chartData.preset || 'week')}. Stock attuale: ${Math.round(anchorStock)} bottiglie.`
                        : '',
                    font: {
                        size: 14,
                        color: '#666',
                    },
                    padding: {
                        top: 10,
                        bottom: 10,
                    },
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tempo',
                        font: {
                            size: 12,
                            weight: 'bold',
                        },
                    },
                    grid: {
                        display: true,
                        color: '#e0e0e0',
                    },
                },
                y: {
                    min: yDomain[0],
                    max: yDomain[1],
                    title: {
                        display: true,
                        text: 'Stock (bottiglie)',
                        font: {
                            size: 12,
                            weight: 'bold',
                        },
                    },
                    ticks: {
                        callback: function(value) {
                            // IMPORTANTE: value è normalizzato rispetto alla MEDIA (può essere negativo)
                            // Converti SEMPRE in stock reale: realStock = value + mediaStock
                            const realStock = Math.round(value + mediaStock);
                            
                            // Non mostrare mai valori negativi (non ha senso per stock)
                            if (realStock < 0) {
                                return '';
                            }
                            
                            // Se è la linea dello stock di oggi, mostra etichetta speciale
                            const todayStockNorm = anchorStock - mediaStock;
                            if (Math.abs(value - todayStockNorm) < 0.01) {
                                return `Oggi: ${Math.round(anchorStock)}`;
                            }
                            
                            // Per tutti gli altri tick, mostra solo il numero
                            return realStock.toString();
                        },
                        precision: 0,
                        stepSize: undefined,
                    },
                    grid: {
                        color: function(context) {
                            // Linea stock di oggi (azzurrina) più visibile
                            const todayStockNorm = anchorStock - mediaStock;
                            if (Math.abs(context.tick.value - todayStockNorm) < 0.01) {
                                return '#87CEEB'; // azzurro chiaro
                            }
                            return '#e0e0e0';
                        },
                        lineWidth: function(context) {
                            // Linea stock di oggi più spessa
                            const todayStockNorm = anchorStock - mediaStock;
                            if (Math.abs(context.tick.value - todayStockNorm) < 0.01) {
                                return 2;
                            }
                            return 1;
                        },
                    },
                },
            },
        },
    };

    // Crea grafico
    console.log('[AnchoredFlowStockChart] Creando istanza Chart.js');
    console.log('[AnchoredFlowStockChart] Canvas prima di Chart.js:', {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight
    });
    
    try {
        const chart = new Chart(canvas, chartConfig);
        console.log('[AnchoredFlowStockChart] Chart.js istanza creata:', !!chart);
        
        // Verifica che il grafico sia stato disegnato
        setTimeout(() => {
            console.log('[AnchoredFlowStockChart] Canvas dopo Chart.js:', {
                width: canvas.width,
                height: canvas.height,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight
            });
            console.log('[AnchoredFlowStockChart] Chart data:', {
                dataLength: chart.data.labels.length,
                datasetsCount: chart.data.datasets.length,
                datasets: chart.data.datasets.map(ds => ({
                    label: ds.label,
                    dataLength: ds.data?.length || 0,
                    hasData: Array.isArray(ds.data) && ds.data.length > 0
                }))
            });
            
            // Verifica se il canvas ha pixel disegnati (controllo approssimativo)
            try {
                const ctx = canvas.getContext('2d');
                if (ctx && canvas.width > 0 && canvas.height > 0) {
                    const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
                    const hasPixels = imageData.data.some((pixel, i) => i % 4 !== 3 && pixel !== 0); // Controlla se ci sono pixel non trasparenti
                    console.log('[AnchoredFlowStockChart] Canvas ha pixel disegnati:', hasPixels);
                    if (!hasPixels && chart && typeof chart.resize === 'function') {
                        console.warn('[AnchoredFlowStockChart] ATTENZIONE: Canvas sembra vuoto, forzo resize');
                        try {
                            chart.resize();
                        } catch (resizeError) {
                            console.warn('[AnchoredFlowStockChart] Errore durante resize:', resizeError);
                        }
                    }
                }
            } catch (e) {
                console.warn('[AnchoredFlowStockChart] Impossibile verificare pixel canvas:', e);
            }
        }, 200);
        
        return chart;
    } catch (error) {
        console.error('[AnchoredFlowStockChart] Errore creazione Chart.js:', error);
        console.error('[AnchoredFlowStockChart] Stack:', error.stack);
        throw error;
    }
}

/**
 * Helper per label periodo
 */
function getPeriodLabel(preset) {
    const labels = {
        day: '24 ore',
        week: '7 giorni',
        month: '30 giorni',
        quarter: '90 giorni',
        year: '365 giorni',
    };
    return labels[preset] || 'periodo';
}

/**
 * Crea e mostra il grafico in un container
 * @param {HTMLElement} container - container HTML
 * @param {Object} movementsData - dati movimenti da API
 * @param {Object} options - opzioni
 * @returns {Chart} istanza Chart.js
 */
function createAnchoredFlowStockChart(container, movementsData, options = {}) {
    console.log('[AnchoredFlowStockChart] create chiamata', { container, movementsData, options });
    const buildAnchoredFlowStockChart = window.AnchoredFlowStockChartBuilder?.build;
    if (!buildAnchoredFlowStockChart) {
        console.error('[AnchoredFlowStockChart] Builder non disponibile');
        console.error('[AnchoredFlowStockChart] window.AnchoredFlowStockChartBuilder:', window.AnchoredFlowStockChartBuilder);
        return null;
    }
    console.log('[AnchoredFlowStockChart] Builder disponibile, procedo');
    
    // Verifica dimensioni container
    const containerRect = container.getBoundingClientRect();
    const containerStyle = window.getComputedStyle(container);
    console.log('[AnchoredFlowStockChart] Container dimensions:', { 
        rect: { width: containerRect.width, height: containerRect.height },
        computed: {
            width: containerStyle.width,
            height: containerStyle.height
        },
        display: containerStyle.display,
        visibility: containerStyle.visibility
    });
    
    // Pulisci container
    container.innerHTML = '<canvas></canvas>';
    const canvas = container.querySelector('canvas');

    if (!canvas) {
        console.error('[AnchoredFlowStockChart] Canvas non trovato');
        return null;
    }
    
    // FORZA dimensioni esplicite sul canvas
    // Chart.js con maintainAspectRatio: false richiede dimensioni esplicite
    let containerHeight = parseFloat(containerStyle.height) || containerRect.height;
    let containerWidth = parseFloat(containerStyle.width) || containerRect.width;
    
    // Se non ha dimensioni, usa valori di default
    if (!containerHeight || containerHeight <= 0) {
        containerHeight = 400;
        container.style.height = containerHeight + 'px';
        console.warn('[AnchoredFlowStockChart] Container senza altezza, imposto 400px');
    }
    if (!containerWidth || containerWidth <= 0) {
        containerWidth = container.parentElement?.clientWidth || 800;
        console.warn('[AnchoredFlowStockChart] Container senza larghezza, uso:', containerWidth);
    }
    
    // Imposta dimensioni esplicite sul canvas (sia style che attributi)
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    canvas.style.display = 'block'; // Importante per Chart.js
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    console.log('[AnchoredFlowStockChart] Canvas dimensions forzate:', { 
        width: canvas.width, 
        height: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        containerWidth,
        containerHeight
    });

    // Converti movimenti API in formato WineMovement
    const rawMovements = movementsData.movements || [];
    console.log('[AnchoredFlowStockChart] Movimenti raw dall\'API:', rawMovements.length);
    
    // Log primi movimenti per debug
    if (rawMovements.length > 0) {
        console.log('[AnchoredFlowStockChart] Primi movimenti raw:', rawMovements.slice(0, 3).map(m => ({
            date: m.date || m.at,
            type: m.type,
            quantity_change: m.quantity_change,
            quantity_after: m.quantity_after
        })));
    }
    
    const movements = rawMovements.map(mov => {
        // Debug: log struttura movimento per i primi 3
        if (rawMovements.indexOf(mov) < 3) {
            console.log('[AnchoredFlowStockChart] Movimento raw:', {
                type: mov.type,
                quantity_change: mov.quantity_change,
                quantity: mov.quantity,
                delta: mov.delta,
                date: mov.date || mov.at,
                keys: Object.keys(mov)
            });
        }
        
        // Riconosci consumo: tipo deve essere esattamente 'consumo' (case-sensitive come nel legacy)
        const isConsumo = mov.type === 'consumo';
        const quantityChange = mov.quantity_change || mov.quantity || mov.delta || 0;
        
        // Se è consumo, delta deve essere negativo (come nel legacy: -Math.abs(quantity_change))
        // Se non è consumo, delta è positivo (rifornimento)
        const delta = isConsumo ? -Math.abs(quantityChange) : Math.abs(quantityChange);
        
        return {
            at: mov.date || mov.at,
            delta: delta,
        };
    });
    
    console.log('[AnchoredFlowStockChart] Movimenti convertiti:', movements.length);
    
    // Debug: verifica consumi
    const consumiMovements = movements.filter(m => m.delta < 0);
    const rifornimentiMovements = movements.filter(m => m.delta > 0);
    console.log('[AnchoredFlowStockChart] Debug movimenti:', {
        total: movements.length,
        consumi: consumiMovements.length,
        rifornimenti: rifornimentiMovements.length,
        totalConsumi: consumiMovements.reduce((sum, m) => sum + Math.abs(m.delta), 0),
        totalRifornimenti: rifornimentiMovements.reduce((sum, m) => sum + m.delta, 0),
        sampleConsumi: consumiMovements.slice(0, 3),
        sampleRifornimenti: rifornimentiMovements.slice(0, 3),
        rawSample: rawMovements.slice(0, 3).map(m => ({
            type: m.type,
            quantity_change: m.quantity_change,
            quantity: m.quantity,
            delta: m.delta
        }))
    });
    
    // Log range date movimenti
    if (movements.length > 0) {
        const dates = movements.map(m => new Date(m.at)).sort((a, b) => a.getTime() - b.getTime());
        console.log('[AnchoredFlowStockChart] Range date movimenti:', {
            first: dates[0].toISOString(),
            last: dates[dates.length - 1].toISOString(),
            count: dates.length
        });
    }

    // Calcola opening stock
    // Strategia: usa quantity_after dell'ultimo movimento come stock finale (più affidabile)
    // Poi calcola openingStock = stockFinale - totalDelta
    const totalDelta = movements.reduce((sum, m) => sum + m.delta, 0);
    
    // Cerca stock finale dall'ultimo movimento (quantity_after è più affidabile)
    const lastMovement = rawMovements.length > 0 ? rawMovements[rawMovements.length - 1] : null;
    const stockFinale = lastMovement?.quantity_after 
        || movementsData.current_stock 
        || movementsData.opening_stock 
        || 0;
    
    console.log('[AnchoredFlowStockChart] Stock finale calcolato:', {
        fromLastMovement: lastMovement?.quantity_after,
        fromAPI: movementsData.current_stock || movementsData.opening_stock,
        stockFinale,
        totalDelta,
        lastMovementType: lastMovement?.type
    });
    
    // Se abbiamo stock finale, l'opening stock è quello all'inizio del periodo
    // openingStock = stockFinale - totalDelta
    let openingStock = stockFinale - totalDelta;
    
    // Se openingStock è negativo o zero, potrebbe essere un errore nei dati
    // In questo caso, usa lo stock più basso tra i movimenti o un valore di default
    if (openingStock < 0 && movements.length > 0) {
        console.warn('[AnchoredFlowStockChart] Opening stock negativo, correggo:', openingStock);
        
        // Cerca quantity_after nei movimenti raw dall'API
        const stocksFromMovements = rawMovements
            .map(mov => {
                const qty = mov.quantity_after || mov.quantity || null;
                return qty !== null && Number.isFinite(qty) && qty > 0 ? qty : null;
            })
            .filter(s => s !== null);
        
        if (stocksFromMovements.length > 0) {
            const minStock = Math.min(...stocksFromMovements);
            if (Number.isFinite(minStock) && minStock > 0) {
                openingStock = minStock;
                console.warn('[AnchoredFlowStockChart] Opening stock corretto da movimenti:', openingStock);
            } else {
                openingStock = Math.max(1, currentStock || 1);
                console.warn('[AnchoredFlowStockChart] Min stock invalido, uso default:', openingStock);
            }
        } else {
            // Se non abbiamo stock dai movimenti, usa stockFinale o un valore di default
            openingStock = Math.max(1, stockFinale || 1);
            console.warn('[AnchoredFlowStockChart] Nessun stock dai movimenti, uso default:', openingStock);
        }
    }
    
    // Assicura che openingStock sia sempre un numero finito valido
    if (!Number.isFinite(openingStock) || openingStock < 0 || isNaN(openingStock)) {
        console.error('[AnchoredFlowStockChart] Opening stock invalido, uso default:', openingStock);
        openingStock = Math.max(1, stockFinale || 1);
    }
    
    console.log('[AnchoredFlowStockChart] Opening stock calcolato:', {
        stockFinale,
        totalDelta,
        openingStock,
        movementsCount: movements.length,
        expectedFinalStock: openingStock + totalDelta,
        verification: `Se openingStock (${openingStock}) + totalDelta (${totalDelta}) = ${openingStock + totalDelta}, dovrebbe essere = stockFinale (${stockFinale})`
    });
    
    // Verifica che openingStock + totalDelta = stockFinale
    const calculatedFinalFromOpening = openingStock + totalDelta;
    if (Math.abs(calculatedFinalFromOpening - stockFinale) > 0.1) {
        console.warn('[AnchoredFlowStockChart] DISALLINEAMENTO: openingStock + totalDelta != stockFinale', {
            openingStock,
            totalDelta,
            calculatedFinal: calculatedFinalFromOpening,
            expectedFinal: stockFinale,
            difference: calculatedFinalFromOpening - stockFinale
        });
        // Se c'è disallineamento, ricalcola openingStock per garantire coerenza
        const correctedOpeningStock = stockFinale - totalDelta;
        console.warn('[AnchoredFlowStockChart] Correggo openingStock:', {
            old: openingStock,
            new: correctedOpeningStock,
            verification: correctedOpeningStock + totalDelta
        });
        openingStock = correctedOpeningStock;
    }

    // Build chart data
    console.log('[AnchoredFlowStockChart] Building chart data con movements:', movements.length);
    const chartData = buildAnchoredFlowStockChart(movements, {
        now: options.now || new Date(),
        preset: options.preset || 'week',
        granularity: options.granularity,
        openingStock: Math.max(0, openingStock), // Assicura non negativo
        finalStock: stockFinale, // Passa stock finale esplicito (da quantity_after ultimo movimento)
        paddingMultiplier: options.paddingMultiplier,
        minAbsDomain: options.minAbsDomain,
    });
    
    // Verifica che lo stock finale sia corretto
    const calculatedFinalStock = chartData.anchorStock;
    if (stockFinale > 0 && Math.abs(calculatedFinalStock - stockFinale) > 0.1) {
        console.warn('[AnchoredFlowStockChart] Stock finale non corrisponde!', {
            expected: stockFinale,
            calculated: calculatedFinalStock,
            difference: calculatedFinalStock - stockFinale
        });
        // Forza lo stock finale corretto
        chartData.anchorStock = stockFinale;
    }
    console.log('[AnchoredFlowStockChart] Chart data built:', {
        pointsCount: chartData.points.length,
        mediaStock: chartData.mediaStock, // Media stock (baseline dinamica)
        anchorStock: chartData.anchorStock, // Stock di oggi (per riferimento)
        yDomain: chartData.yDomain,
        hasNoMovement: chartData.hasNoMovement,
        firstPoint: chartData.points[0],
        lastPoint: chartData.points[chartData.points.length - 1]
    });
    
    // Verifica che i dati siano validi
    if (chartData.points.length === 0) {
        console.error('[AnchoredFlowStockChart] Nessun punto nel grafico');
        container.innerHTML = '<div class="error-state">Nessun dato disponibile per il periodo selezionato</div>';
        return null;
    }
    
    // Verifica che il dominio Y sia valido
    if (!Number.isFinite(chartData.yDomain[0]) || !Number.isFinite(chartData.yDomain[1])) {
        console.error('[AnchoredFlowStockChart] Dominio Y invalido:', chartData.yDomain);
        container.innerHTML = '<div class="error-state">Errore nel calcolo del dominio del grafico</div>';
        return null;
    }

    // Render
    console.log('[AnchoredFlowStockChart] Rendering chart');
    try {
        const chart = renderAnchoredFlowStockChart(canvas, chartData, options);
        console.log('[AnchoredFlowStockChart] Chart renderizzato:', !!chart);
        
        // Forza resize dopo un breve delay per assicurare che Chart.js disegni
        setTimeout(() => {
            if (chart && typeof chart.resize === 'function') {
                console.log('[AnchoredFlowStockChart] Forzo resize chart');
                chart.resize();
            }
        }, 100);
        
        return chart;
    } catch (error) {
        console.error('[AnchoredFlowStockChart] Errore durante rendering:', error);
        throw error;
    }
}

// Export per uso globale
if (typeof window !== 'undefined') {
    window.AnchoredFlowStockChart = {
        create: createAnchoredFlowStockChart,
        render: renderAnchoredFlowStockChart,
    };
    console.log('[AnchoredFlowStockChart] Modulo esportato su window.AnchoredFlowStockChart');
} else {
    console.error('[AnchoredFlowStockChart] window non disponibile');
}
