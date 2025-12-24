#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install and setup nvm
setup_nvm() {
    echo "🔍 Checking for nvm..."
    if ! command_exists nvm; then
        echo "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
}

# Function to install and use the correct Node.js version
setup_node() {
    local required_node_version="$1"
    echo "🔍 Setting up Node.js..."
    if ! command_exists node || [[ $(node -v | cut -d 'v' -f 2) != "$required_node_version" ]]; then
        echo "Installing Node.js $required_node_version..."
        nvm install $required_node_version
        nvm use $required_node_version
    fi
}

# Function to verify and update npm version
setup_npm() {
    local required_npm_version="$1"
    echo "🔍 Checking npm version..."
    current_npm_version=$(npm -v)
    if [ "$(printf '%s\n' "$required_npm_version" "$current_npm_version" | sort -V | head -n1)" != "$required_npm_version" ]; then
        echo "Updating npm to latest version..."
        npm install -g npm@latest
    fi
}

# Main function to setup Node.js environment
setup_node_environment() {
    local node_version="${1:-23.7.0}"
    local npm_version="${2:-10.0.0}"

    setup_nvm
    setup_node "$node_version"
    setup_npm "$npm_version"

    echo "Node.js environment setup complete!"
    echo "Node.js version: $(node -v)"
    echo "npm version: $(npm -v)"
}

# If this script is executed directly (not sourced), run the setup
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_node_environment "$@"
fi
