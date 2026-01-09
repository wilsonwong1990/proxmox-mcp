#!/bin/bash

# Proxmox MCP Server Installer for Claude Code
# This script installs the Proxmox MCP server and configures it for Claude Code

set -e

REPO_URL="https://github.com/Ruashots/proxmox-mcp.git"
INSTALL_DIR="$HOME/.local/share/proxmox-mcp"

echo "=== Proxmox MCP Server Installer ==="
echo ""

# Check for required tools
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    echo "Install it from https://nodejs.org/ or via your package manager."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "Error: git is required but not installed."
    exit 1
fi

# Get Proxmox credentials (read from /dev/tty to work with curl | bash)
echo "Enter your Proxmox VE details:"
echo ""
read -p "Proxmox Host URL (e.g., https://192.168.1.100:8006): " PROXMOX_HOST < /dev/tty
read -p "API Token ID (e.g., root@pam!claude): " PROXMOX_TOKEN_ID < /dev/tty
read -sp "API Token Secret: " PROXMOX_TOKEN_SECRET < /dev/tty
echo ""

if [ -z "$PROXMOX_HOST" ] || [ -z "$PROXMOX_TOKEN_ID" ] || [ -z "$PROXMOX_TOKEN_SECRET" ]; then
    echo "Error: All fields are required."
    exit 1
fi

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies and build
echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

# Determine Claude Code config location
if [ "$(uname)" == "Darwin" ]; then
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
else
    CLAUDE_CONFIG_DIR="$HOME/.config/claude"
fi

CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# Create config directory if needed
mkdir -p "$CLAUDE_CONFIG_DIR"

# Create or update Claude Code config
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    echo "Updating Claude Code configuration..."
    # Check if jq is available for JSON manipulation
    if command -v jq &> /dev/null; then
        # Use jq to add/update the proxmox-mcp server config
        TMP_FILE=$(mktemp)
        jq --arg host "$PROXMOX_HOST" \
           --arg token_id "$PROXMOX_TOKEN_ID" \
           --arg token_secret "$PROXMOX_TOKEN_SECRET" \
           --arg install_dir "$INSTALL_DIR" \
           '.mcpServers["proxmox-mcp"] = {
               "command": "node",
               "args": [($install_dir + "/dist/index.js")],
               "env": {
                   "PROXMOX_HOST": $host,
                   "PROXMOX_TOKEN_ID": $token_id,
                   "PROXMOX_TOKEN_SECRET": $token_secret
               }
           }' "$CLAUDE_CONFIG_FILE" > "$TMP_FILE"
        mv "$TMP_FILE" "$CLAUDE_CONFIG_FILE"
    else
        echo "Warning: jq not found. Please manually add the proxmox-mcp configuration."
        echo "See the README for configuration details."
    fi
else
    echo "Creating Claude Code configuration..."
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "proxmox-mcp": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "$PROXMOX_HOST",
        "PROXMOX_TOKEN_ID": "$PROXMOX_TOKEN_ID",
        "PROXMOX_TOKEN_SECRET": "$PROXMOX_TOKEN_SECRET"
      }
    }
  }
}
EOF
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "The Proxmox MCP server has been installed and configured."
echo "Restart Claude Code to activate the new MCP server."
echo ""
echo "You can now manage your Proxmox VE infrastructure through Claude Code!"
echo ""
echo "Example commands you can ask Claude:"
echo "  - List all VMs in my Proxmox cluster"
echo "  - Show the status of node pve1"
echo "  - Create a new VM with 4GB RAM and 2 cores"
echo "  - Start container 100"
echo "  - Create a snapshot of VM 101"
