# Proxmox MCP Server

MCP ([Model Context Protocol](https://modelcontextprotocol.io/)) server for the Proxmox VE API. Manage VMs, containers, nodes, storage, and cluster operations through any MCP-compatible client — GitHub Copilot, Claude Code, or others.

Forked from [Ruashots/proxmox-mcp](https://github.com/Ruashots/proxmox-mcp).

## Additional Configuration Features

- **Custom CA certificate support** via `PROXMOX_CA_CERT`
- **Read-only mode** via `PROXMOX_READ_ONLY=true`
- **Audit logging** for all tool invocations
- **Multi-client documentation** for GitHub Copilot and Claude Code

## Features

**55 tools** for day-to-day Proxmox management:

- **Nodes**: List nodes, get status and version
- **QEMU VMs**: List, status, start/stop/reboot, snapshots, clone, migrate, config
- **LXC Containers**: List, status, start/stop/reboot, snapshots, clone, migrate, config
- **Storage**: List storage, browse content, check status
- **Tasks**: View running tasks and logs

## Prerequisites

- **Node.js 18+**
- **Proxmox VE 7.0+** with API token

## Installation

```bash
git clone https://github.com/wilsonwong1990/proxmox-mcp.git
cd proxmox-mcp
npm install && npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROXMOX_HOST` | Yes | Proxmox API URL (e.g., `https://192.168.1.100:8006`) |
| `PROXMOX_TOKEN_ID` | Yes | API token ID (e.g., `mcp@pve!copilot`) |
| `PROXMOX_TOKEN_SECRET` | Yes | API token secret |
| `PROXMOX_CA_CERT` | No | Path to custom CA certificate file for TLS verification |
| `PROXMOX_ALLOW_SELF_SIGNED` | No | Set to `true` to allow self-signed certs (less secure than `PROXMOX_CA_CERT`) |
| `PROXMOX_READ_ONLY` | No | Set to `true` to restrict to read-only (GET) operations |

### GitHub Copilot CLI

Copy the example config and edit with your values:

```bash
cp .github/copilot/mcp.json.example .github/copilot/mcp.json
```

Or add to your user-level config at `~/.config/github-copilot/mcp.json`:

```json
{
  "mcpServers": {
    "proxmox-mcp": {
      "command": "node",
      "args": ["/path/to/proxmox-mcp/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "https://192.168.1.100:8006",
        "PROXMOX_TOKEN_ID": "mcp@pve!copilot",
        "PROXMOX_TOKEN_SECRET": "your-token-secret",
        "PROXMOX_READ_ONLY": "true",
        "PROXMOX_CA_CERT": "/path/to/proxmox-ca.pem"
      }
    }
  }
}
```

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "proxmox-mcp": {
      "command": "node",
      "args": ["/path/to/proxmox-mcp/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "https://192.168.1.100:8006",
        "PROXMOX_TOKEN_ID": "mcp@pve!copilot",
        "PROXMOX_TOKEN_SECRET": "your-token-secret",
        "PROXMOX_READ_ONLY": "true",
        "PROXMOX_CA_CERT": "/path/to/proxmox-ca.pem"
      }
    }
  }
}
```

## Security Best Practices

### 1. Create a Dedicated API User

Create a least-privilege user rather than using root:

```bash
# On your Proxmox host:
pveum user add mcp@pve
pveum aclmod / -user mcp@pve -role PVEAuditor    # read-only access
pveum user token add mcp@pve copilot
```

For read-write access, create a custom role with only the permissions you need:

```bash
pveum role add MCPOperator -privs "VM.PowerMgmt,VM.Console,VM.Monitor,VM.Snapshot,VM.Snapshot.Rollback,VM.Audit,Datastore.Audit,Sys.Audit"
pveum aclmod / -user mcp@pve -role MCPOperator
```

### 2. Use Proper TLS

Export your Proxmox CA certificate and reference it with `PROXMOX_CA_CERT`:

```bash
# Copy from Proxmox host
scp root@proxmox:/etc/pve/pve-root-ca.pem ./proxmox-ca.pem

# Then set in your MCP config env:
"PROXMOX_CA_CERT": "/path/to/proxmox-ca.pem"
```

Use `PROXMOX_ALLOW_SELF_SIGNED=true` as a temporary fallback during initial setup if needed.

### 3. Start with Read-Only Mode

Set `PROXMOX_READ_ONLY=true` initially. This filters the tool list to only GET operations. Graduate to read-write once you're comfortable.

### 4. Audit Logging

All tool invocations are logged to stderr with timestamps:

```
[2026-03-19T02:15:00.000Z] AUDIT: tool=pve_list_nodes args={}
[2026-03-19T02:15:01.000Z] AUDIT: tool=pve_get_nodes_qemu_status_current args={"node":"pve","vmid":"100"}
```

## Tools Reference

### Nodes
| Tool | Description |
|------|-------------|
| `pve_list_nodes` | List all nodes |
| `pve_get_nodes_status` | Get node status |
| `pve_get_nodes_version` | Get node version |

### QEMU VMs
| Tool | Description |
|------|-------------|
| `pve_list_nodes_qemu` | List all VMs on a node |
| `pve_get_nodes_qemu` | Get VM details |
| `pve_get_nodes_qemu_config` | Get VM configuration |
| `pve_update_nodes_qemu_config` | Update VM configuration |
| `pve_get_nodes_qemu_status_current` | Get current VM status |
| `pve_create_nodes_qemu_status_start` | Start VM |
| `pve_create_nodes_qemu_status_stop` | Stop VM (hard) |
| `pve_create_nodes_qemu_status_shutdown` | Shutdown VM (graceful) |
| `pve_create_nodes_qemu_status_reboot` | Reboot VM |
| `pve_create_nodes_qemu_status_suspend` | Suspend VM |
| `pve_create_nodes_qemu_status_resume` | Resume VM |
| `pve_list_nodes_qemu_snapshot` | List snapshots |
| `pve_create_nodes_qemu_snapshot` | Create snapshot |
| `pve_get_nodes_qemu_snapshot` | Get snapshot details |
| `pve_delete_nodes_qemu_snapshot` | Delete snapshot |
| `pve_create_nodes_qemu_snapshot_rollback` | Rollback to snapshot |
| `pve_create_nodes_qemu_clone` | Clone VM |
| `pve_create_nodes_qemu_migrate` | Migrate VM to another node |

### LXC Containers
| Tool | Description |
|------|-------------|
| `pve_list_nodes_lxc` | List all containers on a node |
| `pve_get_nodes_lxc` | Get container details |
| `pve_get_nodes_lxc_config` | Get container configuration |
| `pve_update_nodes_lxc_config` | Update container configuration |
| `pve_get_nodes_lxc_status_current` | Get current container status |
| `pve_create_nodes_lxc_status_start` | Start container |
| `pve_create_nodes_lxc_status_stop` | Stop container |
| `pve_create_nodes_lxc_status_shutdown` | Shutdown container |
| `pve_create_nodes_lxc_status_reboot` | Reboot container |
| `pve_create_nodes_lxc_status_suspend` | Suspend container |
| `pve_create_nodes_lxc_status_resume` | Resume container |
| `pve_list_nodes_lxc_snapshot` | List snapshots |
| `pve_create_nodes_lxc_snapshot` | Create snapshot |
| `pve_get_nodes_lxc_snapshot` | Get snapshot details |
| `pve_delete_nodes_lxc_snapshot` | Delete snapshot |
| `pve_create_nodes_lxc_snapshot_rollback` | Rollback to snapshot |
| `pve_create_nodes_lxc_clone` | Clone container |
| `pve_create_nodes_lxc_migrate` | Migrate container |

### Storage
| Tool | Description |
|------|-------------|
| `pve_list_nodes_storage` | List storage on a node |
| `pve_get_nodes_storage_status` | Get storage status |
| `pve_list_nodes_storage_content` | List storage content |

### Tasks
| Tool | Description |
|------|-------------|
| `pve_list_nodes_tasks` | List tasks |
| `pve_get_nodes_tasks_status` | Get task status |
| `pve_get_nodes_tasks_log` | Get task log |

## Example Usage

- "List all VMs on node pve"
- "Start VM 100 on node pve"
- "Create a snapshot of container 101 called before-update"
- "Show storage status on node pve"
- "What tasks are running on node pve?"

## License

MIT
