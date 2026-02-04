const appScanner = require('./src/appScanner.cjs');

async function test() {
    console.log('Starting app usage verification test...');
    try {
        const apps = await appScanner.getInstalledApplications();
        console.log(`Scanned ${apps.length} applications.`);

        // Check known popular apps
        const popularApps = ['Google Chrome', 'Visual Studio', 'Spotify', 'WhatsApp', 'Brave', 'Netflix'];

        console.log('\nVerifying usage status for popular apps:');
        popularApps.forEach(popularName => {
            const found = apps.find(a => a.name.includes(popularName));
            if (found) {
                console.log(`- ${found.name}: [${found.usage}] (Path: ${found.path || 'No Path'})`);
            }
        });

        console.log('\nChecking for "Never" used apps that might be popular:');
        const neverUsed = apps.filter(a => a.usage === 'never');
        console.log(`Found ${neverUsed.length} apps marked as "never" used.`);

        // Warn if any popular app is in "never" list
        const issues = neverUsed.filter(a =>
            ['chrome', 'firefox', 'edge', 'discord', 'slack', 'teams', 'zoom', 'whatsapp', 'spotify'].some(k => a.name.toLowerCase().includes(k))
        );

        if (issues.length > 0) {
            console.log('WARNING: The following popular apps are still marked as "never":');
            issues.forEach(i => console.log(`- ${i.name}`));
        } else {
            console.log('SUCCESS: No popular apps found in "never" list.');
        }

    } catch (error) {
        console.error('Scan failed:', error);
    }
}

test();
