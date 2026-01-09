#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment variables
const PROXMOX_HOST = process.env.PROXMOX_HOST || "";
const PROXMOX_TOKEN_ID = process.env.PROXMOX_TOKEN_ID || "";
const PROXMOX_TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET || "";

// Allow self-signed certificates (common for Proxmox)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!PROXMOX_HOST || !PROXMOX_TOKEN_ID || !PROXMOX_TOKEN_SECRET) {
  console.error("Error: PROXMOX_HOST, PROXMOX_TOKEN_ID, and PROXMOX_TOKEN_SECRET environment variables are required");
  process.exit(1);
}

// Helper function to build query string
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && !["node", "vmid", "storage", "pool", "realm", "userid", "groupid", "roleid", "path", "type", "volid", "snapname", "cidr", "iface", "name"].includes(key)) {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

// Helper function to make Proxmox API requests
async function proxmoxRequest(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${PROXMOX_HOST}/api2/json${endpoint}`;

  const headers: Record<string, string> = {
    "Authorization": `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`,
  };

  let requestBody: string | undefined;
  if (body && (method === "POST" || method === "PUT")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    requestBody = formData.toString();
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxmox API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { data: unknown };
  return data.data;
}

// Create the MCP server
const server = new Server(
  {
    name: "proxmox-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions organized by category
const tools = [
  // ============================================
  // VERSION
  // ============================================
  {
    name: "pve_version",
    description: "Get Proxmox VE API version information",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ============================================
  // ACCESS - Authentication & Authorization
  // ============================================
  {
    name: "pve_list_users",
    description: "List all users",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "Filter by enabled status" },
        full: { type: "boolean", description: "Include group and token info" },
      },
      required: [],
    },
  },
  {
    name: "pve_get_user",
    description: "Get user configuration",
    inputSchema: {
      type: "object",
      properties: {
        userid: { type: "string", description: "User ID (format: user@realm)" },
      },
      required: ["userid"],
    },
  },
  {
    name: "pve_create_user",
    description: "Create a new user",
    inputSchema: {
      type: "object",
      properties: {
        userid: { type: "string", description: "User ID (format: user@realm)" },
        password: { type: "string", description: "Initial password" },
        email: { type: "string", description: "Email address" },
        firstname: { type: "string", description: "First name" },
        lastname: { type: "string", description: "Last name" },
        groups: { type: "string", description: "Comma-separated list of groups" },
        expire: { type: "number", description: "Account expiration date (Unix epoch)" },
        enable: { type: "boolean", description: "Enable the account" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["userid"],
    },
  },
  {
    name: "pve_update_user",
    description: "Update user configuration",
    inputSchema: {
      type: "object",
      properties: {
        userid: { type: "string", description: "User ID (format: user@realm)" },
        email: { type: "string", description: "Email address" },
        firstname: { type: "string", description: "First name" },
        lastname: { type: "string", description: "Last name" },
        groups: { type: "string", description: "Comma-separated list of groups" },
        expire: { type: "number", description: "Account expiration date (Unix epoch)" },
        enable: { type: "boolean", description: "Enable the account" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["userid"],
    },
  },
  {
    name: "pve_delete_user",
    description: "Delete a user",
    inputSchema: {
      type: "object",
      properties: {
        userid: { type: "string", description: "User ID (format: user@realm)" },
      },
      required: ["userid"],
    },
  },
  {
    name: "pve_list_groups",
    description: "List all groups",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_group",
    description: "Get group configuration",
    inputSchema: {
      type: "object",
      properties: {
        groupid: { type: "string", description: "Group ID" },
      },
      required: ["groupid"],
    },
  },
  {
    name: "pve_create_group",
    description: "Create a new group",
    inputSchema: {
      type: "object",
      properties: {
        groupid: { type: "string", description: "Group ID" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["groupid"],
    },
  },
  {
    name: "pve_update_group",
    description: "Update group configuration",
    inputSchema: {
      type: "object",
      properties: {
        groupid: { type: "string", description: "Group ID" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["groupid"],
    },
  },
  {
    name: "pve_delete_group",
    description: "Delete a group",
    inputSchema: {
      type: "object",
      properties: {
        groupid: { type: "string", description: "Group ID" },
      },
      required: ["groupid"],
    },
  },
  {
    name: "pve_list_roles",
    description: "List all roles",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_role",
    description: "Get role configuration",
    inputSchema: {
      type: "object",
      properties: {
        roleid: { type: "string", description: "Role ID" },
      },
      required: ["roleid"],
    },
  },
  {
    name: "pve_create_role",
    description: "Create a new role",
    inputSchema: {
      type: "object",
      properties: {
        roleid: { type: "string", description: "Role ID" },
        privs: { type: "string", description: "Comma-separated list of privileges" },
      },
      required: ["roleid"],
    },
  },
  {
    name: "pve_update_role",
    description: "Update role configuration",
    inputSchema: {
      type: "object",
      properties: {
        roleid: { type: "string", description: "Role ID" },
        privs: { type: "string", description: "Comma-separated list of privileges" },
        append: { type: "boolean", description: "Append privileges instead of replacing" },
      },
      required: ["roleid"],
    },
  },
  {
    name: "pve_delete_role",
    description: "Delete a role",
    inputSchema: {
      type: "object",
      properties: {
        roleid: { type: "string", description: "Role ID" },
      },
      required: ["roleid"],
    },
  },
  {
    name: "pve_get_acl",
    description: "Get Access Control List",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_update_acl",
    description: "Update Access Control List",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Access control path (e.g., /vms/100)" },
        roles: { type: "string", description: "Comma-separated list of roles" },
        users: { type: "string", description: "Comma-separated list of users" },
        groups: { type: "string", description: "Comma-separated list of groups" },
        propagate: { type: "boolean", description: "Allow propagation to child paths" },
        delete: { type: "boolean", description: "Remove permissions instead of adding" },
      },
      required: ["path", "roles"],
    },
  },
  {
    name: "pve_list_domains",
    description: "List authentication domains/realms",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_domain",
    description: "Get authentication domain configuration",
    inputSchema: {
      type: "object",
      properties: {
        realm: { type: "string", description: "Authentication realm" },
      },
      required: ["realm"],
    },
  },

  // ============================================
  // CLUSTER
  // ============================================
  {
    name: "pve_cluster_status",
    description: "Get cluster status information",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_cluster_resources",
    description: "List all cluster resources (VMs, containers, storage, nodes)",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["vm", "storage", "node", "sdn"], description: "Filter by resource type" },
      },
      required: [],
    },
  },
  {
    name: "pve_cluster_tasks",
    description: "List recent cluster tasks",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_cluster_options",
    description: "Get cluster options",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_cluster_set_options",
    description: "Set cluster options",
    inputSchema: {
      type: "object",
      properties: {
        keyboard: { type: "string", description: "Default keyboard layout" },
        language: { type: "string", description: "Default GUI language" },
        max_workers: { type: "number", description: "Max parallel workers" },
        migration_unsecure: { type: "boolean", description: "Allow insecure migration" },
        console: { type: "string", enum: ["applet", "vv", "html5", "xtermjs"], description: "Default console viewer" },
      },
      required: [],
    },
  },
  {
    name: "pve_cluster_nextid",
    description: "Get next free VMID",
    inputSchema: {
      type: "object",
      properties: {
        vmid: { type: "number", description: "Check if specific VMID is available" },
      },
      required: [],
    },
  },
  {
    name: "pve_cluster_log",
    description: "Read cluster log",
    inputSchema: {
      type: "object",
      properties: {
        max: { type: "number", description: "Maximum entries to return" },
      },
      required: [],
    },
  },

  // ============================================
  // CLUSTER - Backup
  // ============================================
  {
    name: "pve_list_backup_jobs",
    description: "List all backup jobs",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_backup_job",
    description: "Get backup job configuration",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Backup job ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "pve_create_backup_job",
    description: "Create a new backup job",
    inputSchema: {
      type: "object",
      properties: {
        starttime: { type: "string", description: "Start time (HH:MM)" },
        dow: { type: "string", description: "Days of week (mon,tue,wed,thu,fri,sat,sun)" },
        storage: { type: "string", description: "Storage ID for backups" },
        mode: { type: "string", enum: ["snapshot", "suspend", "stop"], description: "Backup mode" },
        vmid: { type: "string", description: "VM IDs to backup (comma-separated)" },
        all: { type: "boolean", description: "Backup all VMs" },
        exclude: { type: "string", description: "Exclude VM IDs" },
        compress: { type: "string", enum: ["0", "1", "gzip", "lzo", "zstd"], description: "Compression type" },
        mailnotification: { type: "string", enum: ["always", "failure"], description: "Email notification" },
        mailto: { type: "string", description: "Email recipients" },
        enabled: { type: "boolean", description: "Enable job" },
      },
      required: ["starttime", "storage"],
    },
  },
  {
    name: "pve_update_backup_job",
    description: "Update a backup job",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Backup job ID" },
        starttime: { type: "string", description: "Start time (HH:MM)" },
        dow: { type: "string", description: "Days of week" },
        storage: { type: "string", description: "Storage ID" },
        mode: { type: "string", enum: ["snapshot", "suspend", "stop"], description: "Backup mode" },
        vmid: { type: "string", description: "VM IDs to backup" },
        enabled: { type: "boolean", description: "Enable job" },
      },
      required: ["id"],
    },
  },
  {
    name: "pve_delete_backup_job",
    description: "Delete a backup job",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Backup job ID" },
      },
      required: ["id"],
    },
  },

  // ============================================
  // CLUSTER - HA (High Availability)
  // ============================================
  {
    name: "pve_ha_status",
    description: "Get HA cluster status",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_list_ha_resources",
    description: "List HA resources",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["ct", "vm"], description: "Filter by type" },
      },
      required: [],
    },
  },
  {
    name: "pve_get_ha_resource",
    description: "Get HA resource configuration",
    inputSchema: {
      type: "object",
      properties: {
        sid: { type: "string", description: "HA resource ID (e.g., vm:100)" },
      },
      required: ["sid"],
    },
  },
  {
    name: "pve_create_ha_resource",
    description: "Create HA resource",
    inputSchema: {
      type: "object",
      properties: {
        sid: { type: "string", description: "HA resource ID (e.g., vm:100)" },
        group: { type: "string", description: "HA group" },
        state: { type: "string", enum: ["started", "stopped", "enabled", "disabled", "ignored"], description: "Requested state" },
        max_relocate: { type: "number", description: "Max relocations" },
        max_restart: { type: "number", description: "Max restarts" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["sid"],
    },
  },
  {
    name: "pve_update_ha_resource",
    description: "Update HA resource",
    inputSchema: {
      type: "object",
      properties: {
        sid: { type: "string", description: "HA resource ID" },
        group: { type: "string", description: "HA group" },
        state: { type: "string", enum: ["started", "stopped", "enabled", "disabled", "ignored"], description: "Requested state" },
        max_relocate: { type: "number", description: "Max relocations" },
        max_restart: { type: "number", description: "Max restarts" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["sid"],
    },
  },
  {
    name: "pve_delete_ha_resource",
    description: "Delete HA resource",
    inputSchema: {
      type: "object",
      properties: {
        sid: { type: "string", description: "HA resource ID" },
      },
      required: ["sid"],
    },
  },
  {
    name: "pve_list_ha_groups",
    description: "List HA groups",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_ha_group",
    description: "Get HA group configuration",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "HA group ID" },
      },
      required: ["group"],
    },
  },
  {
    name: "pve_create_ha_group",
    description: "Create HA group",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "HA group ID" },
        nodes: { type: "string", description: "Node list (node1:priority,node2:priority)" },
        restricted: { type: "boolean", description: "Restrict to listed nodes" },
        nofailback: { type: "boolean", description: "Disable failback" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["group", "nodes"],
    },
  },
  {
    name: "pve_update_ha_group",
    description: "Update HA group",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "HA group ID" },
        nodes: { type: "string", description: "Node list" },
        restricted: { type: "boolean", description: "Restrict to listed nodes" },
        nofailback: { type: "boolean", description: "Disable failback" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["group"],
    },
  },
  {
    name: "pve_delete_ha_group",
    description: "Delete HA group",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "HA group ID" },
      },
      required: ["group"],
    },
  },

  // ============================================
  // CLUSTER - Firewall
  // ============================================
  {
    name: "pve_cluster_firewall_options",
    description: "Get cluster firewall options",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_set_cluster_firewall_options",
    description: "Set cluster firewall options",
    inputSchema: {
      type: "object",
      properties: {
        enable: { type: "boolean", description: "Enable firewall cluster-wide" },
        policy_in: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Input policy" },
        policy_out: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Output policy" },
        log_ratelimit: { type: "string", description: "Log rate limit" },
      },
      required: [],
    },
  },
  {
    name: "pve_list_cluster_firewall_rules",
    description: "List cluster firewall rules",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_create_cluster_firewall_rule",
    description: "Create cluster firewall rule",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Rule action (ACCEPT, DROP, REJECT)" },
        type: { type: "string", enum: ["in", "out", "group"], description: "Rule type" },
        enable: { type: "boolean", description: "Enable rule" },
        source: { type: "string", description: "Source address" },
        dest: { type: "string", description: "Destination address" },
        sport: { type: "string", description: "Source port" },
        dport: { type: "string", description: "Destination port" },
        proto: { type: "string", description: "Protocol" },
        comment: { type: "string", description: "Comment" },
        pos: { type: "number", description: "Position in ruleset" },
      },
      required: ["action", "type"],
    },
  },
  {
    name: "pve_list_security_groups",
    description: "List firewall security groups",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_create_security_group",
    description: "Create firewall security group",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Security group name" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["group"],
    },
  },
  {
    name: "pve_list_ipsets",
    description: "List cluster IP sets",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_create_ipset",
    description: "Create cluster IP set",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "IP set name" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["name"],
    },
  },
  {
    name: "pve_list_firewall_aliases",
    description: "List firewall aliases",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_create_firewall_alias",
    description: "Create firewall alias",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Alias name" },
        cidr: { type: "string", description: "IP/Network in CIDR notation" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["name", "cidr"],
    },
  },

  // ============================================
  // CLUSTER - Replication
  // ============================================
  {
    name: "pve_list_replication_jobs",
    description: "List replication jobs",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_replication_job",
    description: "Get replication job configuration",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Replication job ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "pve_create_replication_job",
    description: "Create replication job",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Replication job ID (e.g., 100-0)" },
        target: { type: "string", description: "Target node" },
        type: { type: "string", enum: ["local"], description: "Replication type" },
        schedule: { type: "string", description: "Schedule (cron format)" },
        rate: { type: "number", description: "Rate limit in MB/s" },
        comment: { type: "string", description: "Comment" },
        disable: { type: "boolean", description: "Disable job" },
      },
      required: ["id", "target", "type"],
    },
  },
  {
    name: "pve_delete_replication_job",
    description: "Delete replication job",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Replication job ID" },
      },
      required: ["id"],
    },
  },

  // ============================================
  // NODES
  // ============================================
  {
    name: "pve_list_nodes",
    description: "List all cluster nodes",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_node_status",
    description: "Get node status and statistics",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_version",
    description: "Get node version information",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_time",
    description: "Get node time and timezone",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_set_node_time",
    description: "Set node timezone",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        timezone: { type: "string", description: "Timezone (e.g., Europe/London)" },
      },
      required: ["node", "timezone"],
    },
  },
  {
    name: "pve_get_node_dns",
    description: "Get node DNS configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_set_node_dns",
    description: "Set node DNS configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        search: { type: "string", description: "Search domain" },
        dns1: { type: "string", description: "Primary DNS server" },
        dns2: { type: "string", description: "Secondary DNS server" },
        dns3: { type: "string", description: "Tertiary DNS server" },
      },
      required: ["node", "search"],
    },
  },
  {
    name: "pve_get_node_syslog",
    description: "Read node system log",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        start: { type: "number", description: "Start line number" },
        limit: { type: "number", description: "Max lines to return" },
        since: { type: "string", description: "Filter since date" },
        until: { type: "string", description: "Filter until date" },
        service: { type: "string", description: "Filter by service" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_journal",
    description: "Read node journal",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        since: { type: "string", description: "Filter since (Unix epoch or date)" },
        until: { type: "string", description: "Filter until" },
        lastentries: { type: "number", description: "Number of entries" },
        service: { type: "string", description: "Filter by service" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_subscription",
    description: "Get node subscription status",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_report",
    description: "Generate node diagnostic report",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_node_start_all",
    description: "Start all VMs and containers on node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vms: { type: "string", description: "Specific VMIDs to start (comma-separated)" },
        force: { type: "boolean", description: "Force start" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_node_stop_all",
    description: "Stop all VMs and containers on node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vms: { type: "string", description: "Specific VMIDs to stop (comma-separated)" },
        force_stop: { type: "boolean", description: "Force stop (kill)" },
        timeout: { type: "number", description: "Timeout in seconds" },
      },
      required: ["node"],
    },
  },

  // ============================================
  // NODE - Services
  // ============================================
  {
    name: "pve_list_node_services",
    description: "List node services",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_service_state",
    description: "Get service state",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        service: { type: "string", description: "Service name" },
      },
      required: ["node", "service"],
    },
  },
  {
    name: "pve_node_service_start",
    description: "Start a service",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        service: { type: "string", description: "Service name" },
      },
      required: ["node", "service"],
    },
  },
  {
    name: "pve_node_service_stop",
    description: "Stop a service",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        service: { type: "string", description: "Service name" },
      },
      required: ["node", "service"],
    },
  },
  {
    name: "pve_node_service_restart",
    description: "Restart a service",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        service: { type: "string", description: "Service name" },
      },
      required: ["node", "service"],
    },
  },
  {
    name: "pve_node_service_reload",
    description: "Reload a service",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        service: { type: "string", description: "Service name" },
      },
      required: ["node", "service"],
    },
  },

  // ============================================
  // NODE - Network
  // ============================================
  {
    name: "pve_list_node_networks",
    description: "List node network interfaces",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        type: { type: "string", enum: ["bridge", "bond", "eth", "alias", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort", "any_bridge", "any_local_bridge"], description: "Filter by type" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_network",
    description: "Get network interface configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        iface: { type: "string", description: "Interface name" },
      },
      required: ["node", "iface"],
    },
  },
  {
    name: "pve_create_node_network",
    description: "Create network interface",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        iface: { type: "string", description: "Interface name" },
        type: { type: "string", enum: ["bridge", "bond", "eth", "alias", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort"], description: "Interface type" },
        address: { type: "string", description: "IP address" },
        netmask: { type: "string", description: "Netmask" },
        gateway: { type: "string", description: "Gateway" },
        bridge_ports: { type: "string", description: "Bridge ports" },
        bridge_vlan_aware: { type: "boolean", description: "VLAN aware bridge" },
        bond_mode: { type: "string", enum: ["balance-rr", "active-backup", "balance-xor", "broadcast", "802.3ad", "balance-tlb", "balance-alb", "balance-slb", "lacp-balance-slb", "lacp-balance-tcp"], description: "Bond mode" },
        slaves: { type: "string", description: "Bond slaves" },
        autostart: { type: "boolean", description: "Auto start at boot" },
        comments: { type: "string", description: "Comments" },
      },
      required: ["node", "iface", "type"],
    },
  },
  {
    name: "pve_update_node_network",
    description: "Update network interface",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        iface: { type: "string", description: "Interface name" },
        type: { type: "string", description: "Interface type" },
        address: { type: "string", description: "IP address" },
        netmask: { type: "string", description: "Netmask" },
        gateway: { type: "string", description: "Gateway" },
        bridge_ports: { type: "string", description: "Bridge ports" },
        autostart: { type: "boolean", description: "Auto start" },
        comments: { type: "string", description: "Comments" },
      },
      required: ["node", "iface", "type"],
    },
  },
  {
    name: "pve_delete_node_network",
    description: "Delete network interface",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        iface: { type: "string", description: "Interface name" },
      },
      required: ["node", "iface"],
    },
  },
  {
    name: "pve_apply_node_network",
    description: "Apply network changes (reload config)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_revert_node_network",
    description: "Revert pending network changes",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },

  // ============================================
  // NODE - Tasks
  // ============================================
  {
    name: "pve_list_node_tasks",
    description: "List node tasks",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Filter by VMID" },
        start: { type: "number", description: "Start index" },
        limit: { type: "number", description: "Max tasks to return" },
        userfilter: { type: "string", description: "Filter by user" },
        typefilter: { type: "string", description: "Filter by type" },
        errors: { type: "boolean", description: "Only show errors" },
        source: { type: "string", enum: ["archive", "active", "all"], description: "Task source" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_task_status",
    description: "Get task status",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        upid: { type: "string", description: "Task UPID" },
      },
      required: ["node", "upid"],
    },
  },
  {
    name: "pve_get_node_task_log",
    description: "Get task log",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        upid: { type: "string", description: "Task UPID" },
        start: { type: "number", description: "Start line" },
        limit: { type: "number", description: "Max lines" },
      },
      required: ["node", "upid"],
    },
  },
  {
    name: "pve_stop_node_task",
    description: "Stop a running task",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        upid: { type: "string", description: "Task UPID" },
      },
      required: ["node", "upid"],
    },
  },

  // ============================================
  // NODE - Storage
  // ============================================
  {
    name: "pve_list_node_storage",
    description: "List node storage",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        content: { type: "string", description: "Filter by content type (images, rootdir, vztmpl, backup, iso, snippets)" },
        storage: { type: "string", description: "Filter by storage ID" },
        enabled: { type: "boolean", description: "Only show enabled storage" },
        target: { type: "string", description: "Filter by target node" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_storage_status",
    description: "Get storage status",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        storage: { type: "string", description: "Storage ID" },
      },
      required: ["node", "storage"],
    },
  },
  {
    name: "pve_list_node_storage_content",
    description: "List storage content",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        storage: { type: "string", description: "Storage ID" },
        content: { type: "string", description: "Filter by content type" },
        vmid: { type: "number", description: "Filter by VMID" },
      },
      required: ["node", "storage"],
    },
  },
  {
    name: "pve_upload_to_storage",
    description: "Upload ISO or template to storage (returns upload URL info)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        storage: { type: "string", description: "Storage ID" },
        content: { type: "string", enum: ["iso", "vztmpl"], description: "Content type" },
        filename: { type: "string", description: "Filename" },
      },
      required: ["node", "storage", "content", "filename"],
    },
  },
  {
    name: "pve_download_url_to_storage",
    description: "Download file from URL to storage",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        storage: { type: "string", description: "Storage ID" },
        content: { type: "string", enum: ["iso", "vztmpl"], description: "Content type" },
        filename: { type: "string", description: "Target filename" },
        url: { type: "string", description: "URL to download from" },
        checksum: { type: "string", description: "Expected checksum" },
        "checksum-algorithm": { type: "string", enum: ["md5", "sha1", "sha224", "sha256", "sha384", "sha512"], description: "Checksum algorithm" },
      },
      required: ["node", "storage", "content", "filename", "url"],
    },
  },
  {
    name: "pve_delete_storage_content",
    description: "Delete storage content (volume)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        storage: { type: "string", description: "Storage ID" },
        volume: { type: "string", description: "Volume ID" },
      },
      required: ["node", "storage", "volume"],
    },
  },

  // ============================================
  // NODE - Disks
  // ============================================
  {
    name: "pve_list_node_disks",
    description: "List node disks",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        skipsmart: { type: "boolean", description: "Skip SMART data" },
        include_partitions: { type: "boolean", description: "Include partitions" },
        type: { type: "string", enum: ["unused", "journal_disks"], description: "Filter by type" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_disk_smart",
    description: "Get disk SMART data",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        disk: { type: "string", description: "Disk device path (e.g., /dev/sda)" },
        healthonly: { type: "boolean", description: "Only return health status" },
      },
      required: ["node", "disk"],
    },
  },
  {
    name: "pve_initialize_disk_gpt",
    description: "Initialize disk with GPT partition table",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        disk: { type: "string", description: "Disk device path" },
        uuid: { type: "string", description: "UUID for GPT table" },
      },
      required: ["node", "disk"],
    },
  },
  {
    name: "pve_wipe_disk",
    description: "Wipe disk partition table",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        disk: { type: "string", description: "Disk device path" },
      },
      required: ["node", "disk"],
    },
  },

  // ============================================
  // NODE - Certificates
  // ============================================
  {
    name: "pve_list_node_certificates",
    description: "List node certificates",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_node_acme",
    description: "Get node ACME account info",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_order_node_certificate",
    description: "Order new ACME certificate",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        force: { type: "boolean", description: "Force renewal" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_renew_node_certificate",
    description: "Renew ACME certificate",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        force: { type: "boolean", description: "Force renewal" },
      },
      required: ["node"],
    },
  },

  // ============================================
  // NODE - APT
  // ============================================
  {
    name: "pve_list_apt_updates",
    description: "List available package updates",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_apt_update",
    description: "Refresh package index",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        notify: { type: "boolean", description: "Send notification mail" },
        quiet: { type: "boolean", description: "Quiet mode" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_apt_changelog",
    description: "Get package changelog",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        name: { type: "string", description: "Package name" },
      },
      required: ["node", "name"],
    },
  },
  {
    name: "pve_apt_versions",
    description: "Get package versions",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },

  // ============================================
  // QEMU - Virtual Machines
  // ============================================
  {
    name: "pve_list_vms",
    description: "List all VMs on a node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        full: { type: "boolean", description: "Include full status details" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_vm_status",
    description: "Get VM status and configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_get_vm_config",
    description: "Get VM configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        current: { type: "boolean", description: "Get current values (including pending changes)" },
        snapshot: { type: "string", description: "Get config from snapshot" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_create_vm",
    description: "Create a new virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        name: { type: "string", description: "VM name" },
        memory: { type: "number", description: "Memory in MB" },
        cores: { type: "number", description: "CPU cores" },
        sockets: { type: "number", description: "CPU sockets" },
        cpu: { type: "string", description: "CPU type" },
        ostype: { type: "string", enum: ["other", "wxp", "w2k", "w2k3", "w2k8", "wvista", "win7", "win8", "win10", "win11", "l24", "l26", "solaris"], description: "OS type" },
        scsihw: { type: "string", enum: ["lsi", "lsi53c810", "virtio-scsi-pci", "virtio-scsi-single", "megasas", "pvscsi"], description: "SCSI hardware type" },
        bios: { type: "string", enum: ["seabios", "ovmf"], description: "BIOS type" },
        boot: { type: "string", description: "Boot order" },
        cdrom: { type: "string", description: "CD-ROM (ISO path)" },
        ide0: { type: "string", description: "IDE disk 0" },
        ide1: { type: "string", description: "IDE disk 1" },
        ide2: { type: "string", description: "IDE disk 2" },
        ide3: { type: "string", description: "IDE disk 3" },
        scsi0: { type: "string", description: "SCSI disk 0" },
        virtio0: { type: "string", description: "VirtIO disk 0" },
        net0: { type: "string", description: "Network device 0" },
        serial0: { type: "string", description: "Serial port 0" },
        agent: { type: "string", description: "QEMU guest agent (1 to enable)" },
        start: { type: "boolean", description: "Start after creation" },
        pool: { type: "string", description: "Resource pool" },
        storage: { type: "string", description: "Default storage" },
        description: { type: "string", description: "VM description" },
        onboot: { type: "boolean", description: "Start on boot" },
        startup: { type: "string", description: "Startup order" },
        protection: { type: "boolean", description: "Protection from deletion" },
        tags: { type: "string", description: "Tags (semicolon-separated)" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_update_vm_config",
    description: "Update VM configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        name: { type: "string", description: "VM name" },
        memory: { type: "number", description: "Memory in MB" },
        cores: { type: "number", description: "CPU cores" },
        sockets: { type: "number", description: "CPU sockets" },
        cpu: { type: "string", description: "CPU type" },
        ostype: { type: "string", description: "OS type" },
        boot: { type: "string", description: "Boot order" },
        cdrom: { type: "string", description: "CD-ROM" },
        net0: { type: "string", description: "Network device 0" },
        agent: { type: "string", description: "QEMU guest agent" },
        description: { type: "string", description: "Description" },
        onboot: { type: "boolean", description: "Start on boot" },
        protection: { type: "boolean", description: "Protection" },
        tags: { type: "string", description: "Tags" },
        delete: { type: "string", description: "Settings to delete (comma-separated)" },
        revert: { type: "string", description: "Revert pending changes" },
        digest: { type: "string", description: "Config digest for conflict detection" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_delete_vm",
    description: "Delete a virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        purge: { type: "boolean", description: "Remove from all related configs (HA, backup jobs, etc.)" },
        "destroy-unreferenced-disks": { type: "boolean", description: "Destroy unreferenced disks" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_start_vm",
    description: "Start a virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
        machine: { type: "string", description: "Machine type override" },
        migratedfrom: { type: "string", description: "Migrated from node" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_stop_vm",
    description: "Stop a virtual machine (force)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
        keepActive: { type: "boolean", description: "Keep storage volumes active" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_shutdown_vm",
    description: "Shutdown a virtual machine (graceful via ACPI)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
        forceStop: { type: "boolean", description: "Force stop after timeout" },
        keepActive: { type: "boolean", description: "Keep storage volumes active" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_reboot_vm",
    description: "Reboot a virtual machine (via ACPI)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_reset_vm",
    description: "Reset a virtual machine (hard reset)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_suspend_vm",
    description: "Suspend a virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        todisk: { type: "boolean", description: "Suspend to disk (hibernate)" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_resume_vm",
    description: "Resume a suspended virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        nocheck: { type: "boolean", description: "Skip state check" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_clone_vm",
    description: "Clone a virtual machine",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Source node name" },
        vmid: { type: "number", description: "Source VM ID" },
        newid: { type: "number", description: "New VM ID" },
        name: { type: "string", description: "New VM name" },
        target: { type: "string", description: "Target node" },
        full: { type: "boolean", description: "Full clone (not linked)" },
        storage: { type: "string", description: "Target storage" },
        format: { type: "string", enum: ["raw", "qcow2", "vmdk"], description: "Target format" },
        pool: { type: "string", description: "Resource pool" },
        snapname: { type: "string", description: "Snapshot to clone from" },
        description: { type: "string", description: "Description" },
      },
      required: ["node", "vmid", "newid"],
    },
  },
  {
    name: "pve_migrate_vm",
    description: "Migrate VM to another node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Source node name" },
        vmid: { type: "number", description: "VM ID" },
        target: { type: "string", description: "Target node" },
        online: { type: "boolean", description: "Online migration (live)" },
        force: { type: "boolean", description: "Force migration" },
        "with-local-disks": { type: "boolean", description: "Migrate local disks" },
        targetstorage: { type: "string", description: "Target storage mapping" },
        bwlimit: { type: "number", description: "Bandwidth limit in KB/s" },
      },
      required: ["node", "vmid", "target"],
    },
  },
  {
    name: "pve_resize_vm_disk",
    description: "Resize VM disk",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        disk: { type: "string", description: "Disk name (e.g., scsi0, virtio0)" },
        size: { type: "string", description: "New size (e.g., +10G, 50G)" },
        digest: { type: "string", description: "Config digest" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid", "disk", "size"],
    },
  },
  {
    name: "pve_move_vm_disk",
    description: "Move VM disk to different storage",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        disk: { type: "string", description: "Disk name" },
        storage: { type: "string", description: "Target storage" },
        format: { type: "string", enum: ["raw", "qcow2", "vmdk"], description: "Target format" },
        delete: { type: "boolean", description: "Delete source after move" },
        digest: { type: "string", description: "Config digest" },
      },
      required: ["node", "vmid", "disk", "storage"],
    },
  },
  {
    name: "pve_convert_vm_to_template",
    description: "Convert VM to template",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        disk: { type: "string", description: "Base image disk (if multiple)" },
      },
      required: ["node", "vmid"],
    },
  },

  // ============================================
  // QEMU - Snapshots
  // ============================================
  {
    name: "pve_list_vm_snapshots",
    description: "List VM snapshots",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_create_vm_snapshot",
    description: "Create VM snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        snapname: { type: "string", description: "Snapshot name" },
        description: { type: "string", description: "Description" },
        vmstate: { type: "boolean", description: "Include VM state (RAM)" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },
  {
    name: "pve_get_vm_snapshot_config",
    description: "Get snapshot configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        snapname: { type: "string", description: "Snapshot name" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },
  {
    name: "pve_rollback_vm_snapshot",
    description: "Rollback VM to snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        snapname: { type: "string", description: "Snapshot name" },
        start: { type: "boolean", description: "Start VM after rollback" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },
  {
    name: "pve_delete_vm_snapshot",
    description: "Delete VM snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        snapname: { type: "string", description: "Snapshot name" },
        force: { type: "boolean", description: "Force deletion" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },

  // ============================================
  // QEMU - Backup
  // ============================================
  {
    name: "pve_backup_vm",
    description: "Backup a VM",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        storage: { type: "string", description: "Target storage" },
        mode: { type: "string", enum: ["snapshot", "suspend", "stop"], description: "Backup mode" },
        compress: { type: "string", enum: ["0", "1", "gzip", "lzo", "zstd"], description: "Compression" },
        remove: { type: "boolean", description: "Remove old backups" },
        notes: { type: "string", description: "Backup notes" },
      },
      required: ["node", "vmid", "storage"],
    },
  },

  // ============================================
  // QEMU - Firewall
  // ============================================
  {
    name: "pve_get_vm_firewall_options",
    description: "Get VM firewall options",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_set_vm_firewall_options",
    description: "Set VM firewall options",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        enable: { type: "boolean", description: "Enable firewall" },
        dhcp: { type: "boolean", description: "Allow DHCP" },
        macfilter: { type: "boolean", description: "Enable MAC filter" },
        policy_in: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Input policy" },
        policy_out: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Output policy" },
        log_level_in: { type: "string", enum: ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug", "nolog"], description: "Input log level" },
        log_level_out: { type: "string", enum: ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug", "nolog"], description: "Output log level" },
        ipfilter: { type: "boolean", description: "Enable IP filter" },
        ndp: { type: "boolean", description: "Allow NDP" },
        radv: { type: "boolean", description: "Allow router advertisement" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_list_vm_firewall_rules",
    description: "List VM firewall rules",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_create_vm_firewall_rule",
    description: "Create VM firewall rule",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "VM ID" },
        action: { type: "string", description: "Rule action (ACCEPT, DROP, REJECT)" },
        type: { type: "string", enum: ["in", "out", "group"], description: "Rule type" },
        enable: { type: "boolean", description: "Enable rule" },
        source: { type: "string", description: "Source address" },
        dest: { type: "string", description: "Destination address" },
        sport: { type: "string", description: "Source port" },
        dport: { type: "string", description: "Destination port" },
        proto: { type: "string", description: "Protocol" },
        iface: { type: "string", description: "Interface" },
        comment: { type: "string", description: "Comment" },
        pos: { type: "number", description: "Position" },
      },
      required: ["node", "vmid", "action", "type"],
    },
  },

  // ============================================
  // LXC - Containers
  // ============================================
  {
    name: "pve_list_containers",
    description: "List all LXC containers on a node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
      },
      required: ["node"],
    },
  },
  {
    name: "pve_get_container_status",
    description: "Get container status",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_get_container_config",
    description: "Get container configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        current: { type: "boolean", description: "Get current values" },
        snapshot: { type: "string", description: "Get config from snapshot" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_create_container",
    description: "Create a new LXC container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        ostemplate: { type: "string", description: "OS template (e.g., local:vztmpl/ubuntu-22.04.tar.zst)" },
        hostname: { type: "string", description: "Hostname" },
        password: { type: "string", description: "Root password" },
        storage: { type: "string", description: "Root storage" },
        rootfs: { type: "string", description: "Root filesystem config" },
        memory: { type: "number", description: "Memory in MB" },
        swap: { type: "number", description: "Swap in MB" },
        cores: { type: "number", description: "CPU cores" },
        cpulimit: { type: "number", description: "CPU limit (0-128)" },
        cpuunits: { type: "number", description: "CPU weight" },
        net0: { type: "string", description: "Network device 0" },
        mp0: { type: "string", description: "Mount point 0" },
        features: { type: "string", description: "Features (nesting=1, etc.)" },
        unprivileged: { type: "boolean", description: "Unprivileged container" },
        onboot: { type: "boolean", description: "Start on boot" },
        startup: { type: "string", description: "Startup order" },
        protection: { type: "boolean", description: "Protection" },
        pool: { type: "string", description: "Resource pool" },
        description: { type: "string", description: "Description" },
        tags: { type: "string", description: "Tags" },
        "ssh-public-keys": { type: "string", description: "SSH public keys" },
        start: { type: "boolean", description: "Start after creation" },
      },
      required: ["node", "vmid", "ostemplate"],
    },
  },
  {
    name: "pve_update_container_config",
    description: "Update container configuration",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        hostname: { type: "string", description: "Hostname" },
        memory: { type: "number", description: "Memory in MB" },
        swap: { type: "number", description: "Swap in MB" },
        cores: { type: "number", description: "CPU cores" },
        cpulimit: { type: "number", description: "CPU limit" },
        cpuunits: { type: "number", description: "CPU weight" },
        net0: { type: "string", description: "Network device 0" },
        features: { type: "string", description: "Features" },
        onboot: { type: "boolean", description: "Start on boot" },
        protection: { type: "boolean", description: "Protection" },
        description: { type: "string", description: "Description" },
        tags: { type: "string", description: "Tags" },
        delete: { type: "string", description: "Settings to delete" },
        digest: { type: "string", description: "Config digest" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_delete_container",
    description: "Delete a container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        purge: { type: "boolean", description: "Remove from related configs" },
        "destroy-unreferenced-disks": { type: "boolean", description: "Destroy unreferenced disks" },
        force: { type: "boolean", description: "Force destroy" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_start_container",
    description: "Start a container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_stop_container",
    description: "Stop a container (force)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        skiplock: { type: "boolean", description: "Skip lock check" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_shutdown_container",
    description: "Shutdown a container (graceful)",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
        forceStop: { type: "boolean", description: "Force stop after timeout" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_reboot_container",
    description: "Reboot a container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        timeout: { type: "number", description: "Timeout in seconds" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_suspend_container",
    description: "Suspend a container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_resume_container",
    description: "Resume a suspended container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_clone_container",
    description: "Clone a container",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Source node name" },
        vmid: { type: "number", description: "Source container ID" },
        newid: { type: "number", description: "New container ID" },
        hostname: { type: "string", description: "New hostname" },
        target: { type: "string", description: "Target node" },
        full: { type: "boolean", description: "Full clone" },
        storage: { type: "string", description: "Target storage" },
        pool: { type: "string", description: "Resource pool" },
        snapname: { type: "string", description: "Snapshot to clone from" },
        description: { type: "string", description: "Description" },
      },
      required: ["node", "vmid", "newid"],
    },
  },
  {
    name: "pve_migrate_container",
    description: "Migrate container to another node",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Source node name" },
        vmid: { type: "number", description: "Container ID" },
        target: { type: "string", description: "Target node" },
        online: { type: "boolean", description: "Online migration" },
        restart: { type: "boolean", description: "Restart after migrate" },
        force: { type: "boolean", description: "Force migration" },
        targetstorage: { type: "string", description: "Target storage" },
        bwlimit: { type: "number", description: "Bandwidth limit KB/s" },
      },
      required: ["node", "vmid", "target"],
    },
  },
  {
    name: "pve_resize_container_disk",
    description: "Resize container disk",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        disk: { type: "string", description: "Disk name (rootfs, mp0, etc.)" },
        size: { type: "string", description: "New size (e.g., +10G, 50G)" },
        digest: { type: "string", description: "Config digest" },
      },
      required: ["node", "vmid", "disk", "size"],
    },
  },
  {
    name: "pve_convert_container_to_template",
    description: "Convert container to template",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },

  // ============================================
  // LXC - Snapshots
  // ============================================
  {
    name: "pve_list_container_snapshots",
    description: "List container snapshots",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_create_container_snapshot",
    description: "Create container snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        snapname: { type: "string", description: "Snapshot name" },
        description: { type: "string", description: "Description" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },
  {
    name: "pve_rollback_container_snapshot",
    description: "Rollback container to snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        snapname: { type: "string", description: "Snapshot name" },
        start: { type: "boolean", description: "Start after rollback" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },
  {
    name: "pve_delete_container_snapshot",
    description: "Delete container snapshot",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        snapname: { type: "string", description: "Snapshot name" },
        force: { type: "boolean", description: "Force deletion" },
      },
      required: ["node", "vmid", "snapname"],
    },
  },

  // ============================================
  // LXC - Firewall
  // ============================================
  {
    name: "pve_get_container_firewall_options",
    description: "Get container firewall options",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_set_container_firewall_options",
    description: "Set container firewall options",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
        enable: { type: "boolean", description: "Enable firewall" },
        dhcp: { type: "boolean", description: "Allow DHCP" },
        macfilter: { type: "boolean", description: "Enable MAC filter" },
        policy_in: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Input policy" },
        policy_out: { type: "string", enum: ["ACCEPT", "REJECT", "DROP"], description: "Output policy" },
        ipfilter: { type: "boolean", description: "Enable IP filter" },
        ndp: { type: "boolean", description: "Allow NDP" },
        radv: { type: "boolean", description: "Allow router advertisement" },
      },
      required: ["node", "vmid"],
    },
  },
  {
    name: "pve_list_container_firewall_rules",
    description: "List container firewall rules",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "Node name" },
        vmid: { type: "number", description: "Container ID" },
      },
      required: ["node", "vmid"],
    },
  },

  // ============================================
  // STORAGE
  // ============================================
  {
    name: "pve_list_storage",
    description: "List configured storage",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by type" },
      },
      required: [],
    },
  },
  {
    name: "pve_get_storage",
    description: "Get storage configuration",
    inputSchema: {
      type: "object",
      properties: {
        storage: { type: "string", description: "Storage ID" },
      },
      required: ["storage"],
    },
  },
  {
    name: "pve_create_storage",
    description: "Create new storage",
    inputSchema: {
      type: "object",
      properties: {
        storage: { type: "string", description: "Storage ID" },
        type: { type: "string", enum: ["dir", "lvm", "lvmthin", "nfs", "cifs", "glusterfs", "iscsi", "iscsidirect", "rbd", "cephfs", "zfs", "zfspool", "pbs", "btrfs"], description: "Storage type" },
        path: { type: "string", description: "Path (for dir, nfs)" },
        content: { type: "string", description: "Content types (images,rootdir,vztmpl,backup,iso,snippets)" },
        server: { type: "string", description: "Server address (for network storage)" },
        export: { type: "string", description: "NFS export path" },
        share: { type: "string", description: "CIFS share" },
        username: { type: "string", description: "Username" },
        password: { type: "string", description: "Password" },
        pool: { type: "string", description: "Pool name (for RBD, ZFS)" },
        vgname: { type: "string", description: "LVM volume group" },
        thinpool: { type: "string", description: "LVM thin pool" },
        datastore: { type: "string", description: "PBS datastore" },
        fingerprint: { type: "string", description: "PBS fingerprint" },
        nodes: { type: "string", description: "Restrict to nodes (comma-separated)" },
        shared: { type: "boolean", description: "Shared storage" },
        disable: { type: "boolean", description: "Disable storage" },
        maxfiles: { type: "number", description: "Max backup files" },
        "prune-backups": { type: "string", description: "Prune options" },
      },
      required: ["storage", "type"],
    },
  },
  {
    name: "pve_update_storage",
    description: "Update storage configuration",
    inputSchema: {
      type: "object",
      properties: {
        storage: { type: "string", description: "Storage ID" },
        content: { type: "string", description: "Content types" },
        nodes: { type: "string", description: "Restrict to nodes" },
        shared: { type: "boolean", description: "Shared storage" },
        disable: { type: "boolean", description: "Disable storage" },
        maxfiles: { type: "number", description: "Max backup files" },
        "prune-backups": { type: "string", description: "Prune options" },
        delete: { type: "string", description: "Settings to delete" },
        digest: { type: "string", description: "Config digest" },
      },
      required: ["storage"],
    },
  },
  {
    name: "pve_delete_storage",
    description: "Delete storage configuration",
    inputSchema: {
      type: "object",
      properties: {
        storage: { type: "string", description: "Storage ID" },
      },
      required: ["storage"],
    },
  },

  // ============================================
  // POOLS
  // ============================================
  {
    name: "pve_list_pools",
    description: "List resource pools",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pve_get_pool",
    description: "Get pool configuration and members",
    inputSchema: {
      type: "object",
      properties: {
        poolid: { type: "string", description: "Pool ID" },
        type: { type: "string", enum: ["qemu", "lxc", "storage"], description: "Filter by type" },
      },
      required: ["poolid"],
    },
  },
  {
    name: "pve_create_pool",
    description: "Create resource pool",
    inputSchema: {
      type: "object",
      properties: {
        poolid: { type: "string", description: "Pool ID" },
        comment: { type: "string", description: "Comment" },
      },
      required: ["poolid"],
    },
  },
  {
    name: "pve_update_pool",
    description: "Update pool configuration",
    inputSchema: {
      type: "object",
      properties: {
        poolid: { type: "string", description: "Pool ID" },
        comment: { type: "string", description: "Comment" },
        vms: { type: "string", description: "VM IDs to add/remove" },
        storage: { type: "string", description: "Storage IDs to add/remove" },
        delete: { type: "boolean", description: "Remove instead of add" },
      },
      required: ["poolid"],
    },
  },
  {
    name: "pve_delete_pool",
    description: "Delete resource pool",
    inputSchema: {
      type: "object",
      properties: {
        poolid: { type: "string", description: "Pool ID" },
      },
      required: ["poolid"],
    },
  },
];

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = (rawArgs || {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      // VERSION
      case "pve_version":
        result = await proxmoxRequest("/version");
        break;

      // ACCESS - Users
      case "pve_list_users":
        result = await proxmoxRequest(`/access/users${buildQueryString(args)}`);
        break;
      case "pve_get_user":
        result = await proxmoxRequest(`/access/users/${encodeURIComponent(args.userid as string)}`);
        break;
      case "pve_create_user":
        result = await proxmoxRequest(`/access/users`, "POST", args);
        break;
      case "pve_update_user":
        result = await proxmoxRequest(`/access/users/${encodeURIComponent(args.userid as string)}`, "PUT", args);
        break;
      case "pve_delete_user":
        result = await proxmoxRequest(`/access/users/${encodeURIComponent(args.userid as string)}`, "DELETE");
        break;

      // ACCESS - Groups
      case "pve_list_groups":
        result = await proxmoxRequest("/access/groups");
        break;
      case "pve_get_group":
        result = await proxmoxRequest(`/access/groups/${encodeURIComponent(args.groupid as string)}`);
        break;
      case "pve_create_group":
        result = await proxmoxRequest("/access/groups", "POST", args);
        break;
      case "pve_update_group":
        result = await proxmoxRequest(`/access/groups/${encodeURIComponent(args.groupid as string)}`, "PUT", args);
        break;
      case "pve_delete_group":
        result = await proxmoxRequest(`/access/groups/${encodeURIComponent(args.groupid as string)}`, "DELETE");
        break;

      // ACCESS - Roles
      case "pve_list_roles":
        result = await proxmoxRequest("/access/roles");
        break;
      case "pve_get_role":
        result = await proxmoxRequest(`/access/roles/${encodeURIComponent(args.roleid as string)}`);
        break;
      case "pve_create_role":
        result = await proxmoxRequest("/access/roles", "POST", args);
        break;
      case "pve_update_role":
        result = await proxmoxRequest(`/access/roles/${encodeURIComponent(args.roleid as string)}`, "PUT", args);
        break;
      case "pve_delete_role":
        result = await proxmoxRequest(`/access/roles/${encodeURIComponent(args.roleid as string)}`, "DELETE");
        break;

      // ACCESS - ACL
      case "pve_get_acl":
        result = await proxmoxRequest("/access/acl");
        break;
      case "pve_update_acl":
        result = await proxmoxRequest("/access/acl", "PUT", args);
        break;

      // ACCESS - Domains
      case "pve_list_domains":
        result = await proxmoxRequest("/access/domains");
        break;
      case "pve_get_domain":
        result = await proxmoxRequest(`/access/domains/${encodeURIComponent(args.realm as string)}`);
        break;

      // CLUSTER
      case "pve_cluster_status":
        result = await proxmoxRequest("/cluster/status");
        break;
      case "pve_cluster_resources":
        result = await proxmoxRequest(`/cluster/resources${buildQueryString(args)}`);
        break;
      case "pve_cluster_tasks":
        result = await proxmoxRequest("/cluster/tasks");
        break;
      case "pve_cluster_options":
        result = await proxmoxRequest("/cluster/options");
        break;
      case "pve_cluster_set_options":
        result = await proxmoxRequest("/cluster/options", "PUT", args);
        break;
      case "pve_cluster_nextid":
        result = await proxmoxRequest(`/cluster/nextid${buildQueryString(args)}`);
        break;
      case "pve_cluster_log":
        result = await proxmoxRequest(`/cluster/log${buildQueryString(args)}`);
        break;

      // CLUSTER - Backup
      case "pve_list_backup_jobs":
        result = await proxmoxRequest("/cluster/backup");
        break;
      case "pve_get_backup_job":
        result = await proxmoxRequest(`/cluster/backup/${args.id}`);
        break;
      case "pve_create_backup_job":
        result = await proxmoxRequest("/cluster/backup", "POST", args);
        break;
      case "pve_update_backup_job":
        result = await proxmoxRequest(`/cluster/backup/${args.id}`, "PUT", args);
        break;
      case "pve_delete_backup_job":
        result = await proxmoxRequest(`/cluster/backup/${args.id}`, "DELETE");
        break;

      // CLUSTER - HA
      case "pve_ha_status":
        result = await proxmoxRequest("/cluster/ha/status/current");
        break;
      case "pve_list_ha_resources":
        result = await proxmoxRequest(`/cluster/ha/resources${buildQueryString(args)}`);
        break;
      case "pve_get_ha_resource":
        result = await proxmoxRequest(`/cluster/ha/resources/${encodeURIComponent(args.sid as string)}`);
        break;
      case "pve_create_ha_resource":
        result = await proxmoxRequest("/cluster/ha/resources", "POST", args);
        break;
      case "pve_update_ha_resource":
        result = await proxmoxRequest(`/cluster/ha/resources/${encodeURIComponent(args.sid as string)}`, "PUT", args);
        break;
      case "pve_delete_ha_resource":
        result = await proxmoxRequest(`/cluster/ha/resources/${encodeURIComponent(args.sid as string)}`, "DELETE");
        break;
      case "pve_list_ha_groups":
        result = await proxmoxRequest("/cluster/ha/groups");
        break;
      case "pve_get_ha_group":
        result = await proxmoxRequest(`/cluster/ha/groups/${encodeURIComponent(args.group as string)}`);
        break;
      case "pve_create_ha_group":
        result = await proxmoxRequest("/cluster/ha/groups", "POST", args);
        break;
      case "pve_update_ha_group":
        result = await proxmoxRequest(`/cluster/ha/groups/${encodeURIComponent(args.group as string)}`, "PUT", args);
        break;
      case "pve_delete_ha_group":
        result = await proxmoxRequest(`/cluster/ha/groups/${encodeURIComponent(args.group as string)}`, "DELETE");
        break;

      // CLUSTER - Firewall
      case "pve_cluster_firewall_options":
        result = await proxmoxRequest("/cluster/firewall/options");
        break;
      case "pve_set_cluster_firewall_options":
        result = await proxmoxRequest("/cluster/firewall/options", "PUT", args);
        break;
      case "pve_list_cluster_firewall_rules":
        result = await proxmoxRequest("/cluster/firewall/rules");
        break;
      case "pve_create_cluster_firewall_rule":
        result = await proxmoxRequest("/cluster/firewall/rules", "POST", args);
        break;
      case "pve_list_security_groups":
        result = await proxmoxRequest("/cluster/firewall/groups");
        break;
      case "pve_create_security_group":
        result = await proxmoxRequest("/cluster/firewall/groups", "POST", args);
        break;
      case "pve_list_ipsets":
        result = await proxmoxRequest("/cluster/firewall/ipset");
        break;
      case "pve_create_ipset":
        result = await proxmoxRequest("/cluster/firewall/ipset", "POST", args);
        break;
      case "pve_list_firewall_aliases":
        result = await proxmoxRequest("/cluster/firewall/aliases");
        break;
      case "pve_create_firewall_alias":
        result = await proxmoxRequest("/cluster/firewall/aliases", "POST", args);
        break;

      // CLUSTER - Replication
      case "pve_list_replication_jobs":
        result = await proxmoxRequest("/cluster/replication");
        break;
      case "pve_get_replication_job":
        result = await proxmoxRequest(`/cluster/replication/${args.id}`);
        break;
      case "pve_create_replication_job":
        result = await proxmoxRequest("/cluster/replication", "POST", args);
        break;
      case "pve_delete_replication_job":
        result = await proxmoxRequest(`/cluster/replication/${args.id}`, "DELETE");
        break;

      // NODES
      case "pve_list_nodes":
        result = await proxmoxRequest("/nodes");
        break;
      case "pve_get_node_status":
        result = await proxmoxRequest(`/nodes/${args.node}/status`);
        break;
      case "pve_get_node_version":
        result = await proxmoxRequest(`/nodes/${args.node}/version`);
        break;
      case "pve_get_node_time":
        result = await proxmoxRequest(`/nodes/${args.node}/time`);
        break;
      case "pve_set_node_time":
        result = await proxmoxRequest(`/nodes/${args.node}/time`, "PUT", args);
        break;
      case "pve_get_node_dns":
        result = await proxmoxRequest(`/nodes/${args.node}/dns`);
        break;
      case "pve_set_node_dns":
        result = await proxmoxRequest(`/nodes/${args.node}/dns`, "PUT", args);
        break;
      case "pve_get_node_syslog":
        result = await proxmoxRequest(`/nodes/${args.node}/syslog${buildQueryString(args)}`);
        break;
      case "pve_get_node_journal":
        result = await proxmoxRequest(`/nodes/${args.node}/journal${buildQueryString(args)}`);
        break;
      case "pve_get_node_subscription":
        result = await proxmoxRequest(`/nodes/${args.node}/subscription`);
        break;
      case "pve_get_node_report":
        result = await proxmoxRequest(`/nodes/${args.node}/report`);
        break;
      case "pve_node_start_all":
        result = await proxmoxRequest(`/nodes/${args.node}/startall`, "POST", args);
        break;
      case "pve_node_stop_all":
        result = await proxmoxRequest(`/nodes/${args.node}/stopall`, "POST", args);
        break;

      // NODE - Services
      case "pve_list_node_services":
        result = await proxmoxRequest(`/nodes/${args.node}/services`);
        break;
      case "pve_get_node_service_state":
        result = await proxmoxRequest(`/nodes/${args.node}/services/${args.service}/state`);
        break;
      case "pve_node_service_start":
        result = await proxmoxRequest(`/nodes/${args.node}/services/${args.service}/start`, "POST");
        break;
      case "pve_node_service_stop":
        result = await proxmoxRequest(`/nodes/${args.node}/services/${args.service}/stop`, "POST");
        break;
      case "pve_node_service_restart":
        result = await proxmoxRequest(`/nodes/${args.node}/services/${args.service}/restart`, "POST");
        break;
      case "pve_node_service_reload":
        result = await proxmoxRequest(`/nodes/${args.node}/services/${args.service}/reload`, "POST");
        break;

      // NODE - Network
      case "pve_list_node_networks":
        result = await proxmoxRequest(`/nodes/${args.node}/network${buildQueryString(args)}`);
        break;
      case "pve_get_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network/${args.iface}`);
        break;
      case "pve_create_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network`, "POST", args);
        break;
      case "pve_update_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network/${args.iface}`, "PUT", args);
        break;
      case "pve_delete_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network/${args.iface}`, "DELETE");
        break;
      case "pve_apply_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network`, "PUT");
        break;
      case "pve_revert_node_network":
        result = await proxmoxRequest(`/nodes/${args.node}/network`, "DELETE");
        break;

      // NODE - Tasks
      case "pve_list_node_tasks":
        result = await proxmoxRequest(`/nodes/${args.node}/tasks${buildQueryString(args)}`);
        break;
      case "pve_get_node_task_status":
        result = await proxmoxRequest(`/nodes/${args.node}/tasks/${encodeURIComponent(args.upid as string)}/status`);
        break;
      case "pve_get_node_task_log":
        result = await proxmoxRequest(`/nodes/${args.node}/tasks/${encodeURIComponent(args.upid as string)}/log${buildQueryString(args)}`);
        break;
      case "pve_stop_node_task":
        result = await proxmoxRequest(`/nodes/${args.node}/tasks/${encodeURIComponent(args.upid as string)}`, "DELETE");
        break;

      // NODE - Storage
      case "pve_list_node_storage":
        result = await proxmoxRequest(`/nodes/${args.node}/storage${buildQueryString(args)}`);
        break;
      case "pve_get_node_storage_status":
        result = await proxmoxRequest(`/nodes/${args.node}/storage/${args.storage}/status`);
        break;
      case "pve_list_node_storage_content":
        result = await proxmoxRequest(`/nodes/${args.node}/storage/${args.storage}/content${buildQueryString(args)}`);
        break;
      case "pve_upload_to_storage":
        result = await proxmoxRequest(`/nodes/${args.node}/storage/${args.storage}/upload`, "POST", args);
        break;
      case "pve_download_url_to_storage":
        result = await proxmoxRequest(`/nodes/${args.node}/storage/${args.storage}/download-url`, "POST", args);
        break;
      case "pve_delete_storage_content":
        result = await proxmoxRequest(`/nodes/${args.node}/storage/${args.storage}/content/${encodeURIComponent(args.volume as string)}`, "DELETE");
        break;

      // NODE - Disks
      case "pve_list_node_disks":
        result = await proxmoxRequest(`/nodes/${args.node}/disks/list${buildQueryString(args)}`);
        break;
      case "pve_get_node_disk_smart":
        result = await proxmoxRequest(`/nodes/${args.node}/disks/smart${buildQueryString(args)}`);
        break;
      case "pve_initialize_disk_gpt":
        result = await proxmoxRequest(`/nodes/${args.node}/disks/initgpt`, "POST", args);
        break;
      case "pve_wipe_disk":
        result = await proxmoxRequest(`/nodes/${args.node}/disks/wipedisk`, "PUT", args);
        break;

      // NODE - Certificates
      case "pve_list_node_certificates":
        result = await proxmoxRequest(`/nodes/${args.node}/certificates/info`);
        break;
      case "pve_get_node_acme":
        result = await proxmoxRequest(`/nodes/${args.node}/certificates/acme`);
        break;
      case "pve_order_node_certificate":
        result = await proxmoxRequest(`/nodes/${args.node}/certificates/acme/certificate`, "POST", args);
        break;
      case "pve_renew_node_certificate":
        result = await proxmoxRequest(`/nodes/${args.node}/certificates/acme/certificate`, "PUT", args);
        break;

      // NODE - APT
      case "pve_list_apt_updates":
        result = await proxmoxRequest(`/nodes/${args.node}/apt/update`);
        break;
      case "pve_apt_update":
        result = await proxmoxRequest(`/nodes/${args.node}/apt/update`, "POST", args);
        break;
      case "pve_apt_changelog":
        result = await proxmoxRequest(`/nodes/${args.node}/apt/changelog${buildQueryString(args)}`);
        break;
      case "pve_apt_versions":
        result = await proxmoxRequest(`/nodes/${args.node}/apt/versions`);
        break;

      // QEMU - VMs
      case "pve_list_vms":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu${buildQueryString(args)}`);
        break;
      case "pve_get_vm_status":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/current`);
        break;
      case "pve_get_vm_config":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/config${buildQueryString(args)}`);
        break;
      case "pve_create_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu`, "POST", args);
        break;
      case "pve_update_vm_config":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/config`, "PUT", args);
        break;
      case "pve_delete_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}${buildQueryString(args)}`, "DELETE");
        break;
      case "pve_start_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/start`, "POST", args);
        break;
      case "pve_stop_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/stop`, "POST", args);
        break;
      case "pve_shutdown_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/shutdown`, "POST", args);
        break;
      case "pve_reboot_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/reboot`, "POST", args);
        break;
      case "pve_reset_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/reset`, "POST", args);
        break;
      case "pve_suspend_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/suspend`, "POST", args);
        break;
      case "pve_resume_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/status/resume`, "POST", args);
        break;
      case "pve_clone_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/clone`, "POST", args);
        break;
      case "pve_migrate_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/migrate`, "POST", args);
        break;
      case "pve_resize_vm_disk":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/resize`, "PUT", args);
        break;
      case "pve_move_vm_disk":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/move_disk`, "POST", args);
        break;
      case "pve_convert_vm_to_template":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/template`, "POST", args);
        break;

      // QEMU - Snapshots
      case "pve_list_vm_snapshots":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/snapshot`);
        break;
      case "pve_create_vm_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/snapshot`, "POST", args);
        break;
      case "pve_get_vm_snapshot_config":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/snapshot/${args.snapname}/config`);
        break;
      case "pve_rollback_vm_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/snapshot/${args.snapname}/rollback`, "POST", args);
        break;
      case "pve_delete_vm_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/snapshot/${args.snapname}${buildQueryString(args)}`, "DELETE");
        break;

      // QEMU - Backup
      case "pve_backup_vm":
        result = await proxmoxRequest(`/nodes/${args.node}/vzdump`, "POST", args);
        break;

      // QEMU - Firewall
      case "pve_get_vm_firewall_options":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/firewall/options`);
        break;
      case "pve_set_vm_firewall_options":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/firewall/options`, "PUT", args);
        break;
      case "pve_list_vm_firewall_rules":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/firewall/rules`);
        break;
      case "pve_create_vm_firewall_rule":
        result = await proxmoxRequest(`/nodes/${args.node}/qemu/${args.vmid}/firewall/rules`, "POST", args);
        break;

      // LXC - Containers
      case "pve_list_containers":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc`);
        break;
      case "pve_get_container_status":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/current`);
        break;
      case "pve_get_container_config":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/config${buildQueryString(args)}`);
        break;
      case "pve_create_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc`, "POST", args);
        break;
      case "pve_update_container_config":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/config`, "PUT", args);
        break;
      case "pve_delete_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}${buildQueryString(args)}`, "DELETE");
        break;
      case "pve_start_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/start`, "POST", args);
        break;
      case "pve_stop_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/stop`, "POST", args);
        break;
      case "pve_shutdown_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/shutdown`, "POST", args);
        break;
      case "pve_reboot_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/reboot`, "POST", args);
        break;
      case "pve_suspend_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/suspend`, "POST");
        break;
      case "pve_resume_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/status/resume`, "POST");
        break;
      case "pve_clone_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/clone`, "POST", args);
        break;
      case "pve_migrate_container":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/migrate`, "POST", args);
        break;
      case "pve_resize_container_disk":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/resize`, "PUT", args);
        break;
      case "pve_convert_container_to_template":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/template`, "POST");
        break;

      // LXC - Snapshots
      case "pve_list_container_snapshots":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/snapshot`);
        break;
      case "pve_create_container_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/snapshot`, "POST", args);
        break;
      case "pve_rollback_container_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/snapshot/${args.snapname}/rollback`, "POST", args);
        break;
      case "pve_delete_container_snapshot":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/snapshot/${args.snapname}${buildQueryString(args)}`, "DELETE");
        break;

      // LXC - Firewall
      case "pve_get_container_firewall_options":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/firewall/options`);
        break;
      case "pve_set_container_firewall_options":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/firewall/options`, "PUT", args);
        break;
      case "pve_list_container_firewall_rules":
        result = await proxmoxRequest(`/nodes/${args.node}/lxc/${args.vmid}/firewall/rules`);
        break;

      // STORAGE
      case "pve_list_storage":
        result = await proxmoxRequest(`/storage${buildQueryString(args)}`);
        break;
      case "pve_get_storage":
        result = await proxmoxRequest(`/storage/${args.storage}`);
        break;
      case "pve_create_storage":
        result = await proxmoxRequest("/storage", "POST", args);
        break;
      case "pve_update_storage":
        result = await proxmoxRequest(`/storage/${args.storage}`, "PUT", args);
        break;
      case "pve_delete_storage":
        result = await proxmoxRequest(`/storage/${args.storage}`, "DELETE");
        break;

      // POOLS
      case "pve_list_pools":
        result = await proxmoxRequest("/pools");
        break;
      case "pve_get_pool":
        result = await proxmoxRequest(`/pools/${encodeURIComponent(args.poolid as string)}${buildQueryString(args)}`);
        break;
      case "pve_create_pool":
        result = await proxmoxRequest("/pools", "POST", args);
        break;
      case "pve_update_pool":
        result = await proxmoxRequest(`/pools/${encodeURIComponent(args.poolid as string)}`, "PUT", args);
        break;
      case "pve_delete_pool":
        result = await proxmoxRequest(`/pools/${encodeURIComponent(args.poolid as string)}`, "DELETE");
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Proxmox MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
