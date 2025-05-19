const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');

const STATS_FILE = path.join(__dirname, 'survival_stats.json');
const GRAPH_FILE = path.join(__dirname, 'survival_graph.svg');

const DEFAULT_STATS = JSON.stringify({ message: "No stats yet" });
const DEFAULT_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">\n    <rect width="100%" height="100%" fill="#f8f9fa"/>\n    <text x="400" y="200" text-anchor="middle" font-family="Arial" font-size="24" fill="#6c757d">No stats yet</text>\n</svg>`;

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files
app.use(express.static('.'));

// Store connected clients
const clients = new Set();

// Function to send updates to all connected clients
function sendUpdate(data) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

function dynamicWatchFile(filename, onChange, onMissing) {
    let watcher = null;
    let exists = fs.existsSync(filename);
    let interval = null;

    function startWatch() {
        if (watcher) return;
        watcher = fs.watch(filename, (eventType) => {
            if (eventType === 'change') {
                onChange();
            }
        });
    }

    function stopWatch() {
        if (watcher) {
            watcher.close();
            watcher = null;
        }
    }

    function checkFile() {
        const fileExists = fs.existsSync(filename);
        if (fileExists && !exists) {
            // File appeared
            exists = true;
            startWatch();
            onChange();
        } else if (!fileExists && exists) {
            // File disappeared
            exists = false;
            stopWatch();
            if (onMissing) onMissing();
        }
    }

    // Initial state
    if (exists) {
        startWatch();
        onChange();
    } else if (onMissing) {
        onMissing();
    }
    // Poll every 5 seconds
    interval = setInterval(checkFile, 50000);
    return () => {
        stopWatch();
        clearInterval(interval);
    };
}

function watchFiles() {
    // Watch survival_stats.json dynamically
    dynamicWatchFile('survival_stats.json', () => {
        try {
            const stats = JSON.parse(fs.readFileSync('survival_stats.json', 'utf8'));
            sendUpdate({ type: 'stats', data: stats });
        } catch (err) {
            sendUpdate({ type: 'stats', data: { message: 'No stats yet' } });
        }
    }, () => {
        sendUpdate({ type: 'stats', data: { message: 'No stats yet' } });
    });
    // Watch survival_graph.svg dynamically
    dynamicWatchFile('survival_graph.svg', () => {
        try {
            const graph = fs.readFileSync('survival_graph.svg', 'utf8');
            sendUpdate({ type: 'graph', data: graph });
        } catch (err) {
            sendUpdate({ type: 'graph', data: DEFAULT_SVG });
        }
    }, () => {
        sendUpdate({ type: 'graph', data: DEFAULT_SVG });
    });
}

// SSE endpoint
app.get('/stats-stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Send initial data
    let stats, graph;
    try {
        if (fs.existsSync('survival_stats.json')) {
            stats = JSON.parse(fs.readFileSync('survival_stats.json', 'utf8'));
        } else {
            stats = { message: 'No stats yet' };
        }
    } catch (err) {
        stats = { message: 'No stats yet' };
    }
    try {
        if (fs.existsSync('survival_graph.svg')) {
            graph = fs.readFileSync('survival_graph.svg', 'utf8');
        } else {
            graph = DEFAULT_SVG;
        }
    } catch (err) {
        graph = DEFAULT_SVG;
    }
    res.write(`data: ${JSON.stringify({ type: 'stats', data: stats })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'graph', data: graph })}\n\n`);

    // Add client to set
    const client = { res };
    clients.add(client);

    // Remove client on disconnect
    req.on('close', () => {
        clients.delete(client);
    });
});

// Serve a simple HTML page to view the stats
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Minecraft Bot Stats</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                #stats { margin-bottom: 20px; }
                #graph { max-width: 100%; }
                .container { max-width: 1200px; margin: 0 auto; }
                .status { 
                    position: fixed; 
                    top: 10px; 
                    right: 10px; 
                    padding: 5px 10px;
                    border-radius: 3px;
                }
                .connected { background: #d4edda; color: #155724; }
                .disconnected { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Minecraft Bot Stats</h1>
                <div id="status" class="status disconnected">Disconnected</div>
                <div id="stats">Loading stats...</div>
                <div id="graph">Loading graph...</div>
            </div>

            <script>
                const statsDiv = document.getElementById('stats');
                const graphDiv = document.getElementById('graph');
                const statusDiv = document.getElementById('status');
                
                // Get the server URL from the current location
                const serverUrl = window.location.origin;
                const evtSource = new EventSource(serverUrl + '/stats-stream');
                
                evtSource.onopen = function() {
                    statusDiv.textContent = 'Connected';
                    statusDiv.className = 'status connected';
                };
                
                evtSource.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'stats') {
                        statsDiv.innerHTML = '<h2>Current Stats:</h2><pre>' + 
                            JSON.stringify(data.data, null, 2) + '</pre>';
                    } else if (data.type === 'graph') {
                        graphDiv.innerHTML = data.data;
                    }
                };
                
                evtSource.onerror = function(err) {
                    console.error("EventSource failed:", err);
                    statusDiv.textContent = 'Disconnected';
                    statusDiv.className = 'status disconnected';
                };
            </script>
        </body>
        </html>
    `);
});

app.get('/stats', (req, res) => {
    fs.readFile(STATS_FILE, 'utf8', (err, data) => {
        let stats;
        if (err) {
            stats = { message: "No stats yet" };
        } else {
            try {
                stats = JSON.parse(data);
            } catch (e) {
                stats = { message: "No stats yet" };
            }
        }
        // Return a simple HTML snippet (with inline styles) so that the survival stats can be embedded (using an iframe) in the README (or any markdown file).
        res.setHeader("Content-Type", "text/html");
        res.setHeader("X-Frame-Options", "ALLOWALL"); // Allow embedding in an iframe (e.g. in README.md)
        res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 10px; background: #f8f9fa; }
    h2 { margin-top: 0; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <h2>Current Survival Stats</h2>
  <pre>${JSON.stringify(stats, null, 2)}</pre>
</body>
</html>
        `);
    });
});

app.get('/graph', (req, res) => {
    fs.readFile(GRAPH_FILE, 'utf8', (err, data) => {
        if (err) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.status(200).send(DEFAULT_SVG);
        } else {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.status(200).send(data);
        }
    });
});

// Start watching files and server
watchFiles();
app.listen(port, '0.0.0.0', () => {
    console.log(`Stats server running at http://0.0.0.0:${port}`);
    console.log('Access the stats from your browser using your AWS instance IP address');
}); 