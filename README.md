# Proxmox MCP Server

MCP (Model Context Protocol) server for the Proxmox VE API. Manage VMs and containers through Claude Code.

## Features

**55 essential tools** for day-to-day Proxmox management:

- **Nodes**: List nodes, get status and version
- **QEMU VMs**: List, status, start/stop/reboot, snapshots, clone, migrate
- **LXC Containers**: List, status, start/stop/reboot, snapshots, clone, migrate
- **Storage**: List storage, browse content, check status
- **Tasks**: View running tasks and logs

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Ruashots/proxmox-mcp/master/install.sh | bash
```

## Prerequisites

- **Node.js 18+**
- **jq** (`sudo apt install jq`)
- **Proxmox VE 7.0+** with API token

## Manual Installation

```bash
git clone https://github.com/Ruashots/proxmox-mcp.git ~/.local/share/proxmox-mcp
cd ~/.local/share/proxmox-mcp
npm install && npm run build
```

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "proxmox-mcp": {
      "command": "node",
      "args": ["/home/YOUR_USER/.local/share/proxmox-mcp/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "https://192.168.1.100:8006",
        "PROXMOX_TOKEN_ID": "root@pam!claude",
        "PROXMOX_TOKEN_SECRET": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

## Tools

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

## Creating an API Token

1. Proxmox UI → Datacenter → Permissions → API Tokens → Add
2. Select user (e.g., `root@pam`), enter Token ID (e.g., `claude`)
3. Uncheck "Privilege Separation" for full access
4. Copy the secret immediately!

## License

MIT
