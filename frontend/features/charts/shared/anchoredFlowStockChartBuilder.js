/**
 * Builder per grafico Flow+Stock ancorato a stock di OGGI
 * 
 * SPEC + IMPLEMENTATION NOTES — Grafico Flow+Stock ancorato a stock di OGGI
 *
 * Obiettivo UI:
 * - Un singolo grafico che combina:
 *   1) Grafico di flusso: rifornimenti sopra, consumi sotto
 *   2) Grafico lineare: linea stock che sale/scende nel tempo
 * - Baseline (linea mediana) = STOCK DI OGGI (non 0).
 * - Asse X temporale CONTINUO (bucket giornalieri/orari, buchi riempiti con 0).
 * - Preset rolling: ultimo giorno / ultima settimana / ultimo mese / ultimo trimestre / ultimo anno
 * - POI: punti d'interesse nei bucket dove inflow>0 e/o outflow>0.
 * - Curve smussate (monotone/basis/catmullRom) per evitare spigoli.
 *
 * Punti chiave (non negoziabili):
 * - Normalizzazione: yNorm = yAbs - anchorStock
 *   => La baseline è a 0 in coordinate, ma i tick mostrano valori reali (tick + anchorStock)
 * - Serie:
 *   stock line: y = stockNorm
 *   inflow area: y0 = stockNorm, y1 = stockNorm + inflow
 *   outflow area: y0 = stockNorm - outflow, y1 = stockNorm
 * - Tooltip deve mostrare valori REALI (stock = stockNorm + anchorStock)
 */

/**
 * @typedef {'day' | 'week' | 'month' | 'quarter' | 'year'} PeriodPreset
 */

/**
 * @typedef {Object} WineMovement
 * @property {Date | string | number} at - istante evento
 * @property {number} delta - + rifornimento, - consumo
 */

/**
 * @typedef {Object} FlowPointAbs
 * @property {Date} t - bucket start
 * @property {number} inflow - >=0
 * @property {number} outflow - >=0
 * @property {number} stock - assoluto (fine bucket)
 */

/**
 * @typedef {Object} FlowPointNorm
 * @property {Date} t
 * @property {number} inflow
 * @property {number} outflow
 * @property {number} stockNorm - stock normalizzato rispetto anchorStock (stock di oggi)
 * @property {number} inflow_y0 - stockNorm
 * @property {number} inflow_y1 - stockNorm + inflow
 * @property {number} outflow_y0 - stockNorm - outflow
 * @property {number} outflow_y1 - stockNorm
 * @property {boolean} hasInflow
 * @property {boolean} hasOutflow
 * @property {number} [poiInY] - inflow_y1 se hasInflow
 * @property {number} [poiOutY] - outflow_y0 se hasOutflow
 */

/**
 * @typedef {Object} BuildOptions
 * @property {Date} [now] - data corrente (default: new Date())
 * @property {PeriodPreset} [preset] - preset periodo (default: 'week')
 * @property {'day' | 'hour'} [granularity] - granularità bucket
 * @property {number} [paddingMultiplier] - moltiplicatore padding dominio Y (default: 1.2)
 * @property {number} [minAbsDomain] - minimo assoluto dominio Y (default: 1)
 * @property {number} openingStock - stock assoluto all'inizio della finestra
 */

/**
 * @typedef {Object} AnchoredChartData
 * @property {{from: Date, to: Date}} range
 * @property {'day' | 'hour'} granularity
 * @property {Date} anchorTime - oggi
 * @property {number} anchorStock - stock di oggi (fine ultimo bucket)
 * @property {FlowPointAbs[]} pointsAbs
 * @property {FlowPointNorm[]} points
 * @property {[number, number]} yDomain - dominio Y in coordinate normalizzate
 * @property {(tickNorm: number) => string} yTickFormatter - formatter per valori stock reali
 * @property {(i: number) => {at: Date, inflow: number, outflow: number, stock: number, anchorStock: number} | null} tooltipForIndex
 * @property {boolean} hasNoMovement - true se non ci sono movimenti (vino fermo)
 */

/* ----------------------- Date helpers ----------------------- */

function toDate(x) {
    return x instanceof Date ? x : new Date(x);
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfHour(d) {
    const x = new Date(d);
    x.setMinutes(0, 0, 0);
    return x;
}

function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function addHours(d, n) {
    const x = new Date(d);
    x.setHours(x.getHours() + n);
    return x;
}

function clampNonNegative(n) {
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function bucketStart(d, granularity) {
    return granularity === 'day' ? startOfDay(d) : startOfHour(d);
}

function nextBucket(d, granularity) {
    return granularity === 'day' ? addDays(d, 1) : addHours(d, 1);
}

function generateBuckets(from, to, granularity) {
    const buckets = [];
    let cur = bucketStart(from, granularity);
    while (cur <= to) {
        buckets.push(cur);
        cur = nextBucket(cur, granularity);
    }
    return buckets;
}

/* ----------------------- Rolling ranges -----------------------
 * Ultimo giorno = ultime 24h
 * Ultima settimana = ultimi 7 giorni
 * Ultimo mese = ultimi 30 giorni
 * Ultimo trimestre = ultimi 90 giorni
 * Ultimo anno = ultimi 365 giorni
 */
function computeRollingRange(now, preset) {
    const to = now;
    switch (preset) {
        case 'day': return { from: addHours(to, -24), to };
        case 'week': return { from: addDays(to, -7), to };
        case 'month': return { from: addDays(to, -30), to };
        case 'quarter': return { from: addDays(to, -90), to };
        case 'year': return { from: addDays(to, -365), to };
        default: return { from: addDays(to, -7), to };
    }
}

/* ----------------------- Domain ----------------------- */

function computeYDomainNorm(pointsAbs, anchorStock, padMul, minAbs) {
    let minAbsY = Number.POSITIVE_INFINITY;
    let maxAbsY = Number.NEGATIVE_INFINITY;

    for (const p of pointsAbs) {
        const low = p.stock - p.outflow;
        const high = p.stock + p.inflow;
        minAbsY = Math.min(minAbsY, low);
        maxAbsY = Math.max(maxAbsY, high);
    }

    if (!Number.isFinite(minAbsY) || !Number.isFinite(maxAbsY)) {
        return [-minAbs, +minAbs];
    }

    const minNorm = minAbsY - anchorStock;
    const maxNorm = maxAbsY - anchorStock;

    const peak = Math.max(Math.abs(minNorm), Math.abs(maxNorm));
    const padded = Math.max(minAbs, peak * padMul);
    return [-padded, +padded];
}

/* ----------------------- Builder ----------------------- */

/**
 * Costruisce i dati per il grafico Flow+Stock ancorato
 * @param {WineMovement[]} movements - array di movimenti
 * @param {BuildOptions} opts - opzioni di build
 * @returns {AnchoredChartData}
 */
function buildAnchoredFlowStockChart(movements, opts) {
    const now = opts.now ?? new Date();
    const preset = opts.preset ?? 'week';

    const granularity =
        opts.granularity ??
        (preset === 'day' ? 'hour' : 'day');

    const { from, to } = computeRollingRange(now, preset);
    const buckets = generateBuckets(from, to, granularity);

    // Filter + sort movements in range
    const mv = movements
        .map(m => ({ at: toDate(m.at), delta: m.delta }))
        .filter(m => m.at >= from && m.at <= to)
        .sort((a, b) => a.at.getTime() - b.at.getTime());

    // Aggregate to buckets
    const agg = new Map();
    for (const m of mv) {
        const k = bucketStart(m.at, granularity).getTime();
        const cur = agg.get(k) ?? { inflow: 0, outflow: 0 };
        if (m.delta >= 0) cur.inflow += m.delta;
        else cur.outflow += Math.abs(m.delta);
        agg.set(k, cur);
    }

    // Build absolute points (cumulative stock)
    const pointsAbs = [];
    let stock = opts.openingStock;

    for (const t of buckets) {
        const k = t.getTime();
        const a = agg.get(k) ?? { inflow: 0, outflow: 0 };
        const inflow = clampNonNegative(a.inflow);
        const outflow = clampNonNegative(a.outflow);

        stock = stock + inflow - outflow;
        pointsAbs.push({ t, inflow, outflow, stock });
    }

    // Anchor baseline = stock of TODAY (last bucket)
    const anchorTime = now;
    const anchorStock = pointsAbs.length ? pointsAbs[pointsAbs.length - 1].stock : opts.openingStock;

    const padMul = opts.paddingMultiplier ?? 1.2;
    const minAbs = opts.minAbsDomain ?? 1;
    const yDomain = computeYDomainNorm(pointsAbs, anchorStock, padMul, minAbs);

    // Normalize & build POIs
    const points = pointsAbs.map(p => {
        const stockNorm = p.stock - anchorStock;
        const hasInflow = p.inflow > 0;
        const hasOutflow = p.outflow > 0;

        const inflow_y0 = stockNorm;
        const inflow_y1 = stockNorm + p.inflow;
        const outflow_y0 = stockNorm - p.outflow;
        const outflow_y1 = stockNorm;

        return {
            t: p.t,
            inflow: p.inflow,
            outflow: p.outflow,
            stockNorm,
            inflow_y0,
            inflow_y1,
            outflow_y0,
            outflow_y1,
            hasInflow,
            hasOutflow,
            poiInY: hasInflow ? inflow_y1 : undefined,
            poiOutY: hasOutflow ? outflow_y0 : undefined,
        };
    });

    // Check if there's no movement (all inflow/outflow are 0)
    const hasNoMovement = points.every(p => p.inflow === 0 && p.outflow === 0);

    // Y tick formatter (shows real stock)
    const yTickFormatter = (tickNorm) => `${Math.round(tickNorm + anchorStock)}`;

    const tooltipForIndex = (i) => {
        const p = points[i];
        if (!p) return null;
        return {
            at: p.t,
            inflow: p.inflow,
            outflow: p.outflow,
            stock: p.stockNorm + anchorStock,
            anchorStock,
        };
    };

    return {
        range: { from, to },
        granularity,
        anchorTime,
        anchorStock,
        pointsAbs,
        points,
        yDomain,
        yTickFormatter,
        tooltipForIndex,
        hasNoMovement,
    };
}

// Export su window per uso globale
if (typeof window !== 'undefined') {
    window.AnchoredFlowStockChartBuilder = {
        build: buildAnchoredFlowStockChart,
        toDate,
        startOfDay,
        startOfHour,
        addDays,
        addHours,
        computeRollingRange,
        generateBuckets,
    };
    console.log('[AnchoredFlowStockChartBuilder] Modulo esportato su window.AnchoredFlowStockChartBuilder');
} else {
    console.error('[AnchoredFlowStockChartBuilder] window non disponibile');
}
