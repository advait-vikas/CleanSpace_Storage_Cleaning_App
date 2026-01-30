// src/scanWorker.js
const { parentPort, workerData } = require('worker_threads');
const storageScanner = require('./storageScanner.cjs');

const { dir, options } = workerData;

// Proxy progress callback to parent thread
const progressCallback = (progressData) => {
    parentPort.postMessage({ type: 'progress', data: progressData });
};

// Run scan
try {
    const files = storageScanner.scanDirectory(dir, {
        ...options,
        progressCallback
    });
    parentPort.postMessage({ type: 'complete', data: files });
} catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
}
