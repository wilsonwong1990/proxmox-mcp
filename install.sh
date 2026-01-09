#!/bin/bash

# Proxmox MCP Server Installer for Claude Code
# This script installs the Proxmox MCP server and configures it for Claude Code

set -e

REPO_URL="https://github.com/Ruashots/proxmox-mcp.git"
INSTALL_DIR="$HOME/.local/share/proxmox-mcp"
CLAUDE_CONFIG_FILE="$HOME/.claude.json"

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

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Install it via: sudo apt install jq"
    exit 1
fi

# Get Proxmox credentials (read from /dev/tty to work with curl | bash)
echo "Enter your Proxmox VE details:"
echo ""
printf "Proxmox Host URL (e.g., https://192.168.1.100:8006): "
read PROXMOX_HOST < /dev/tty
printf "API Token ID (e.g., root@pam!claude): "
read PROXMOX_TOKEN_ID < /dev/tty
printf "API Token Secret: "
stty -echo < /dev/tty
read PROXMOX_TOKEN_SECRET < /dev/tty
stty echo < /dev/tty
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

# Update Claude Code configuration in ~/.claude.json
echo "Updating Claude Code configuration..."

# Create jq filter file to avoid shell escaping issues
TMP_FILTER=$(mktemp)
cat > "$TMP_FILTER" << JQEOF
.mcpServers["proxmox-mcp"] = {
    "command": "node",
    "args": ["\$INSTALL_DIR/dist/index.js"],
    "env": {
        "PROXMOX_HOST": "\$PROXMOX_HOST",
        "PROXMOX_TOKEN_ID": "\$PROXMOX_TOKEN_ID",
        "PROXMOX_TOKEN_SECRET": "\$PROXMOX_TOKEN_SECRET"
    }
}
JQEOF

# Replace placeholders with actual values
sed -i "s|\$INSTALL_DIR|$INSTALL_DIR|g" "$TMP_FILTER"
sed -i "s|\$PROXMOX_HOST|$PROXMOX_HOST|g" "$TMP_FILTER"
sed -i "s|\$PROXMOX_TOKEN_ID|$PROXMOX_TOKEN_ID|g" "$TMP_FILTER"
sed -i "s|\$PROXMOX_TOKEN_SECRET|$PROXMOX_TOKEN_SECRET|g" "$TMP_FILTER"

if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    TMP_FILE=$(mktemp)
    jq -f "$TMP_FILTER" "$CLAUDE_CONFIG_FILE" > "$TMP_FILE"
    mv "$TMP_FILE" "$CLAUDE_CONFIG_FILE"
else
    echo '{"mcpServers":{}}' | jq -f "$TMP_FILTER" > "$CLAUDE_CONFIG_FILE"
fi

rm -f "$TMP_FILTER"

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
