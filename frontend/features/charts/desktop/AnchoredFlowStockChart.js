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
        anchorStock,
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

    // Dataset per stock line (baseline = 0 normalizzato)
    const stockLineData = points.map(p => p.stockNorm);

    // Dataset per aree: 
    // - Inflow: da stockNorm (y0) a stockNorm + inflow (y1) - sopra baseline
    // - Outflow: da stockNorm - outflow (y0) a stockNorm (y1) - sotto baseline
    // Per Chart.js, usiamo fill verso lo zero (baseline normalizzata = 0)
    const inflowAreaData = points.map(p => p.inflow_y1); // top dell'area inflow
    const outflowAreaData = points.map(p => p.outflow_y0); // bottom dell'area outflow

    // POI markers (solo dove c'è movimento)
    const poiInData = points.map(p => p.hasInflow ? p.poiInY : null);
    const poiOutData = points.map(p => p.hasOutflow ? p.poiOutY : null);

    // Se non ci sono movimenti, enfatizza la linea stock
    const stockLineWidth = hasNoMovement ? 3 : 2;
    const stockLineStyle = hasNoMovement ? false : [5, 5]; // dashed se c'è movimento, solid (false) se no movement

    const datasets = [];

    // 1. Outflow area (sotto baseline, valori negativi) - renderizzata per prima
    // Riempiamo verso lo zero (baseline normalizzata = 0)
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: 'Consumi',
            data: outflowAreaData, // valori negativi (sotto baseline)
            type: 'line',
            borderColor: colors.outflow + '80',
            backgroundColor: colors.outflow + '40',
            fill: 'origin', // riempi verso y=0 (baseline normalizzata)
            pointRadius: 0,
            order: 3,
            tension: 0.4,
        });
    }

    // 2. Inflow area (sopra baseline, valori positivi)
    if (!hasNoMovement || options.showAreasWhenNoMovement) {
        datasets.push({
            label: 'Rifornimenti',
            data: inflowAreaData, // valori positivi (sopra baseline)
            type: 'line',
            borderColor: colors.inflow + '80',
            backgroundColor: colors.inflow + '40',
            fill: 'origin', // riempi verso y=0 (baseline normalizzata)
            pointRadius: 0,
            order: 2,
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

    // 4. POI markers (solo se non no movement o se esplicitamente richiesti)
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
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            if (datasetLabel.startsWith('_')) return null; // nascondi dataset interni

                            const index = context.dataIndex;
                            const tooltip = tooltipForIndex(index);
                            if (!tooltip) return null;

                            // IMPORTANTE: tooltip.stock è già stock reale (non normalizzato)
                            // tooltipForIndex restituisce: stock = stockNorm + anchorStock
                            if (datasetLabel === 'Stock') {
                                return `Stock: ${Math.round(tooltip.stock)} bottiglie (Oggi: ${tooltip.anchorStock})`;
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
                            // IMPORTANTE: value è normalizzato (può essere negativo)
                            // Converti SEMPRE in stock reale: realStock = value + anchorStock
                            const realStock = Math.round(value + anchorStock);
                            
                            // Non mostrare mai valori negativi (non ha senso per stock)
                            if (realStock < 0) {
                                return '';
                            }
                            
                            // Se è la baseline (value ≈ 0), mostra etichetta speciale
                            if (Math.abs(value) < 0.01) {
                                return `Oggi: ${realStock}`;
                            }
                            
                            // Per tutti gli altri tick, mostra solo il numero
                            return realStock.toString();
                        },
                        precision: 0,
                        stepSize: undefined,
                    },
                    grid: {
                        color: function(context) {
                            // Baseline (stock oggi) più visibile
                            if (Math.abs(context.tick.value) < 0.01) {
                                return colors.baseline;
                            }
                            return '#e0e0e0';
                        },
                        lineWidth: function(context) {
                            // Baseline più spessa
                            if (Math.abs(context.tick.value) < 0.01) {
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
    
    const movements = rawMovements.map(mov => ({
        at: mov.date || mov.at,
        delta: mov.type === 'consumo' 
            ? -(mov.quantity_change || 0)
            : (mov.quantity_change || 0),
    }));
    
    console.log('[AnchoredFlowStockChart] Movimenti convertiti:', movements.length);
    
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
    // Se abbiamo current_stock dall'API, usalo come stock finale
    // Altrimenti calcoliamo: openingStock = currentStock - totalDelta
    const totalDelta = movements.reduce((sum, m) => sum + m.delta, 0);
    const currentStock = movementsData.current_stock || movementsData.opening_stock || 0;
    
    // Se abbiamo current_stock, l'opening stock è quello all'inizio del periodo
    // openingStock = currentStock - totalDelta (se totalDelta è positivo, significa che abbiamo aggiunto stock)
    let openingStock = currentStock - totalDelta;
    
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
            // Se non abbiamo stock dai movimenti, usa currentStock o un valore di default
            openingStock = Math.max(1, currentStock || 1);
            console.warn('[AnchoredFlowStockChart] Nessun stock dai movimenti, uso default:', openingStock);
        }
    }
    
    // Assicura che openingStock sia sempre un numero finito valido
    if (!Number.isFinite(openingStock) || openingStock < 0 || isNaN(openingStock)) {
        console.error('[AnchoredFlowStockChart] Opening stock invalido, uso default:', openingStock);
        openingStock = Math.max(1, currentStock || 1);
    }
    
    console.log('[AnchoredFlowStockChart] Opening stock calcolato:', {
        currentStock,
        totalDelta,
        openingStock,
        movementsCount: movements.length
    });

    // Build chart data
    console.log('[AnchoredFlowStockChart] Building chart data con movements:', movements.length);
    const chartData = buildAnchoredFlowStockChart(movements, {
        now: options.now || new Date(),
        preset: options.preset || 'week',
        granularity: options.granularity,
        openingStock: Math.max(0, openingStock), // Assicura non negativo
        paddingMultiplier: options.paddingMultiplier,
        minAbsDomain: options.minAbsDomain,
    });
    console.log('[AnchoredFlowStockChart] Chart data built:', {
        pointsCount: chartData.points.length,
        anchorStock: chartData.anchorStock,
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
