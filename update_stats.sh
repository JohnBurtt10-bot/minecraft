#!/bin/bash

# Function to commit and push if there are changes
update_files() {
    # Add the specific files we want to track
    git add survival_graph.svg survival_stats.json

    # Check if there are any changes
    if git diff --staged --quiet; then
        echo "No changes to commit"
    else
        # Get current timestamp
        timestamp=$(date "+%Y-%m-%d %H:%M:%S")
        
        # Commit with timestamp
        git commit -m "Update survival stats and graph - $timestamp"
        
        # Push to GitHub
        git push origin master
        
        echo "Updated and pushed stats at $timestamp"
    fi
}

# Initial update
update_files

# Update every 5 minutes
while true; do
    sleep 300  # 5 minutes
    update_files
done 