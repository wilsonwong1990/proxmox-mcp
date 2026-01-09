# Proxmox MCP Server

MCP (Model Context Protocol) server for the Proxmox VE API. Manage virtual machines, containers, storage, and nodes through Claude Code.

## Features

**360+ tools** covering the practical Proxmox VE API:

- **QEMU VMs** (97 tools): Full lifecycle, snapshots, backups, agent commands, cloudinit, firewall, VNC/Spice
- **LXC Containers** (62 tools): Full lifecycle, snapshots, firewall, features
- **Access Control** (45 tools): Users, groups, roles, ACLs, authentication domains, TFA
- **Node Management**: Status, services, network, storage, disks, certificates, APT, tasks
- **Storage** (5 tools): Configuration and content management
- **Resource Pools** (7 tools): Pool management and membership

Auto-generated from the official Proxmox VE 9 API schema.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Ruashots/proxmox-mcp/master/install.sh | bash
```

The installer will:
1. Clone this repository
2. Build the TypeScript source
3. Prompt for your Proxmox credentials
4. Configure Claude Code automatically

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Proxmox VE 7.0+** with API access
3. **API Token** - Create one in Proxmox UI:
   - Datacenter → Permissions → API Tokens → Add
   - Uncheck "Privilege Separation" for full access
   - Save the Token ID and Secret

## Manual Installation

```bash
# Clone the repository
git clone https://github.com/Ruashots/proxmox-mcp.git
cd proxmox-mcp

# Install dependencies
npm install

# Build
npm run build
```

Add to your Claude Code config (`~/.config/claude/claude_desktop_config.json` on Linux or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "proxmox-mcp": {
      "command": "node",
      "args": ["/path/to/proxmox-mcp/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "https://your-proxmox-host:8006",
        "PROXMOX_TOKEN_ID": "user@realm!tokenname",
        "PROXMOX_TOKEN_SECRET": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PROXMOX_HOST` | Proxmox API URL | `https://192.168.1.100:8006` |
| `PROXMOX_TOKEN_ID` | API Token ID | `root@pam!claude` |
| `PROXMOX_TOKEN_SECRET` | API Token Secret | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

## Tool Categories

### QEMU Virtual Machines
- **Lifecycle**: `pve_list_nodes_qemu`, `pve_create_nodes_qemu`, `pve_get_nodes_qemu_config`, `pve_update_nodes_qemu_config`, `pve_delete_nodes_qemu`
- **Power**: `pve_create_nodes_qemu_status_start`, `pve_create_nodes_qemu_status_stop`, `pve_create_nodes_qemu_status_shutdown`, `pve_create_nodes_qemu_status_reboot`, `pve_create_nodes_qemu_status_reset`
- **Suspend/Resume**: `pve_create_nodes_qemu_status_suspend`, `pve_create_nodes_qemu_status_resume`
- **Clone/Migrate**: `pve_create_nodes_qemu_clone`, `pve_create_nodes_qemu_migrate`, `pve_create_nodes_qemu_template`
- **Snapshots**: `pve_list_nodes_qemu_snapshot`, `pve_create_nodes_qemu_snapshot`, `pve_get_nodes_qemu_snapshot_config`, `pve_create_nodes_qemu_snapshot_rollback`, `pve_delete_nodes_qemu_snapshot`
- **Disks**: `pve_create_nodes_qemu_resize`, `pve_create_nodes_qemu_move_disk`, `pve_create_nodes_qemu_unlink`
- **Firewall**: `pve_list_nodes_qemu_firewall_rules`, `pve_create_nodes_qemu_firewall_rules`, `pve_get_nodes_qemu_firewall_options`
- **Agent**: `pve_create_nodes_qemu_agent_ping`, `pve_get_nodes_qemu_agent_info`, `pve_get_nodes_qemu_agent_network_get_interfaces`, `pve_create_nodes_qemu_agent_exec`, `pve_get_nodes_qemu_agent_file_read`, `pve_create_nodes_qemu_agent_file_write`
- **Cloudinit**: `pve_get_nodes_qemu_cloudinit_dump`
- **Remote Access**: `pve_create_nodes_qemu_vncproxy`, `pve_create_nodes_qemu_spiceproxy`, `pve_create_nodes_qemu_termproxy`

### LXC Containers
- **Lifecycle**: `pve_list_nodes_lxc`, `pve_create_nodes_lxc`, `pve_get_nodes_lxc_config`, `pve_update_nodes_lxc_config`, `pve_delete_nodes_lxc`
- **Power**: `pve_create_nodes_lxc_status_start`, `pve_create_nodes_lxc_status_stop`, `pve_create_nodes_lxc_status_shutdown`, `pve_create_nodes_lxc_status_reboot`
- **Suspend/Resume**: `pve_create_nodes_lxc_status_suspend`, `pve_create_nodes_lxc_status_resume`
- **Clone/Migrate**: `pve_create_nodes_lxc_clone`, `pve_create_nodes_lxc_migrate`, `pve_create_nodes_lxc_template`
- **Snapshots**: `pve_list_nodes_lxc_snapshot`, `pve_create_nodes_lxc_snapshot`, `pve_create_nodes_lxc_snapshot_rollback`, `pve_delete_nodes_lxc_snapshot`
- **Firewall**: `pve_list_nodes_lxc_firewall_rules`, `pve_create_nodes_lxc_firewall_rules`, `pve_get_nodes_lxc_firewall_options`
- **Remote Access**: `pve_create_nodes_lxc_vncproxy`, `pve_create_nodes_lxc_termproxy`

### Access Control
- **Users**: `pve_list_access_users`, `pve_get_access_users`, `pve_create_access_users`, `pve_update_access_users`, `pve_delete_access_users`
- **Groups**: `pve_list_access_groups`, `pve_get_access_groups`, `pve_create_access_groups`, `pve_update_access_groups`, `pve_delete_access_groups`
- **Roles**: `pve_list_access_roles`, `pve_get_access_roles`, `pve_create_access_roles`, `pve_update_access_roles`, `pve_delete_access_roles`
- **ACLs**: `pve_list_access_acl`, `pve_update_access_acl`
- **Domains**: `pve_list_access_domains`, `pve_get_access_domains`, `pve_create_access_domains`, `pve_update_access_domains`, `pve_delete_access_domains`
- **TFA**: `pve_list_access_tfa`, `pve_get_access_tfa`, `pve_create_access_tfa`, `pve_delete_access_tfa`

### Node Management
- **Status**: `pve_list_nodes`, `pve_get_nodes_status`, `pve_get_nodes_version`
- **Time/DNS**: `pve_get_nodes_time`, `pve_update_nodes_time`, `pve_get_nodes_dns`, `pve_update_nodes_dns`
- **Network**: `pve_list_nodes_network`, `pve_get_nodes_network`, `pve_create_nodes_network`, `pve_update_nodes_network`, `pve_delete_nodes_network`
- **Services**: `pve_list_nodes_services`, `pve_get_nodes_services`, `pve_create_nodes_services_start`, `pve_create_nodes_services_stop`, `pve_create_nodes_services_restart`
- **Storage**: `pve_list_nodes_storage`, `pve_get_nodes_storage_status`, `pve_list_nodes_storage_content`, `pve_create_nodes_storage_content`, `pve_delete_nodes_storage_content`
- **Disks**: `pve_list_nodes_disks_list`, `pve_get_nodes_disks_smart`, `pve_create_nodes_disks_initgpt`
- **Certificates**: `pve_list_nodes_certificates_info`, `pve_create_nodes_certificates_acme_certificate`
- **Tasks**: `pve_list_nodes_tasks`, `pve_get_nodes_tasks_status`, `pve_get_nodes_tasks_log`
- **Logs**: `pve_get_nodes_syslog`, `pve_get_nodes_journal`
- **APT**: `pve_list_nodes_apt_update`, `pve_create_nodes_apt_update`, `pve_get_nodes_apt_versions`

### Storage
- `pve_list_storage`, `pve_get_storage`, `pve_create_storage`, `pve_update_storage`, `pve_delete_storage`

### Resource Pools
- `pve_list_pools`, `pve_get_pools`, `pve_create_pools`, `pve_update_pools`, `pve_delete_pools`

## Example Usage

Once configured, you can ask Claude things like:

- "List all VMs in my Proxmox cluster"
- "Show the status of node pve1"
- "Create a new Ubuntu VM with 4GB RAM, 2 cores, and a 32GB disk"
- "Start VM 100"
- "Create a snapshot of container 101 named 'before-upgrade'"
- "Migrate VM 102 to node pve2"
- "Show available storage on the cluster"
- "Create a new user claude@pve with PVEAdmin role"
- "Get the QEMU agent info for VM 100"
- "Run a command on VM 100 using the guest agent"

## Security Notes

- API tokens are stored in the Claude Code config file
- The server accepts self-signed certificates (common for Proxmox)
- Use least-privilege API tokens when possible
- Consider creating dedicated tokens for Claude with limited permissions

## Creating an API Token

1. Log into Proxmox web UI
2. Go to **Datacenter → Permissions → API Tokens**
3. Click **Add**
4. Select a user (e.g., `root@pam`)
5. Enter a Token ID (e.g., `claude`)
6. Uncheck "Privilege Separation" for full access (or leave checked and assign specific permissions)
7. Click **Add**
8. **Copy the Token Secret immediately** - it won't be shown again!

Your Token ID will be: `root@pam!claude`

## License

MIT
