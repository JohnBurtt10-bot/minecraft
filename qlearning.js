class QLearning {
    constructor() {
        this.qTable = new Map(); // State-action pairs -> Q-values
        this.learningRate = 0.1;
        this.discountFactor = 0.9;
        this.epsilon = 1.0; // Start with 100% exploration
        this.minEpsilon = 0.01; // Allow more long-term exploration
        this.epsilonDecay = 0.9999; // Slower decay to learn more

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
        // Minimal state - just what the bot can directly "sense"
        const state = {
            health: Math.floor(bot.health),
            canSeeBlock: bot.blockAtCursor(4) !== null,
            canSeeEntity: bot.nearestEntity() !== null,
            touchingBlock: bot.entity.isCollidedHorizontally,
            falling: !bot.entity.onGround
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
    update(oldState, action, newState, reward) {
        // Q-learning update formula
        const oldQ = this.getQValue(oldState, action);
        const nextMaxQ = Math.max(...this.actions.map(a => this.getQValue(newState, a)));
        
        // Calculate new Q-value
        const newQ = oldQ + this.learningRate * (
            reward + this.discountFactor * nextMaxQ - oldQ
        );

        // Update Q-table
        if (!this.qTable.has(oldState)) {
            this.qTable.set(oldState, {});
        }
        this.qTable.get(oldState)[action] = newQ;

        // Decay epsilon
        this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
    }

    calculateReward(bot, oldState, action, newState) {
        const oldStateObj = JSON.parse(oldState);
        const newStateObj = JSON.parse(newState);
        
        // The only true reward is survival
        let reward = 0;
        
        // Staying alive is good
        reward += 0.1;

        // Health changes are important
        const healthDiff = newStateObj.health - oldStateObj.health;
        reward += healthDiff;

        // Death is bad
        if (newStateObj.health <= 0) {
            reward -= 1;
        }

        return reward;
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