/**
 * CSS Guardrail - Validazione automatica per prevenire regressioni
 * 
 * Verifica che non ci siano regole CSS pericolose che possono causare
 * regressioni incrociate tra mobile e desktop.
 * 
 * Uso: node scripts/css-guardrail.js
 */

const fs = require('fs');
const path = require('path');

const DANGEROUS_PATTERNS = [
    // Regole globali su html/body/#root
    {
        pattern: /^\s*(html|body|#root)\s*\{[^}]*overflow/gi,
        message: 'Trovato overflow su html/body/#root - deve essere layout-specific',
        file: 'styles.css'
    },
    {
        pattern: /^\s*(html|body|#root)\s*\{[^}]*height:\s*100/gi,
        message: 'Trovato height: 100vh/100% su html/body/#root - deve essere layout-specific',
        file: 'styles.css'
    },
    {
        pattern: /^\s*(html|body|#root)\s*\{[^}]*min-height:\s*100/gi,
        message: 'Trovato min-height: 100vh su html/body/#root - deve essere layout-specific',
        file: 'styles.css'
    },
    // Position fixed non layout-specific
    {
        pattern: /^\s*[^.]*\{[^}]*position:\s*fixed/gi,
        exclude: /\.(mobileRoot|desktopRoot|mApp|desktop-layout)/,
        message: 'Trovato position: fixed senza namespace - deve essere layout-specific',
        file: 'styles.css'
    },
    // Media query che cambia struttura
    {
        pattern: /@media[^\{]*\{[^}]*display:\s*(none|block|flex|grid)/gi,
        message: 'Media query che cambia display - considerare split layout',
        file: 'styles.css'
    }
];

const LAYOUT_BOUNDARY_PATTERNS = [
    // Verifica che layoutBoundary.css non abbia layout
    {
        pattern: /\.(mobileRoot|desktopRoot)\s*\{[^}]*overflow/gi,
        message: 'LayoutBoundary non deve avere overflow - solo namespace',
        file: 'layout/LayoutBoundary/layoutBoundary.css'
    },
    {
        pattern: /\.(mobileRoot|desktopRoot)\s*\{[^}]*height/gi,
        message: 'LayoutBoundary non deve avere height - solo namespace',
        file: 'layout/LayoutBoundary/layoutBoundary.css'
    }
];

function checkFile(filePath, patterns) {
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  File non trovato: ${filePath}`);
        return [];
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const errors = [];
    
    patterns.forEach(({ pattern, exclude, message, file }) => {
        lines.forEach((line, index) => {
            if (pattern.test(line)) {
                // Se c'è un exclude pattern, verifica che non matchi
                if (exclude && exclude.test(line)) {
                    return; // Skip se matcha exclude
                }
                
                errors.push({
                    file: file || filePath,
                    line: index + 1,
                    content: line.trim(),
                    message
                });
            }
        });
    });
    
    return errors;
}

function main() {
    console.log('🔍 CSS Guardrail - Validazione regole pericolose\n');
    
    const allErrors = [];
    
    // Check styles.css
    console.log('📄 Verifica styles.css...');
    const stylesErrors = checkFile('styles.css', DANGEROUS_PATTERNS);
    allErrors.push(...stylesErrors);
    
    // Check layoutBoundary.css
    console.log('📄 Verifica layoutBoundary.css...');
    const boundaryErrors = checkFile('layout/LayoutBoundary/layoutBoundary.css', LAYOUT_BOUNDARY_PATTERNS);
    allErrors.push(...boundaryErrors);
    
    // Report
    if (allErrors.length === 0) {
        console.log('✅ Nessun problema rilevato!\n');
        process.exit(0);
    } else {
        console.log(`\n❌ Trovati ${allErrors.length} problemi:\n`);
        allErrors.forEach(({ file, line, content, message }) => {
            console.log(`  📍 ${file}:${line}`);
            console.log(`     ${message}`);
            console.log(`     "${content}"\n`);
        });
        console.log('💡 Correggere questi problemi prima di procedere.\n');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkFile, DANGEROUS_PATTERNS, LAYOUT_BOUNDARY_PATTERNS };

