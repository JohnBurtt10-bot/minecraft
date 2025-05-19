class StatsTracker {
    constructor() {
        this.survivalTimes = []
        this.startTime = null
        this.episodeRewards = []  // Track rewards per episode
        this.stateVisits = new Map()  // Track how often each state is visited
        this.lastUpdate = Date.now()
        this.updateInterval = 5000  // Update stats every 5 seconds
    }

    startLife() {
        this.startTime = Date.now()
        this.episodeRewards = []  // Reset rewards for new episode
    }

    endLife() {
        if (this.startTime) {
            const survivalTime = (Date.now() - this.startTime) / 1000 // Convert to seconds
            this.survivalTimes.push(survivalTime)
            this.startTime = null
            
            // Log episode summary
            this.logEpisodeSummary(survivalTime)
            return survivalTime
        }
        return 0
    }

    // Track reward for current episode
    addReward(reward) {
        this.episodeRewards.push(reward)
    }

    // Track state visits
    trackState(state) {
        const stateKey = typeof state === 'string' ? state : JSON.stringify(state)
        this.stateVisits.set(stateKey, (this.stateVisits.get(stateKey) || 0) + 1)
    }

    // Log real-time learning metrics
    logEpisodeSummary(survivalTime) {
        const avgReward = this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length
        const totalReward = this.episodeRewards.reduce((a, b) => a + b, 0)
        
        console.log('\n=== Episode Summary ===')
        console.log(`Survival Time: ${survivalTime.toFixed(1)}s`)
        console.log(`Average Reward: ${avgReward.toFixed(3)}`)
        console.log(`Total Reward: ${totalReward.toFixed(3)}`)
        console.log(`States Explored: ${this.stateVisits.size}`)
        
        // Calculate learning progress
        if (this.survivalTimes.length > 1) {
            const last5Avg = this.survivalTimes.slice(-5).reduce((a, b) => a + b, 0) / 5
            const prev5Avg = this.survivalTimes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
            const improvement = ((last5Avg - prev5Avg) / prev5Avg * 100).toFixed(1)
            console.log(`Learning Progress: ${improvement}% (last 5 vs previous 5 episodes)`)
        }
        console.log('=====================\n')
    }

    // Periodic stats update
    updateStats() {
        const now = Date.now()
        if (now - this.lastUpdate >= this.updateInterval) {
            this.lastUpdate = now
            if (this.startTime) {  // Only update if bot is alive
                const currentSurvival = (now - this.startTime) / 1000
                const avgReward = this.episodeRewards.length > 0 ? 
                    this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length : 0
                
                console.log('\n=== Current Status ===')
                console.log(`Current Survival: ${currentSurvival.toFixed(1)}s`)
                console.log(`Current Avg Reward: ${avgReward.toFixed(3)}`)
                console.log(`States Explored: ${this.stateVisits.size}`)
                console.log('=====================\n')
            }
        }
    }

    generateGithubGraph() {
        const fs = require('fs')
        
        // Create SVG for GitHub-style graph with enhanced visualization
        let svg = `<svg width="720" height="400" xmlns="http://www.w3.org/2000/svg">
            <style>
                .survival-point { fill: #196127; }
                .survival-point:hover { fill: #239a3b; }
                .axis { stroke: #666; stroke-width: 1; }
                .axis-label { font-family: Arial; font-size: 12px; fill: #666; }
                .trend-line { stroke: #239a3b; stroke-width: 2; stroke-dasharray: 5,5; }
                .reward-point { fill: #0366d6; }
                .reward-point:hover { fill: #2188ff; }
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
        const yScale = 280 / maxSurvival
        const xScale = Math.min(20, 600 / this.survivalTimes.length)

        // Add data points and trend line
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
        this.survivalTimes.forEach((time, index) => {
            const x = 50 + (index * xScale)
            const y = 350 - (time * yScale)
            
            // Add survival point
            svg += `    <circle cx="${x}" cy="${y}" r="4" class="survival-point">
                <title>Life ${index + 1}: ${time.toFixed(1)}s</title>
            </circle>\n`

            // Calculate trend line
            sumX += index
            sumY += time
            sumXY += index * time
            sumX2 += index * index
        })

        // Draw trend line if we have enough points
        if (this.survivalTimes.length > 1) {
            const n = this.survivalTimes.length
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
            const intercept = (sumY - slope * sumX) / n
            
            const startX = 50
            const startY = 350 - (intercept * yScale)
            const endX = 50 + ((n - 1) * xScale)
            const endY = 350 - ((intercept + slope * (n - 1)) * yScale)
            
            svg += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" class="trend-line"/>\n`
        }

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

        // Generate enhanced stats summary
        const stats = {
            totalLives: this.survivalTimes.length,
            averageSurvival: this.survivalTimes.reduce((a, b) => a + b, 0) / this.survivalTimes.length,
            maxSurvival: Math.max(...this.survivalTimes),
            minSurvival: Math.min(...this.survivalTimes),
            lastSurvival: this.survivalTimes[this.survivalTimes.length - 1],
            statesExplored: this.stateVisits.size,
            averageReward: this.episodeRewards.length > 0 ? 
                this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length : 0,
            learningProgress: this.survivalTimes.length > 10 ? 
                ((this.survivalTimes.slice(-5).reduce((a, b) => a + b, 0) / 5) /
                (this.survivalTimes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5) - 1) * 100 : 0
        }

        // Save enhanced stats as JSON
        fs.writeFileSync('survival_stats.json', JSON.stringify(stats, null, 2))
    }
}

module.exports = StatsTracker 