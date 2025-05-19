const express = require('express');
const fs = require('fs');
const path = require('path');
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

// Watch for file changes
function watchFiles() {
    // Watch survival_stats.json
    fs.watch('survival_stats.json', (eventType) => {
        if (eventType === 'change') {
            try {
                const stats = JSON.parse(fs.readFileSync('survival_stats.json', 'utf8'));
                sendUpdate({ type: 'stats', data: stats });
            } catch (err) {
                console.error('Error reading stats:', err);
            }
        }
    });

    // Watch survival_graph.svg
    fs.watch('survival_graph.svg', (eventType) => {
        if (eventType === 'change') {
            try {
                const graph = fs.readFileSync('survival_graph.svg', 'utf8');
                sendUpdate({ type: 'graph', data: graph });
            } catch (err) {
                console.error('Error reading graph:', err);
            }
        }
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
    try {
        const stats = JSON.parse(fs.readFileSync('survival_stats.json', 'utf8'));
        const graph = fs.readFileSync('survival_graph.svg', 'utf8');
        
        res.write(`data: ${JSON.stringify({ type: 'stats', data: stats })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'graph', data: graph })}\n\n`);
    } catch (err) {
        console.error('Error sending initial data:', err);
    }

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

// Start watching files and server
watchFiles();
app.listen(port, '0.0.0.0', () => {
    console.log(`Stats server running at http://0.0.0.0:${port}`);
    console.log('Access the stats from your browser using your AWS instance IP address');
}); 