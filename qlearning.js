class QLearning {
    constructor(bot, statsTracker) {
        this.qTable = new Map(); // State-action pairs -> Q-values
        this.learningRate = 0.1;
        this.discountFactor = 0.9;
        this.epsilon = 1.0; // Start with 100% exploration
        this.minEpsilon = 0.01; // Allow more long-term exploration
        this.epsilonDecay = 0.9999; // Slower decay to learn more
        this.statsTracker = statsTracker
        this.lastState = null
        this.lastAction = null

        // Absolute basic actions
        this.actions = [
            'forward',
            'back',
            'left',
            'right',
            'jump',
            'click'  // Single interaction type - bot will learn when to use it
        ];
    }

    // Get state representation
    getState(bot) {
        // Get basic entity info
        const pos = bot.entity.position;
        const maxEntityDistance = 32; // Maximum distance to consider
        const maxEntities = 5; // Maximum number of entities to track
        
        // Convert bot.entities (Map-like object) to array and get nearby entities
        const nearbyEntities = Object.values(bot.entities)
            .filter(e => e !== bot.entity && e.position) // Exclude self and entities without position
            .map(e => ({
                name: e.name,
                type: e.type,
                distance: e.position.distanceTo(pos),
                isHostile: new Set(['zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'slime', 'phantom']).has(e.name)
            }))
            .filter(e => e.distance <= maxEntityDistance) // Only include entities within range
            .sort((a, b) => a.distance - b.distance) // Sort by distance
            .slice(0, maxEntities); // Take closest N entities
        
        // Get block info
        const blockBelow = bot.blockAt(pos.offset(0, -1, 0));
        const blockInFront = bot.blockAt(pos.offset(0, 0, 1));
        
        // Create entity state array
        const entityStates = nearbyEntities.map(e => ({
            name: e.name,
            type: e.type,
            distance: e.distance / maxEntityDistance, // Normalize distance to 0-1
            isHostile: e.isHostile
        }));
        
        // Pad entity states array to fixed length if needed
        while (entityStates.length < maxEntities) {
            entityStates.push({
                name: 'none',
                type: 'none',
                distance: 1, // Max distance for non-existent entities
                isHostile: false
            });
        }
        
        // Enhanced state representation
        const state = {
            // Health and food (normalized 0-1)
            health: bot.health / 20,
            food: bot.food / 20,
            
            // Entity awareness - now includes all nearby entities
            entities: entityStates,
            hasEntityNearby: entityStates.some(e => e.name !== 'none'),
            
            // Block awareness
            blockBelow: blockBelow ? blockBelow.name : 'air',
            blockInFront: blockInFront ? blockInFront.name : 'air',
            isCollided: bot.entity.isCollidedHorizontally,
            
            // Environmental conditions
            isInWater: bot.entity.isInWater,
            isInLava: bot.entity.isInLava,
            isOnFire: bot.entity.isOnFire,
            isInRain: bot.isRaining,
            isDaytime: bot.time.timeOfDay < 13000, // Minecraft day is 0-24000, daytime is 0-12000
            
            // Movement state
            isFalling: !bot.entity.onGround,
            isSprinting: bot.entity.isSprinting,
            isSneaking: bot.entity.isSneaking
        };
        
        return JSON.stringify(state);
    }

    getQValue(state, action) {
        const stateActions = this.qTable.get(state) || {};
        return stateActions[action] || 0;
    }

    // Choose action using epsilon-greedy policy
    chooseAction(state) {
        if (Math.random() < this.epsilon) {
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        let bestAction = this.actions[0];
        let bestValue = this.getQValue(state, bestAction);

        for (const action of this.actions) {
            const value = this.getQValue(state, action);
            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }
        }
        return bestAction;
    }

    // Update Q-value based on reward
    update(state, action, nextState, reward) {
        // Use state and nextState directly as keys (they are already strings)
        const stateKey = state;
        const nextStateKey = nextState;
        
        // Initialize Q-values if they don't exist
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, {});
        }
        if (!this.qTable.get(stateKey)[action]) {
            this.qTable.get(stateKey)[action] = 0;
        }
        if (!this.qTable.has(nextStateKey)) {
            this.qTable.set(nextStateKey, {});
        }
        
        // Get max Q-value for next state
        const nextStateActions = this.qTable.get(nextStateKey) || {};
        const maxNextQ = Math.max(...Object.values(nextStateActions), 0);
        
        // Update Q-value using Q-learning formula
        this.qTable.get(stateKey)[action] = this.qTable.get(stateKey)[action] + 
            this.learningRate * (reward + this.discountFactor * maxNextQ - this.qTable.get(stateKey)[action]);
    }

    calculateReward(bot, oldState, action, newState) {
        const oldStateObj = JSON.parse(oldState);
        const newStateObj = JSON.parse(newState);
        
        // Only consider health changes
        const healthChange = newStateObj.health - oldStateObj.health;
        
        // Terminal state (death) overrides
        if (newStateObj.health <= 0) {
            return -1.0;  // Terminal state
        }

        return healthChange;
    }

    // Save Q-table to file
    saveQTable() {
        return Array.from(this.qTable.entries());
    }

    // Load Q-table from file
    loadQTable(data) {
        this.qTable = new Map(data);
    }
}

module.exports = QLearning; 