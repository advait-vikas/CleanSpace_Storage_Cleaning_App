// src/scanWorker.cjs
const { parentPort, workerData } = require('worker_threads');
const storageScanner = require('./storageScanner.cjs');
const recommendationEngine = require('./recommendationEngine.cjs');

const { dir, options } = workerData;
const { applications = [] } = options;

// Proxy progress callback to parent thread
const progressCallback = (progressData) => {
    parentPort.postMessage({ type: 'progress', data: progressData });
};

// Run scan
try {
    const scanResult = storageScanner.scanDirectory(dir, {
        ...options,
        progressCallback
    });

    const { largeFiles, oldFiles, duplicateFiles } = scanResult;

    // Generate cleanup recommendations using recommendation engine
    const recommendations = recommendationEngine.generateRecommendations(scanResult, applications);

    // Diagnostics logs visible in the dev terminal
    console.log(`\n--- Scan Completed ---`);
    console.log(`Total files scanned: ${scanResult.fileCount}`);
    console.log(`Large files identified: ${largeFiles.length}`);
    console.log(`Old files identified: ${oldFiles.length}`);
    console.log(`Duplicate files identified: ${duplicateFiles.length}`);
    console.log(`Recommendations count: ${recommendations.length}`);
    console.log(`-----------------------\n`);

    // Send the pre-processed lists back to main thread
    parentPort.postMessage({
        type: 'complete',
        data: {
            largeFiles,
            oldFiles,
            duplicateFiles,
            recommendations
        }
    });
} catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
}

