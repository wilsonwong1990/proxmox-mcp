# Proxmox MCP Server

MCP (Model Context Protocol) server for the Proxmox VE API. Manage virtual machines, containers, storage, and cluster resources through Claude Code.

## Features

**120+ tools** covering the full Proxmox VE API:

- **Access Control**: Users, groups, roles, ACLs, authentication domains
- **Cluster**: Status, resources, options, backup jobs, HA, firewall, replication
- **Nodes**: Status, services, network, storage, disks, certificates, APT
- **QEMU VMs**: Full lifecycle (create, start, stop, migrate, clone, snapshot, backup)
- **LXC Containers**: Full lifecycle (create, start, stop, migrate, clone, snapshot)
- **Storage**: Configuration, content management, uploads, downloads
- **Resource Pools**: Pool management and membership

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

## Available Tools

### Access Control
- `pve_list_users`, `pve_get_user`, `pve_create_user`, `pve_update_user`, `pve_delete_user`
- `pve_list_groups`, `pve_get_group`, `pve_create_group`, `pve_update_group`, `pve_delete_group`
- `pve_list_roles`, `pve_get_role`, `pve_create_role`, `pve_update_role`, `pve_delete_role`
- `pve_get_acl`, `pve_update_acl`
- `pve_list_domains`, `pve_get_domain`

### Cluster
- `pve_cluster_status`, `pve_cluster_resources`, `pve_cluster_tasks`
- `pve_cluster_options`, `pve_cluster_set_options`, `pve_cluster_nextid`, `pve_cluster_log`
- `pve_list_backup_jobs`, `pve_get_backup_job`, `pve_create_backup_job`, `pve_update_backup_job`, `pve_delete_backup_job`
- `pve_ha_status`, `pve_list_ha_resources`, `pve_get_ha_resource`, `pve_create_ha_resource`, `pve_update_ha_resource`, `pve_delete_ha_resource`
- `pve_list_ha_groups`, `pve_get_ha_group`, `pve_create_ha_group`, `pve_update_ha_group`, `pve_delete_ha_group`
- `pve_cluster_firewall_options`, `pve_set_cluster_firewall_options`, `pve_list_cluster_firewall_rules`, `pve_create_cluster_firewall_rule`
- `pve_list_security_groups`, `pve_create_security_group`, `pve_list_ipsets`, `pve_create_ipset`
- `pve_list_firewall_aliases`, `pve_create_firewall_alias`
- `pve_list_replication_jobs`, `pve_get_replication_job`, `pve_create_replication_job`, `pve_delete_replication_job`

### Nodes
- `pve_list_nodes`, `pve_get_node_status`, `pve_get_node_version`
- `pve_get_node_time`, `pve_set_node_time`, `pve_get_node_dns`, `pve_set_node_dns`
- `pve_get_node_syslog`, `pve_get_node_journal`, `pve_get_node_subscription`, `pve_get_node_report`
- `pve_node_start_all`, `pve_node_stop_all`
- `pve_list_node_services`, `pve_get_node_service_state`, `pve_node_service_start`, `pve_node_service_stop`, `pve_node_service_restart`, `pve_node_service_reload`
- `pve_list_node_networks`, `pve_get_node_network`, `pve_create_node_network`, `pve_update_node_network`, `pve_delete_node_network`, `pve_apply_node_network`, `pve_revert_node_network`
- `pve_list_node_tasks`, `pve_get_node_task_status`, `pve_get_node_task_log`, `pve_stop_node_task`
- `pve_list_node_storage`, `pve_get_node_storage_status`, `pve_list_node_storage_content`, `pve_upload_to_storage`, `pve_download_url_to_storage`, `pve_delete_storage_content`
- `pve_list_node_disks`, `pve_get_node_disk_smart`, `pve_initialize_disk_gpt`, `pve_wipe_disk`
- `pve_list_node_certificates`, `pve_get_node_acme`, `pve_order_node_certificate`, `pve_renew_node_certificate`
- `pve_list_apt_updates`, `pve_apt_update`, `pve_apt_changelog`, `pve_apt_versions`

### QEMU Virtual Machines
- `pve_list_vms`, `pve_get_vm_status`, `pve_get_vm_config`
- `pve_create_vm`, `pve_update_vm_config`, `pve_delete_vm`
- `pve_start_vm`, `pve_stop_vm`, `pve_shutdown_vm`, `pve_reboot_vm`, `pve_reset_vm`
- `pve_suspend_vm`, `pve_resume_vm`
- `pve_clone_vm`, `pve_migrate_vm`, `pve_convert_vm_to_template`
- `pve_resize_vm_disk`, `pve_move_vm_disk`
- `pve_list_vm_snapshots`, `pve_create_vm_snapshot`, `pve_get_vm_snapshot_config`, `pve_rollback_vm_snapshot`, `pve_delete_vm_snapshot`
- `pve_backup_vm`
- `pve_get_vm_firewall_options`, `pve_set_vm_firewall_options`, `pve_list_vm_firewall_rules`, `pve_create_vm_firewall_rule`

### LXC Containers
- `pve_list_containers`, `pve_get_container_status`, `pve_get_container_config`
- `pve_create_container`, `pve_update_container_config`, `pve_delete_container`
- `pve_start_container`, `pve_stop_container`, `pve_shutdown_container`, `pve_reboot_container`
- `pve_suspend_container`, `pve_resume_container`
- `pve_clone_container`, `pve_migrate_container`, `pve_convert_container_to_template`
- `pve_resize_container_disk`
- `pve_list_container_snapshots`, `pve_create_container_snapshot`, `pve_rollback_container_snapshot`, `pve_delete_container_snapshot`
- `pve_get_container_firewall_options`, `pve_set_container_firewall_options`, `pve_list_container_firewall_rules`

### Storage
- `pve_list_storage`, `pve_get_storage`, `pve_create_storage`, `pve_update_storage`, `pve_delete_storage`

### Resource Pools
- `pve_list_pools`, `pve_get_pool`, `pve_create_pool`, `pve_update_pool`, `pve_delete_pool`

## Example Usage

Once configured, you can ask Claude things like:

- "List all VMs in my Proxmox cluster"
- "Show the status of node pve1"
- "Create a new Ubuntu VM with 4GB RAM, 2 cores, and a 32GB disk"
- "Start VM 100"
- "Create a snapshot of container 101 named 'before-upgrade'"
- "Migrate VM 102 to node pve2"
- "Show available storage on the cluster"
- "List backup jobs"
- "Create a new user claude@pve with PVEAdmin role"

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
