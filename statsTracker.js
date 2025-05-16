class StatsTracker {
    constructor() {
        this.survivalTimes = []
        this.startTime = null
    }

    startLife() {
        this.startTime = Date.now()
    }

    endLife() {
        if (this.startTime) {
            const survivalTime = (Date.now() - this.startTime) / 1000 // Convert to seconds
            this.survivalTimes.push(survivalTime)
            this.startTime = null
            return survivalTime
        }
        return 0
    }

    generateGithubGraph() {
        const fs = require('fs')
        
        // Create SVG for GitHub-style graph
        let svg = `<svg width="720" height="400" xmlns="http://www.w3.org/2000/svg">
            <style>
                .survival-point { fill: #196127; }
                .survival-point:hover { fill: #239a3b; }
                .axis { stroke: #666; stroke-width: 1; }
                .axis-label { font-family: Arial; font-size: 12px; fill: #666; }
            </style>
            <rect width="720" height="400" fill="#ffffff"/>
            
            <!-- Y-axis -->
            <line x1="50" y1="350" x2="50" y2="50" class="axis"/>
            
            <!-- X-axis -->
            <line x1="50" y1="350" x2="670" y2="350" class="axis"/>
            
            <!-- Labels -->
            <text x="10" y="200" class="axis-label" transform="rotate(-90, 10, 200)">Survival Time (seconds)</text>
            <text x="350" y="380" class="axis-label">Life Number</text>\n`

        // Calculate scales
        const maxSurvival = Math.max(...this.survivalTimes, 1)
        const yScale = 280 / maxSurvival // 280 = available height (350 - 50 - 20 padding)
        const xScale = Math.min(20, 600 / this.survivalTimes.length) // Max 20px per point

        // Add data points
        this.survivalTimes.forEach((time, index) => {
            const x = 50 + (index * xScale)
            const y = 350 - (time * yScale)
            svg += `    <circle cx="${x}" cy="${y}" r="4" class="survival-point">
                <title>Life ${index + 1}: ${time.toFixed(1)}s</title>
            </circle>\n`

            // Add connecting line to next point if it exists
            if (index < this.survivalTimes.length - 1) {
                const nextX = 50 + ((index + 1) * xScale)
                const nextY = 350 - (this.survivalTimes[index + 1] * yScale)
                svg += `    <line x1="${x}" y1="${y}" x2="${nextX}" y2="${nextY}" 
                    stroke="#196127" stroke-width="2" opacity="0.5"/>\n`
            }
        })

        // Add Y-axis labels
        for (let i = 0; i <= 5; i++) {
            const value = (maxSurvival * i / 5).toFixed(1)
            const y = 350 - (value * yScale)
            svg += `    <text x="45" y="${y}" class="axis-label" text-anchor="end">${value}</text>
            <line x1="48" y1="${y}" x2="52" y2="${y}" class="axis"/>\n`
        }

        svg += '</svg>'

        // Save the graph
        fs.writeFileSync('survival_graph.svg', svg)

        // Generate stats summary
        const stats = {
            totalLives: this.survivalTimes.length,
            averageSurvival: this.survivalTimes.reduce((a, b) => a + b, 0) / this.survivalTimes.length,
            maxSurvival: Math.max(...this.survivalTimes),
            minSurvival: Math.min(...this.survivalTimes),
            lastSurvival: this.survivalTimes[this.survivalTimes.length - 1]
        }

        // Save stats as JSON
        fs.writeFileSync('survival_stats.json', JSON.stringify(stats, null, 2))
    }
}

module.exports = StatsTracker 