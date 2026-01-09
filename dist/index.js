#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
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
// Helper function to make Proxmox API requests
async function proxmoxRequest(endpoint, method = "GET", body) {
    const url = `${PROXMOX_HOST}/api2/json${endpoint}`;
    const headers = {
        "Authorization": `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`,
    };
    let requestBody;
    if (body && (method === "POST" || method === "PUT" || method === "DELETE")) {
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
    const data = await response.json();
    return data.data;
}
// Create the MCP server
const server = new Server({
    name: "proxmox-mcp",
    version: "2.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Tool definitions with path and method mappings
const toolDefinitions = [
    {
        "name": "pve_list_cluster",
        "description": "Cluster index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_replication",
        "description": "List replication jobs.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/replication",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_replication",
        "description": "Create a new replication job",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable/deactivate the entry."
                },
                "id": {
                    "type": "string",
                    "description": "Replication Job ID. The ID is composed of a Guest ID and a job number, separated by a hyphen, i.e. '<GUEST>-<JOBNUM>'."
                },
                "rate": {
                    "type": "number",
                    "description": "Rate limit in mbps (megabytes per second) as floating point number."
                },
                "remove_job": {
                    "type": "string",
                    "description": "Mark the replication job for removal. The job will remove all local replication snapshots. When set to 'full', it also tries to remove replicated volumes on the target. The job then removes itself from the configuration file.",
                    "enum": [
                        "local",
                        "full"
                    ]
                },
                "schedule": {
                    "type": "string",
                    "description": "Storage replication schedule. The format is a subset of `systemd` calendar events.",
                    "default": "*/15"
                },
                "source": {
                    "type": "string",
                    "description": "For internal use, to detect if the guest was stolen."
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                },
                "type": {
                    "type": "string",
                    "description": "Section type.",
                    "enum": [
                        "local"
                    ]
                }
            },
            "required": [
                "id",
                "target",
                "type"
            ]
        },
        "path": "/cluster/replication",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_replication",
        "description": "Read replication job configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/replication/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_replication",
        "description": "Update replication job configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable/deactivate the entry."
                },
                "rate": {
                    "type": "number",
                    "description": "Rate limit in mbps (megabytes per second) as floating point number."
                },
                "remove_job": {
                    "type": "string",
                    "description": "Mark the replication job for removal. The job will remove all local replication snapshots. When set to 'full', it also tries to remove replicated volumes on the target. The job then removes itself from the configuration file.",
                    "enum": [
                        "local",
                        "full"
                    ]
                },
                "schedule": {
                    "type": "string",
                    "description": "Storage replication schedule. The format is a subset of `systemd` calendar events.",
                    "default": "*/15"
                },
                "source": {
                    "type": "string",
                    "description": "For internal use, to detect if the guest was stolen."
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/replication/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_replication",
        "description": "Mark replication job for removal.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "force": {
                    "type": "boolean",
                    "description": "Will remove the jobconfig entry, but will not cleanup.",
                    "default": 0
                },
                "keep": {
                    "type": "boolean",
                    "description": "Keep replicated data at target (do not remove).",
                    "default": 0
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/replication/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_metrics",
        "description": "Metrics index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/metrics",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_metrics_server",
        "description": "List configured metric servers.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/metrics/server",
        "method": "GET"
    },
    {
        "name": "pve_get_cluster_metrics_server",
        "description": "Read metric server configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/metrics/server/{id}",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_metrics_server",
        "description": "Create a new external metric server config",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "api-path-prefix": {
                    "type": "string",
                    "description": "An API path prefix inserted between '<host>:<port>/' and '/api2/'. Can be useful if the InfluxDB service runs behind a reverse proxy."
                },
                "bucket": {
                    "type": "string",
                    "description": "The InfluxDB bucket/db. Only necessary when using the http v2 api."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the plugin."
                },
                "influxdbproto": {
                    "type": "string",
                    "description": "influxdbproto",
                    "enum": [
                        "udp",
                        "http",
                        "https"
                    ],
                    "default": "udp"
                },
                "max-body-size": {
                    "type": "number",
                    "description": "InfluxDB max-body-size in bytes. Requests are batched up to this size.",
                    "default": 25000000
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU for metrics transmission over UDP",
                    "default": 1500
                },
                "organization": {
                    "type": "string",
                    "description": "The InfluxDB organization. Only necessary when using the http v2 api. Has no meaning when using v2 compatibility api."
                },
                "otel-compression": {
                    "type": "string",
                    "description": "Compression algorithm for requests",
                    "enum": [
                        "none",
                        "gzip"
                    ],
                    "default": "gzip"
                },
                "otel-headers": {
                    "type": "string",
                    "description": "Custom HTTP headers (JSON format, base64 encoded)"
                },
                "otel-max-body-size": {
                    "type": "number",
                    "description": "Maximum request body size in bytes",
                    "default": 10000000
                },
                "otel-path": {
                    "type": "string",
                    "description": "OTLP endpoint path",
                    "default": "/v1/metrics"
                },
                "otel-protocol": {
                    "type": "string",
                    "description": "HTTP protocol",
                    "enum": [
                        "http",
                        "https"
                    ],
                    "default": "https"
                },
                "otel-resource-attributes": {
                    "type": "string",
                    "description": "Additional resource attributes as JSON, base64 encoded"
                },
                "otel-timeout": {
                    "type": "number",
                    "description": "HTTP request timeout in seconds",
                    "default": 5
                },
                "otel-verify-ssl": {
                    "type": "boolean",
                    "description": "Verify SSL certificates",
                    "default": 1
                },
                "path": {
                    "type": "string",
                    "description": "root graphite path (ex: proxmox.mycluster.mykey)"
                },
                "port": {
                    "type": "number",
                    "description": "server network port"
                },
                "proto": {
                    "type": "string",
                    "description": "Protocol to send graphite data. TCP or UDP (default)",
                    "enum": [
                        "udp",
                        "tcp"
                    ]
                },
                "server": {
                    "type": "string",
                    "description": "server dns name or IP address"
                },
                "timeout": {
                    "type": "number",
                    "description": "graphite TCP socket timeout (default=1)",
                    "default": 1
                },
                "token": {
                    "type": "string",
                    "description": "The InfluxDB access token. Only necessary when using the http v2 api. If the v2 compatibility api is used, use 'user:password' instead."
                },
                "type": {
                    "type": "string",
                    "description": "Plugin type.",
                    "enum": [
                        "graphite",
                        "influxdb",
                        "opentelemetry"
                    ]
                },
                "verify-certificate": {
                    "type": "boolean",
                    "description": "Set to 0 to disable certificate verification for https endpoints.",
                    "default": 1
                }
            },
            "required": [
                "id",
                "port",
                "server",
                "type"
            ]
        },
        "path": "/cluster/metrics/server/{id}",
        "method": "POST"
    },
    {
        "name": "pve_update_cluster_metrics_server",
        "description": "Update metric server configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "api-path-prefix": {
                    "type": "string",
                    "description": "An API path prefix inserted between '<host>:<port>/' and '/api2/'. Can be useful if the InfluxDB service runs behind a reverse proxy."
                },
                "bucket": {
                    "type": "string",
                    "description": "The InfluxDB bucket/db. Only necessary when using the http v2 api."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the plugin."
                },
                "influxdbproto": {
                    "type": "string",
                    "description": "influxdbproto",
                    "enum": [
                        "udp",
                        "http",
                        "https"
                    ],
                    "default": "udp"
                },
                "max-body-size": {
                    "type": "number",
                    "description": "InfluxDB max-body-size in bytes. Requests are batched up to this size.",
                    "default": 25000000
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU for metrics transmission over UDP",
                    "default": 1500
                },
                "organization": {
                    "type": "string",
                    "description": "The InfluxDB organization. Only necessary when using the http v2 api. Has no meaning when using v2 compatibility api."
                },
                "otel-compression": {
                    "type": "string",
                    "description": "Compression algorithm for requests",
                    "enum": [
                        "none",
                        "gzip"
                    ],
                    "default": "gzip"
                },
                "otel-headers": {
                    "type": "string",
                    "description": "Custom HTTP headers (JSON format, base64 encoded)"
                },
                "otel-max-body-size": {
                    "type": "number",
                    "description": "Maximum request body size in bytes",
                    "default": 10000000
                },
                "otel-path": {
                    "type": "string",
                    "description": "OTLP endpoint path",
                    "default": "/v1/metrics"
                },
                "otel-protocol": {
                    "type": "string",
                    "description": "HTTP protocol",
                    "enum": [
                        "http",
                        "https"
                    ],
                    "default": "https"
                },
                "otel-resource-attributes": {
                    "type": "string",
                    "description": "Additional resource attributes as JSON, base64 encoded"
                },
                "otel-timeout": {
                    "type": "number",
                    "description": "HTTP request timeout in seconds",
                    "default": 5
                },
                "otel-verify-ssl": {
                    "type": "boolean",
                    "description": "Verify SSL certificates",
                    "default": 1
                },
                "path": {
                    "type": "string",
                    "description": "root graphite path (ex: proxmox.mycluster.mykey)"
                },
                "port": {
                    "type": "number",
                    "description": "server network port"
                },
                "proto": {
                    "type": "string",
                    "description": "Protocol to send graphite data. TCP or UDP (default)",
                    "enum": [
                        "udp",
                        "tcp"
                    ]
                },
                "server": {
                    "type": "string",
                    "description": "server dns name or IP address"
                },
                "timeout": {
                    "type": "number",
                    "description": "graphite TCP socket timeout (default=1)",
                    "default": 1
                },
                "token": {
                    "type": "string",
                    "description": "The InfluxDB access token. Only necessary when using the http v2 api. If the v2 compatibility api is used, use 'user:password' instead."
                },
                "verify-certificate": {
                    "type": "boolean",
                    "description": "Set to 0 to disable certificate verification for https endpoints.",
                    "default": 1
                }
            },
            "required": [
                "id",
                "port",
                "server"
            ]
        },
        "path": "/cluster/metrics/server/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_metrics_server",
        "description": "Remove Metric server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/metrics/server/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_metrics_export",
        "description": "Retrieve metrics of the cluster.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "history": {
                    "type": "boolean",
                    "description": "Also return historic values. Returns full available metric history unless `start-time` is also set",
                    "default": 0
                },
                "local-only": {
                    "type": "boolean",
                    "description": "Only return metrics for the current node instead of the whole cluster",
                    "default": 0
                },
                "node-list": {
                    "type": "string",
                    "description": "Only return metrics from nodes passed as comma-separated list"
                },
                "start-time": {
                    "type": "number",
                    "description": "Only include metrics with a timestamp > start-time.",
                    "default": 0
                }
            },
            "required": []
        },
        "path": "/cluster/metrics/export",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_notifications",
        "description": "Index for notification-related API endpoints.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_notifications_matcher-fields",
        "description": "Returns known notification metadata fields",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/matcher-fields",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_notifications_matcher-field-values",
        "description": "Returns known notification metadata fields and their known values",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/matcher-field-values",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_notifications_endpoints",
        "description": "Index for all available endpoint types.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/endpoints",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_notifications_endpoints_sendmail",
        "description": "Returns a list of all sendmail endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/endpoints/sendmail",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_endpoints_sendmail",
        "description": "Create a new sendmail endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "author": {
                    "type": "string",
                    "description": "Author of the mail"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "from-address": {
                    "type": "string",
                    "description": "`From` address for the mail"
                },
                "mailto": {
                    "type": "array",
                    "description": "List of email recipients"
                },
                "mailto-user": {
                    "type": "array",
                    "description": "List of users"
                },
                "name": {
                    "type": "string",
                    "description": "The name of the endpoint."
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/sendmail",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_notifications_endpoints_sendmail",
        "description": "Return a specific sendmail endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/sendmail/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_notifications_endpoints_sendmail",
        "description": "Update existing sendmail endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "author": {
                    "type": "string",
                    "description": "Author of the mail"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "delete": {
                    "type": "array",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "from-address": {
                    "type": "string",
                    "description": "`From` address for the mail"
                },
                "mailto": {
                    "type": "array",
                    "description": "List of email recipients"
                },
                "mailto-user": {
                    "type": "array",
                    "description": "List of users"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/sendmail/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_notifications_endpoints_sendmail",
        "description": "Remove sendmail endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/sendmail/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_notifications_endpoints_gotify",
        "description": "Returns a list of all gotify endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/endpoints/gotify",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_endpoints_gotify",
        "description": "Create a new gotify endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "name": {
                    "type": "string",
                    "description": "The name of the endpoint."
                },
                "server": {
                    "type": "string",
                    "description": "Server URL"
                },
                "token": {
                    "type": "string",
                    "description": "Secret token"
                }
            },
            "required": [
                "name",
                "server",
                "token"
            ]
        },
        "path": "/cluster/notifications/endpoints/gotify",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_notifications_endpoints_gotify",
        "description": "Return a specific gotify endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/gotify/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_notifications_endpoints_gotify",
        "description": "Update existing gotify endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "delete": {
                    "type": "array",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "server": {
                    "type": "string",
                    "description": "Server URL"
                },
                "token": {
                    "type": "string",
                    "description": "Secret token"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/gotify/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_notifications_endpoints_gotify",
        "description": "Remove gotify endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/gotify/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_notifications_endpoints_smtp",
        "description": "Returns a list of all smtp endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/endpoints/smtp",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_endpoints_smtp",
        "description": "Create a new smtp endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "author": {
                    "type": "string",
                    "description": "Author of the mail. Defaults to 'Proxmox VE'."
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "from-address": {
                    "type": "string",
                    "description": "`From` address for the mail"
                },
                "mailto": {
                    "type": "array",
                    "description": "List of email recipients"
                },
                "mailto-user": {
                    "type": "array",
                    "description": "List of users"
                },
                "mode": {
                    "type": "string",
                    "description": "Determine which encryption method shall be used for the connection.",
                    "enum": [
                        "insecure",
                        "starttls",
                        "tls"
                    ],
                    "default": "tls"
                },
                "name": {
                    "type": "string",
                    "description": "The name of the endpoint."
                },
                "password": {
                    "type": "string",
                    "description": "Password for SMTP authentication"
                },
                "port": {
                    "type": "number",
                    "description": "The port to be used. Defaults to 465 for TLS based connections, 587 for STARTTLS based connections and port 25 for insecure plain-text connections."
                },
                "server": {
                    "type": "string",
                    "description": "The address of the SMTP server."
                },
                "username": {
                    "type": "string",
                    "description": "Username for SMTP authentication"
                }
            },
            "required": [
                "from-address",
                "name",
                "server"
            ]
        },
        "path": "/cluster/notifications/endpoints/smtp",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_notifications_endpoints_smtp",
        "description": "Return a specific smtp endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/smtp/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_notifications_endpoints_smtp",
        "description": "Update existing smtp endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "author": {
                    "type": "string",
                    "description": "Author of the mail. Defaults to 'Proxmox VE'."
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "delete": {
                    "type": "array",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "from-address": {
                    "type": "string",
                    "description": "`From` address for the mail"
                },
                "mailto": {
                    "type": "array",
                    "description": "List of email recipients"
                },
                "mailto-user": {
                    "type": "array",
                    "description": "List of users"
                },
                "mode": {
                    "type": "string",
                    "description": "Determine which encryption method shall be used for the connection.",
                    "enum": [
                        "insecure",
                        "starttls",
                        "tls"
                    ],
                    "default": "tls"
                },
                "password": {
                    "type": "string",
                    "description": "Password for SMTP authentication"
                },
                "port": {
                    "type": "number",
                    "description": "The port to be used. Defaults to 465 for TLS based connections, 587 for STARTTLS based connections and port 25 for insecure plain-text connections."
                },
                "server": {
                    "type": "string",
                    "description": "The address of the SMTP server."
                },
                "username": {
                    "type": "string",
                    "description": "Username for SMTP authentication"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/smtp/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_notifications_endpoints_smtp",
        "description": "Remove smtp endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/smtp/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_notifications_endpoints_webhook",
        "description": "Returns a list of all webhook endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/endpoints/webhook",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_endpoints_webhook",
        "description": "Create a new webhook endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "body": {
                    "type": "string",
                    "description": "HTTP body, base64 encoded"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "header": {
                    "type": "array",
                    "description": "HTTP headers to set. These have to be formatted as a property string in the format name=<name>,value=<base64 of value>"
                },
                "method": {
                    "type": "string",
                    "description": "HTTP method",
                    "enum": [
                        "post",
                        "put",
                        "get"
                    ]
                },
                "name": {
                    "type": "string",
                    "description": "The name of the endpoint."
                },
                "secret": {
                    "type": "array",
                    "description": "Secrets to set. These have to be formatted as a property string in the format name=<name>,value=<base64 of value>"
                },
                "url": {
                    "type": "string",
                    "description": "Server URL"
                }
            },
            "required": [
                "method",
                "name",
                "url"
            ]
        },
        "path": "/cluster/notifications/endpoints/webhook",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_notifications_endpoints_webhook",
        "description": "Return a specific webhook endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/webhook/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_notifications_endpoints_webhook",
        "description": "Update existing webhook endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "body": {
                    "type": "string",
                    "description": "HTTP body, base64 encoded"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "delete": {
                    "type": "array",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this target",
                    "default": 0
                },
                "header": {
                    "type": "array",
                    "description": "HTTP headers to set. These have to be formatted as a property string in the format name=<name>,value=<base64 of value>"
                },
                "method": {
                    "type": "string",
                    "description": "HTTP method",
                    "enum": [
                        "post",
                        "put",
                        "get"
                    ]
                },
                "secret": {
                    "type": "array",
                    "description": "Secrets to set. These have to be formatted as a property string in the format name=<name>,value=<base64 of value>"
                },
                "url": {
                    "type": "string",
                    "description": "Server URL"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/webhook/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_notifications_endpoints_webhook",
        "description": "Remove webhook endpoint",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/endpoints/webhook/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_notifications_targets",
        "description": "Returns a list of all entities that can be used as notification targets.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/targets",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_targets_test",
        "description": "Send a test notification to a provided target.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/targets/{name}/test",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_notifications_matchers",
        "description": "Returns a list of all matchers",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/notifications/matchers",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_notifications_matchers",
        "description": "Create a new matcher",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this matcher",
                    "default": 0
                },
                "invert-match": {
                    "type": "boolean",
                    "description": "Invert match of the whole matcher"
                },
                "match-calendar": {
                    "type": "array",
                    "description": "Match notification timestamp"
                },
                "match-field": {
                    "type": "array",
                    "description": "Metadata fields to match (regex or exact match). Must be in the form (regex|exact):<field>=<value>"
                },
                "match-severity": {
                    "type": "array",
                    "description": "Notification severities to match"
                },
                "mode": {
                    "type": "string",
                    "description": "Choose between 'all' and 'any' for when multiple properties are specified",
                    "enum": [
                        "all",
                        "any"
                    ],
                    "default": "all"
                },
                "name": {
                    "type": "string",
                    "description": "Name of the matcher."
                },
                "target": {
                    "type": "array",
                    "description": "Targets to notify on match"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/matchers",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_notifications_matchers",
        "description": "Return a specific matcher",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/matchers/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_notifications_matchers",
        "description": "Update existing matcher",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "comment": {
                    "type": "string",
                    "description": "Comment"
                },
                "delete": {
                    "type": "array",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Disable this matcher",
                    "default": 0
                },
                "invert-match": {
                    "type": "boolean",
                    "description": "Invert match of the whole matcher"
                },
                "match-calendar": {
                    "type": "array",
                    "description": "Match notification timestamp"
                },
                "match-field": {
                    "type": "array",
                    "description": "Metadata fields to match (regex or exact match). Must be in the form (regex|exact):<field>=<value>"
                },
                "match-severity": {
                    "type": "array",
                    "description": "Notification severities to match"
                },
                "mode": {
                    "type": "string",
                    "description": "Choose between 'all' and 'any' for when multiple properties are specified",
                    "enum": [
                        "all",
                        "any"
                    ],
                    "default": "all"
                },
                "target": {
                    "type": "array",
                    "description": "Targets to notify on match"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/matchers/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_notifications_matchers",
        "description": "Remove matcher",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/notifications/matchers/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_config",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/config",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_config",
        "description": "Generate new cluster configuration. If no links given, default to local IP address as link0.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "clustername": {
                    "type": "string",
                    "description": "The name of the cluster."
                },
                "link[n]": {
                    "type": "string",
                    "description": "Address and priority information of a single corosync link. (up to 8 links supported; link0..link7)"
                },
                "nodeid": {
                    "type": "number",
                    "description": "Node id for this node."
                },
                "votes": {
                    "type": "number",
                    "description": "Number of votes for this node."
                }
            },
            "required": [
                "clustername"
            ]
        },
        "path": "/cluster/config",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_config_apiversion",
        "description": "Return the version of the cluster join API available on this node.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/config/apiversion",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_config_nodes",
        "description": "Corosync node list.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/config/nodes",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_config_nodes",
        "description": "Adds a node to the cluster configuration. This call is for internal use.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "apiversion": {
                    "type": "number",
                    "description": "The JOIN_API_VERSION of the new node."
                },
                "force": {
                    "type": "boolean",
                    "description": "Do not throw error if node already exists."
                },
                "link[n]": {
                    "type": "string",
                    "description": "Address and priority information of a single corosync link. (up to 8 links supported; link0..link7)"
                },
                "new_node_ip": {
                    "type": "string",
                    "description": "IP Address of node to add. Used as fallback if no links are given."
                },
                "nodeid": {
                    "type": "number",
                    "description": "Node id for this node."
                },
                "votes": {
                    "type": "number",
                    "description": "Number of votes for this node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/cluster/config/nodes/{node}",
        "method": "POST"
    },
    {
        "name": "pve_delete_cluster_config_nodes",
        "description": "Removes a node from the cluster configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/cluster/config/nodes/{node}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_config_join",
        "description": "Get information needed to join this cluster over the connected node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "The node for which the joinee gets the nodeinfo. ",
                    "default": "current connected node"
                }
            },
            "required": []
        },
        "path": "/cluster/config/join",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_config_join",
        "description": "Joins this node into an existing cluster. If no links are given, default to IP resolved by node's hostname on single link (fallback fails for clusters with multiple links).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "force": {
                    "type": "boolean",
                    "description": "Do not throw error if node already exists."
                },
                "hostname": {
                    "type": "string",
                    "description": "Hostname (or IP) of an existing cluster member."
                },
                "link[n]": {
                    "type": "string",
                    "description": "Address and priority information of a single corosync link. (up to 8 links supported; link0..link7)"
                },
                "nodeid": {
                    "type": "number",
                    "description": "Node id for this node."
                },
                "password": {
                    "type": "string",
                    "description": "Superuser (root) password of peer node."
                },
                "votes": {
                    "type": "number",
                    "description": "Number of votes for this node"
                }
            },
            "required": [
                "fingerprint",
                "hostname",
                "password"
            ]
        },
        "path": "/cluster/config/join",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_config_totem",
        "description": "Get corosync totem protocol settings.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/config/totem",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_config_qdevice",
        "description": "Get QDevice status",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/config/qdevice",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_firewall",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_firewall_groups",
        "description": "List security groups.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/groups",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_groups_groups",
        "description": "Create new security group.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "group": {
                    "type": "string",
                    "description": "Security Group name."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename/update an existing security group. You can set 'rename' to the same value as 'name' to update the 'comment' of an existing group."
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/firewall/groups",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_firewall_groups_groups",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/firewall/groups/{group}",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_groups_groups",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "group",
                "action",
                "type"
            ]
        },
        "path": "/cluster/firewall/groups/{group}",
        "method": "POST"
    },
    {
        "name": "pve_delete_cluster_firewall_groups_groups",
        "description": "Delete security group.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/firewall/groups/{group}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_firewall_groups_groups",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "group",
                "pos"
            ]
        },
        "path": "/cluster/firewall/groups/{group}/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_firewall_groups",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "group",
                "pos"
            ]
        },
        "path": "/cluster/firewall/groups/{group}/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_firewall_groups_groups",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "group",
                "pos"
            ]
        },
        "path": "/cluster/firewall/groups/{group}/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_firewall_rules",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_rules",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "action",
                "type"
            ]
        },
        "path": "/cluster/firewall/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_firewall_rules",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "pos"
            ]
        },
        "path": "/cluster/firewall/rules/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_firewall_rules",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "pos"
            ]
        },
        "path": "/cluster/firewall/rules/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_firewall_rules",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "pos"
            ]
        },
        "path": "/cluster/firewall/rules/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_firewall_ipset",
        "description": "List IPSets",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/ipset",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_ipset_ipset",
        "description": "Create new IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "name": {
                    "type": "string",
                    "description": "IP set name."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing IPSet. You can set 'rename' to the same value as 'name' to update the 'comment' of an existing IPSet."
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/firewall/ipset",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_firewall_ipset_ipset",
        "description": "List IPSet content",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_ipset_ipset",
        "description": "Add IP or Network to IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "name",
                "cidr"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}",
        "method": "POST"
    },
    {
        "name": "pve_delete_cluster_firewall_ipset_ipset",
        "description": "Delete IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "force": {
                    "type": "boolean",
                    "description": "Delete all members of the IPSet, if there are any."
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_firewall_ipset_ipset",
        "description": "Read IP or Network settings from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                }
            },
            "required": [
                "name",
                "cidr"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}/{cidr}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_firewall_ipset",
        "description": "Update IP or Network settings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "name",
                "cidr"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}/{cidr}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_firewall_ipset_ipset",
        "description": "Remove IP or Network from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "name",
                "cidr"
            ]
        },
        "path": "/cluster/firewall/ipset/{name}/{cidr}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_firewall_aliases",
        "description": "List aliases",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/aliases",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_firewall_aliases",
        "description": "Create IP or Network Alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "name": {
                    "type": "string",
                    "description": "Alias name."
                }
            },
            "required": [
                "cidr",
                "name"
            ]
        },
        "path": "/cluster/firewall/aliases",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_firewall_aliases",
        "description": "Read alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/firewall/aliases/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_firewall_aliases",
        "description": "Update IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing alias."
                }
            },
            "required": [
                "name",
                "cidr"
            ]
        },
        "path": "/cluster/firewall/aliases/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_firewall_aliases",
        "description": "Remove IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/firewall/aliases/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_firewall_options",
        "description": "Get Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/options",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_firewall_options",
        "description": "Set Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "ebtables": {
                    "type": "boolean",
                    "description": "Enable ebtables rules cluster wide.",
                    "default": 1
                },
                "enable": {
                    "type": "number",
                    "description": "Enable or disable the firewall cluster wide.",
                    "default": 0
                },
                "log_ratelimit": {
                    "type": "string",
                    "description": "Log ratelimiting settings"
                },
                "policy_forward": {
                    "type": "string",
                    "description": "Forward policy.",
                    "enum": [
                        "ACCEPT",
                        "DROP"
                    ]
                },
                "policy_in": {
                    "type": "string",
                    "description": "Input policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                },
                "policy_out": {
                    "type": "string",
                    "description": "Output policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/firewall/options",
        "method": "PUT"
    },
    {
        "name": "pve_list_cluster_firewall_macros",
        "description": "List available macros",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/firewall/macros",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_firewall_refs",
        "description": "Lists possible IPSet/Alias reference which are allowed in source/dest properties.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list references of specified type.",
                    "enum": [
                        "alias",
                        "ipset"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/firewall/refs",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_backup",
        "description": "List vzdump backup schedule.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/backup",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_backup",
        "description": "Create new vzdump backup job.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "all": {
                    "type": "boolean",
                    "description": "Backup all known guest systems on this host.",
                    "default": 0
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Limit I/O bandwidth (in KiB/s).",
                    "default": 0
                },
                "comment": {
                    "type": "string",
                    "description": "Description for the Job."
                },
                "compress": {
                    "type": "string",
                    "description": "Compress dump file.",
                    "enum": [
                        "0",
                        "1",
                        "gzip",
                        "lzo",
                        "zstd"
                    ],
                    "default": "0"
                },
                "dow": {
                    "type": "string",
                    "description": "Day of week selection.",
                    "default": "mon,tue,wed,thu,fri,sat,sun"
                },
                "dumpdir": {
                    "type": "string",
                    "description": "Store resulting files to specified directory."
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Enable or disable the job.",
                    "default": "1"
                },
                "exclude": {
                    "type": "string",
                    "description": "Exclude specified guest systems (assumes --all)"
                },
                "exclude-path": {
                    "type": "array",
                    "description": "Exclude certain files/directories (shell globs). Paths starting with '/' are anchored to the container's root, other paths match relative to each subdirectory."
                },
                "fleecing": {
                    "type": "string",
                    "description": "Options for backup fleecing (VM only)."
                },
                "id": {
                    "type": "string",
                    "description": "Job ID (will be autogenerated)."
                },
                "ionice": {
                    "type": "number",
                    "description": "Set IO priority when using the BFQ scheduler. For snapshot and suspend mode backups of VMs, this only affects the compressor. A value of 8 means the idle priority is used, otherwise the best-effort priority is used with the specified value.",
                    "default": 7
                },
                "lockwait": {
                    "type": "number",
                    "description": "Maximal time to wait for the global lock (minutes).",
                    "default": 180
                },
                "mailnotification": {
                    "type": "string",
                    "description": "Deprecated: use notification targets/matchers instead. Specify when to send a notification mail",
                    "enum": [
                        "always",
                        "failure"
                    ],
                    "default": "always"
                },
                "mailto": {
                    "type": "string",
                    "description": "Deprecated: Use notification targets/matchers instead. Comma-separated list of email addresses or users that should receive email notifications."
                },
                "maxfiles": {
                    "type": "number",
                    "description": "Deprecated: use 'prune-backups' instead. Maximal number of backup files per guest system."
                },
                "mode": {
                    "type": "string",
                    "description": "Backup mode.",
                    "enum": [
                        "snapshot",
                        "suspend",
                        "stop"
                    ],
                    "default": "snapshot"
                },
                "node": {
                    "type": "string",
                    "description": "Only run if executed on this node."
                },
                "notes-template": {
                    "type": "string",
                    "description": "Template string for generating notes for the backup(s). It can contain variables which will be replaced by their values. Currently supported are {{cluster}}, {{guestname}}, {{node}}, and {{vmid}}, but more might be added in the future. Needs to be a single line, newline and backslash need to be esca"
                },
                "notification-mode": {
                    "type": "string",
                    "description": "Determine which notification system to use. If set to 'legacy-sendmail', vzdump will consider the mailto/mailnotification parameters and send emails to the specified address(es) via the 'sendmail' command. If set to 'notification-system', a notification will be sent via PVE's notification system, an",
                    "enum": [
                        "auto",
                        "legacy-sendmail",
                        "notification-system"
                    ],
                    "default": "auto"
                },
                "pbs-change-detection-mode": {
                    "type": "string",
                    "description": "PBS mode used to detect file changes and switch encoding format for container backups.",
                    "enum": [
                        "legacy",
                        "data",
                        "metadata"
                    ]
                },
                "performance": {
                    "type": "string",
                    "description": "Other performance-related settings."
                },
                "pigz": {
                    "type": "number",
                    "description": "Use pigz instead of gzip when N>0. N=1 uses half of cores, N>1 uses N as thread count.",
                    "default": 0
                },
                "pool": {
                    "type": "string",
                    "description": "Backup all known guest systems included in the specified pool."
                },
                "protected": {
                    "type": "boolean",
                    "description": "If true, mark backup(s) as protected."
                },
                "prune-backups": {
                    "type": "string",
                    "description": "Use these retention options instead of those from the storage configuration.",
                    "default": "keep-all=1"
                },
                "quiet": {
                    "type": "boolean",
                    "description": "Be quiet.",
                    "default": 0
                },
                "remove": {
                    "type": "boolean",
                    "description": "Prune older backups according to 'prune-backups'.",
                    "default": 1
                },
                "repeat-missed": {
                    "type": "boolean",
                    "description": "If true, the job will be run as soon as possible if it was missed while the scheduler was not running.",
                    "default": 0
                },
                "schedule": {
                    "type": "string",
                    "description": "Backup schedule. The format is a subset of `systemd` calendar events."
                },
                "script": {
                    "type": "string",
                    "description": "Use specified hook script."
                },
                "starttime": {
                    "type": "string",
                    "description": "Job Start time."
                },
                "stdexcludes": {
                    "type": "boolean",
                    "description": "Exclude temporary files and logs.",
                    "default": 1
                },
                "stop": {
                    "type": "boolean",
                    "description": "Stop running backup jobs on this host.",
                    "default": 0
                },
                "stopwait": {
                    "type": "number",
                    "description": "Maximal time to wait until a guest system is stopped (minutes).",
                    "default": 10
                },
                "storage": {
                    "type": "string",
                    "description": "Store resulting file to this storage."
                },
                "tmpdir": {
                    "type": "string",
                    "description": "Store temporary files to specified directory."
                },
                "vmid": {
                    "type": "string",
                    "description": "The ID of the guest system you want to backup."
                },
                "zstd": {
                    "type": "number",
                    "description": "Zstd threads. N=0 uses half of the available cores, if N is set to a value bigger than 0, N is used as thread count.",
                    "default": 1
                }
            },
            "required": []
        },
        "path": "/cluster/backup",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_backup",
        "description": "Read vzdump backup job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/backup/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_backup",
        "description": "Update vzdump backup job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "all": {
                    "type": "boolean",
                    "description": "Backup all known guest systems on this host.",
                    "default": 0
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Limit I/O bandwidth (in KiB/s).",
                    "default": 0
                },
                "comment": {
                    "type": "string",
                    "description": "Description for the Job."
                },
                "compress": {
                    "type": "string",
                    "description": "Compress dump file.",
                    "enum": [
                        "0",
                        "1",
                        "gzip",
                        "lzo",
                        "zstd"
                    ],
                    "default": "0"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dow": {
                    "type": "string",
                    "description": "Day of week selection."
                },
                "dumpdir": {
                    "type": "string",
                    "description": "Store resulting files to specified directory."
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Enable or disable the job.",
                    "default": "1"
                },
                "exclude": {
                    "type": "string",
                    "description": "Exclude specified guest systems (assumes --all)"
                },
                "exclude-path": {
                    "type": "array",
                    "description": "Exclude certain files/directories (shell globs). Paths starting with '/' are anchored to the container's root, other paths match relative to each subdirectory."
                },
                "fleecing": {
                    "type": "string",
                    "description": "Options for backup fleecing (VM only)."
                },
                "ionice": {
                    "type": "number",
                    "description": "Set IO priority when using the BFQ scheduler. For snapshot and suspend mode backups of VMs, this only affects the compressor. A value of 8 means the idle priority is used, otherwise the best-effort priority is used with the specified value.",
                    "default": 7
                },
                "lockwait": {
                    "type": "number",
                    "description": "Maximal time to wait for the global lock (minutes).",
                    "default": 180
                },
                "mailnotification": {
                    "type": "string",
                    "description": "Deprecated: use notification targets/matchers instead. Specify when to send a notification mail",
                    "enum": [
                        "always",
                        "failure"
                    ],
                    "default": "always"
                },
                "mailto": {
                    "type": "string",
                    "description": "Deprecated: Use notification targets/matchers instead. Comma-separated list of email addresses or users that should receive email notifications."
                },
                "maxfiles": {
                    "type": "number",
                    "description": "Deprecated: use 'prune-backups' instead. Maximal number of backup files per guest system."
                },
                "mode": {
                    "type": "string",
                    "description": "Backup mode.",
                    "enum": [
                        "snapshot",
                        "suspend",
                        "stop"
                    ],
                    "default": "snapshot"
                },
                "node": {
                    "type": "string",
                    "description": "Only run if executed on this node."
                },
                "notes-template": {
                    "type": "string",
                    "description": "Template string for generating notes for the backup(s). It can contain variables which will be replaced by their values. Currently supported are {{cluster}}, {{guestname}}, {{node}}, and {{vmid}}, but more might be added in the future. Needs to be a single line, newline and backslash need to be esca"
                },
                "notification-mode": {
                    "type": "string",
                    "description": "Determine which notification system to use. If set to 'legacy-sendmail', vzdump will consider the mailto/mailnotification parameters and send emails to the specified address(es) via the 'sendmail' command. If set to 'notification-system', a notification will be sent via PVE's notification system, an",
                    "enum": [
                        "auto",
                        "legacy-sendmail",
                        "notification-system"
                    ],
                    "default": "auto"
                },
                "pbs-change-detection-mode": {
                    "type": "string",
                    "description": "PBS mode used to detect file changes and switch encoding format for container backups.",
                    "enum": [
                        "legacy",
                        "data",
                        "metadata"
                    ]
                },
                "performance": {
                    "type": "string",
                    "description": "Other performance-related settings."
                },
                "pigz": {
                    "type": "number",
                    "description": "Use pigz instead of gzip when N>0. N=1 uses half of cores, N>1 uses N as thread count.",
                    "default": 0
                },
                "pool": {
                    "type": "string",
                    "description": "Backup all known guest systems included in the specified pool."
                },
                "protected": {
                    "type": "boolean",
                    "description": "If true, mark backup(s) as protected."
                },
                "prune-backups": {
                    "type": "string",
                    "description": "Use these retention options instead of those from the storage configuration.",
                    "default": "keep-all=1"
                },
                "quiet": {
                    "type": "boolean",
                    "description": "Be quiet.",
                    "default": 0
                },
                "remove": {
                    "type": "boolean",
                    "description": "Prune older backups according to 'prune-backups'.",
                    "default": 1
                },
                "repeat-missed": {
                    "type": "boolean",
                    "description": "If true, the job will be run as soon as possible if it was missed while the scheduler was not running.",
                    "default": 0
                },
                "schedule": {
                    "type": "string",
                    "description": "Backup schedule. The format is a subset of `systemd` calendar events."
                },
                "script": {
                    "type": "string",
                    "description": "Use specified hook script."
                },
                "starttime": {
                    "type": "string",
                    "description": "Job Start time."
                },
                "stdexcludes": {
                    "type": "boolean",
                    "description": "Exclude temporary files and logs.",
                    "default": 1
                },
                "stop": {
                    "type": "boolean",
                    "description": "Stop running backup jobs on this host.",
                    "default": 0
                },
                "stopwait": {
                    "type": "number",
                    "description": "Maximal time to wait until a guest system is stopped (minutes).",
                    "default": 10
                },
                "storage": {
                    "type": "string",
                    "description": "Store resulting file to this storage."
                },
                "tmpdir": {
                    "type": "string",
                    "description": "Store temporary files to specified directory."
                },
                "vmid": {
                    "type": "string",
                    "description": "The ID of the guest system you want to backup."
                },
                "zstd": {
                    "type": "number",
                    "description": "Zstd threads. N=0 uses half of the available cores, if N is set to a value bigger than 0, N is used as thread count.",
                    "default": 1
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/backup/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_backup",
        "description": "Delete vzdump backup job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/backup/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_backup_included_volumes",
        "description": "Returns included guests and the backup status of their disks. Optimized to be used in ExtJS tree views.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/backup/{id}/included_volumes",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_backup-info",
        "description": "Index for backup info related endpoints",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/backup-info",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_backup-info_not-backed-up",
        "description": "Shows all guests which are not covered by any backup job.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/backup-info/not-backed-up",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ha",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ha",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ha_resources",
        "description": "List HA resources.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list resources of specific type",
                    "enum": [
                        "ct",
                        "vm"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/ha/resources",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_ha_resources",
        "description": "Create a new HA resource.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "failback": {
                    "type": "boolean",
                    "description": "Automatically migrate HA resource to the node with the highest priority according to their node affinity  rules, if a node with a higher priority than the current node comes online.",
                    "default": 1
                },
                "group": {
                    "type": "string",
                    "description": "The HA group identifier."
                },
                "max_relocate": {
                    "type": "number",
                    "description": "Maximal number of service relocate tries when a service failes to start.",
                    "default": 1
                },
                "max_restart": {
                    "type": "number",
                    "description": "Maximal number of tries to restart the service on a node after its start failed.",
                    "default": 1
                },
                "sid": {
                    "type": "string",
                    "description": "HA resource ID. This consists of a resource type followed by a resource specific name, separated with colon (example: vm:100 / ct:100). For virtual machines and containers, you can simply use the VM or CT id as a shortcut (example: 100)."
                },
                "state": {
                    "type": "string",
                    "description": "Requested resource state.",
                    "enum": [
                        "started",
                        "stopped",
                        "enabled",
                        "disabled",
                        "ignored"
                    ],
                    "default": "started"
                },
                "type": {
                    "type": "string",
                    "description": "Resource type.",
                    "enum": [
                        "ct",
                        "vm"
                    ]
                }
            },
            "required": [
                "sid"
            ]
        },
        "path": "/cluster/ha/resources",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_ha_resources",
        "description": "Read resource configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sid": {
                    "type": "string",
                    "description": "Path parameter: sid"
                }
            },
            "required": [
                "sid"
            ]
        },
        "path": "/cluster/ha/resources/{sid}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_ha_resources",
        "description": "Update resource configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sid": {
                    "type": "string",
                    "description": "Path parameter: sid"
                },
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "failback": {
                    "type": "boolean",
                    "description": "Automatically migrate HA resource to the node with the highest priority according to their node affinity  rules, if a node with a higher priority than the current node comes online.",
                    "default": 1
                },
                "group": {
                    "type": "string",
                    "description": "The HA group identifier."
                },
                "max_relocate": {
                    "type": "number",
                    "description": "Maximal number of service relocate tries when a service failes to start.",
                    "default": 1
                },
                "max_restart": {
                    "type": "number",
                    "description": "Maximal number of tries to restart the service on a node after its start failed.",
                    "default": 1
                },
                "state": {
                    "type": "string",
                    "description": "Requested resource state.",
                    "enum": [
                        "started",
                        "stopped",
                        "enabled",
                        "disabled",
                        "ignored"
                    ],
                    "default": "started"
                }
            },
            "required": [
                "sid"
            ]
        },
        "path": "/cluster/ha/resources/{sid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_ha_resources",
        "description": "Delete resource configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sid": {
                    "type": "string",
                    "description": "Path parameter: sid"
                },
                "purge": {
                    "type": "boolean",
                    "description": "Remove this resource from rules that reference it, deleting the rule if this resource is the only resource in the rule",
                    "default": 1
                }
            },
            "required": [
                "sid"
            ]
        },
        "path": "/cluster/ha/resources/{sid}",
        "method": "DELETE"
    },
    {
        "name": "pve_create_cluster_ha_resources_migrate",
        "description": "Request resource migration (online) to another node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sid": {
                    "type": "string",
                    "description": "Path parameter: sid"
                },
                "node": {
                    "type": "string",
                    "description": "Target node."
                }
            },
            "required": [
                "sid",
                "node"
            ]
        },
        "path": "/cluster/ha/resources/{sid}/migrate",
        "method": "POST"
    },
    {
        "name": "pve_create_cluster_ha_resources_relocate",
        "description": "Request resource relocatzion to another node. This stops the service on the old node, and restarts it on the target node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "sid": {
                    "type": "string",
                    "description": "Path parameter: sid"
                },
                "node": {
                    "type": "string",
                    "description": "Target node."
                }
            },
            "required": [
                "sid",
                "node"
            ]
        },
        "path": "/cluster/ha/resources/{sid}/relocate",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_ha_groups",
        "description": "Get HA groups. (deprecated in favor of HA rules)",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ha/groups",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_ha_groups",
        "description": "Create a new HA group. (deprecated in favor of HA rules)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "group": {
                    "type": "string",
                    "description": "The HA group identifier."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names with optional priority."
                },
                "nofailback": {
                    "type": "boolean",
                    "description": "The CRM tries to run services on the node with the highest priority. If a node with higher priority comes online, the CRM migrates the service to that node. Enabling nofailback prevents that behavior.",
                    "default": 0
                },
                "restricted": {
                    "type": "boolean",
                    "description": "Resources bound to restricted groups may only run on nodes defined by the group.",
                    "default": 0
                },
                "type": {
                    "type": "string",
                    "description": "Group type.",
                    "enum": [
                        "group"
                    ]
                }
            },
            "required": [
                "group",
                "nodes"
            ]
        },
        "path": "/cluster/ha/groups",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_ha_groups",
        "description": "Read ha group configuration. (deprecated in favor of HA rules)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/ha/groups/{group}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_ha_groups",
        "description": "Update ha group configuration. (deprecated in favor of HA rules)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                },
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names with optional priority."
                },
                "nofailback": {
                    "type": "boolean",
                    "description": "The CRM tries to run services on the node with the highest priority. If a node with higher priority comes online, the CRM migrates the service to that node. Enabling nofailback prevents that behavior.",
                    "default": 0
                },
                "restricted": {
                    "type": "boolean",
                    "description": "Resources bound to restricted groups may only run on nodes defined by the group.",
                    "default": 0
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/ha/groups/{group}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_ha_groups",
        "description": "Delete ha group configuration. (deprecated in favor of HA rules)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "group": {
                    "type": "string",
                    "description": "Path parameter: group"
                }
            },
            "required": [
                "group"
            ]
        },
        "path": "/cluster/ha/groups/{group}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_ha_rules",
        "description": "Get HA rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "resource": {
                    "type": "string",
                    "description": "Limit the returned list to rules affecting the specified resource."
                },
                "type": {
                    "type": "string",
                    "description": "Limit the returned list to the specified rule type.",
                    "enum": [
                        "node-affinity",
                        "resource-affinity"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/ha/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_ha_rules",
        "description": "Create HA rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "affinity": {
                    "type": "string",
                    "description": "Describes whether the HA resources are supposed to be kept on the same node ('positive'), or are supposed to be kept on separate nodes ('negative').",
                    "enum": [
                        "positive",
                        "negative"
                    ]
                },
                "comment": {
                    "type": "string",
                    "description": "HA rule description."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Whether the HA rule is disabled."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names with optional priority."
                },
                "resources": {
                    "type": "string",
                    "description": "List of HA resource IDs. This consists of a list of resource types followed by a resource specific name separated with a colon (example: vm:100,ct:101)."
                },
                "rule": {
                    "type": "string",
                    "description": "HA rule identifier."
                },
                "strict": {
                    "type": "boolean",
                    "description": "Describes whether the node affinity rule is strict or non-strict.",
                    "default": 0
                },
                "type": {
                    "type": "string",
                    "description": "HA rule type.",
                    "enum": [
                        "node-affinity",
                        "resource-affinity"
                    ]
                }
            },
            "required": [
                "resources",
                "rule",
                "type"
            ]
        },
        "path": "/cluster/ha/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_ha_rules",
        "description": "Read HA rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "rule": {
                    "type": "string",
                    "description": "Path parameter: rule"
                }
            },
            "required": [
                "rule"
            ]
        },
        "path": "/cluster/ha/rules/{rule}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_ha_rules",
        "description": "Update HA rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "rule": {
                    "type": "string",
                    "description": "Path parameter: rule"
                },
                "affinity": {
                    "type": "string",
                    "description": "Describes whether the HA resources are supposed to be kept on the same node ('positive'), or are supposed to be kept on separate nodes ('negative').",
                    "enum": [
                        "positive",
                        "negative"
                    ]
                },
                "comment": {
                    "type": "string",
                    "description": "HA rule description."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Whether the HA rule is disabled."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names with optional priority."
                },
                "resources": {
                    "type": "string",
                    "description": "List of HA resource IDs. This consists of a list of resource types followed by a resource specific name separated with a colon (example: vm:100,ct:101)."
                },
                "strict": {
                    "type": "boolean",
                    "description": "Describes whether the node affinity rule is strict or non-strict.",
                    "default": 0
                },
                "type": {
                    "type": "string",
                    "description": "HA rule type.",
                    "enum": [
                        "node-affinity",
                        "resource-affinity"
                    ]
                }
            },
            "required": [
                "rule",
                "type"
            ]
        },
        "path": "/cluster/ha/rules/{rule}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_ha_rules",
        "description": "Delete HA rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "rule": {
                    "type": "string",
                    "description": "Path parameter: rule"
                }
            },
            "required": [
                "rule"
            ]
        },
        "path": "/cluster/ha/rules/{rule}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_ha_status",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ha/status",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ha_status_current",
        "description": "Get HA manger status.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ha/status/current",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ha_status_manager_status",
        "description": "Get full HA manger status, including LRM status.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ha/status/manager_status",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_acme",
        "description": "ACMEAccount index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/acme",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_acme_plugins",
        "description": "ACME plugin index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list ACME plugins of a specific type",
                    "enum": [
                        "dns",
                        "standalone"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/acme/plugins",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_acme_plugins",
        "description": "Add ACME plugin configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "api": {
                    "type": "string",
                    "description": "API plugin name",
                    "enum": [
                        "1984hosting",
                        "acmedns",
                        "acmeproxy",
                        "active24",
                        "ad",
                        "ali",
                        "alviy",
                        "anx",
                        "artfiles",
                        "arvan",
                        "aurora",
                        "autodns",
                        "aws",
                        "azion",
                        "azure",
                        "beget",
                        "bookmyname",
                        "bunny",
                        "cf",
                        "clouddns",
                        "cloudns",
                        "cn",
                        "conoha",
                        "constellix",
                        "cpanel",
                        "curanet",
                        "cyon",
                        "da",
                        "ddnss",
                        "desec",
                        "df",
                        "dgon",
                        "dnsexit",
                        "dnshome",
                        "dnsimple",
                        "dnsservices",
                        "doapi",
                        "domeneshop",
                        "dp",
                        "dpi",
                        "dreamhost",
                        "duckdns",
                        "durabledns",
                        "dyn",
                        "dynu",
                        "dynv6",
                        "easydns",
                        "edgecenter",
                        "edgedns",
                        "euserv",
                        "exoscale",
                        "fornex",
                        "freedns",
                        "freemyip",
                        "gandi_livedns",
                        "gcloud",
                        "gcore",
                        "gd",
                        "geoscaling",
                        "googledomains",
                        "he",
                        "he_ddns",
                        "hetzner",
                        "hexonet",
                        "hostingde",
                        "huaweicloud",
                        "infoblox",
                        "infomaniak",
                        "internetbs",
                        "inwx",
                        "ionos",
                        "ionos_cloud",
                        "ipv64",
                        "ispconfig",
                        "jd",
                        "joker",
                        "kappernet",
                        "kas",
                        "kinghost",
                        "knot",
                        "la",
                        "leaseweb",
                        "lexicon",
                        "limacity",
                        "linode",
                        "linode_v4",
                        "loopia",
                        "lua",
                        "maradns",
                        "me",
                        "miab",
                        "mijnhost",
                        "misaka",
                        "myapi",
                        "mydevil",
                        "mydnsjp",
                        "mythic_beasts",
                        "namecheap",
                        "namecom",
                        "namesilo",
                        "nanelo",
                        "nederhost",
                        "neodigit",
                        "netcup",
                        "netlify",
                        "nic",
                        "njalla",
                        "nm",
                        "nsd",
                        "nsone",
                        "nsupdate",
                        "nw",
                        "oci",
                        "omglol",
                        "one",
                        "online",
                        "openprovider",
                        "openstack",
                        "opnsense",
                        "ovh",
                        "pdns",
                        "pleskxml",
                        "pointhq",
                        "porkbun",
                        "rackcorp",
                        "rackspace",
                        "rage4",
                        "rcode0",
                        "regru",
                        "scaleway",
                        "schlundtech",
                        "selectel",
                        "selfhost",
                        "servercow",
                        "simply",
                        "technitium",
                        "tele3",
                        "tencent",
                        "timeweb",
                        "transip",
                        "udr",
                        "ultra",
                        "unoeuro",
                        "variomedia",
                        "veesp",
                        "vercel",
                        "vscale",
                        "vultr",
                        "websupport",
                        "west_cn",
                        "world4you",
                        "yandex360",
                        "yc",
                        "zilore",
                        "zone",
                        "zoneedit",
                        "zonomi"
                    ]
                },
                "data": {
                    "type": "string",
                    "description": "DNS plugin data. (base64 encoded)"
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the config."
                },
                "id": {
                    "type": "string",
                    "description": "ACME Plugin ID name"
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "type": {
                    "type": "string",
                    "description": "ACME challenge type.",
                    "enum": [
                        "dns",
                        "standalone"
                    ]
                },
                "validation-delay": {
                    "type": "number",
                    "description": "Extra delay in seconds to wait before requesting validation. Allows to cope with a long TTL of DNS records.",
                    "default": 30
                }
            },
            "required": [
                "id",
                "type"
            ]
        },
        "path": "/cluster/acme/plugins",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_acme_plugins",
        "description": "Get ACME plugin configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/acme/plugins/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_acme_plugins",
        "description": "Update ACME plugin configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "api": {
                    "type": "string",
                    "description": "API plugin name",
                    "enum": [
                        "1984hosting",
                        "acmedns",
                        "acmeproxy",
                        "active24",
                        "ad",
                        "ali",
                        "alviy",
                        "anx",
                        "artfiles",
                        "arvan",
                        "aurora",
                        "autodns",
                        "aws",
                        "azion",
                        "azure",
                        "beget",
                        "bookmyname",
                        "bunny",
                        "cf",
                        "clouddns",
                        "cloudns",
                        "cn",
                        "conoha",
                        "constellix",
                        "cpanel",
                        "curanet",
                        "cyon",
                        "da",
                        "ddnss",
                        "desec",
                        "df",
                        "dgon",
                        "dnsexit",
                        "dnshome",
                        "dnsimple",
                        "dnsservices",
                        "doapi",
                        "domeneshop",
                        "dp",
                        "dpi",
                        "dreamhost",
                        "duckdns",
                        "durabledns",
                        "dyn",
                        "dynu",
                        "dynv6",
                        "easydns",
                        "edgecenter",
                        "edgedns",
                        "euserv",
                        "exoscale",
                        "fornex",
                        "freedns",
                        "freemyip",
                        "gandi_livedns",
                        "gcloud",
                        "gcore",
                        "gd",
                        "geoscaling",
                        "googledomains",
                        "he",
                        "he_ddns",
                        "hetzner",
                        "hexonet",
                        "hostingde",
                        "huaweicloud",
                        "infoblox",
                        "infomaniak",
                        "internetbs",
                        "inwx",
                        "ionos",
                        "ionos_cloud",
                        "ipv64",
                        "ispconfig",
                        "jd",
                        "joker",
                        "kappernet",
                        "kas",
                        "kinghost",
                        "knot",
                        "la",
                        "leaseweb",
                        "lexicon",
                        "limacity",
                        "linode",
                        "linode_v4",
                        "loopia",
                        "lua",
                        "maradns",
                        "me",
                        "miab",
                        "mijnhost",
                        "misaka",
                        "myapi",
                        "mydevil",
                        "mydnsjp",
                        "mythic_beasts",
                        "namecheap",
                        "namecom",
                        "namesilo",
                        "nanelo",
                        "nederhost",
                        "neodigit",
                        "netcup",
                        "netlify",
                        "nic",
                        "njalla",
                        "nm",
                        "nsd",
                        "nsone",
                        "nsupdate",
                        "nw",
                        "oci",
                        "omglol",
                        "one",
                        "online",
                        "openprovider",
                        "openstack",
                        "opnsense",
                        "ovh",
                        "pdns",
                        "pleskxml",
                        "pointhq",
                        "porkbun",
                        "rackcorp",
                        "rackspace",
                        "rage4",
                        "rcode0",
                        "regru",
                        "scaleway",
                        "schlundtech",
                        "selectel",
                        "selfhost",
                        "servercow",
                        "simply",
                        "technitium",
                        "tele3",
                        "tencent",
                        "timeweb",
                        "transip",
                        "udr",
                        "ultra",
                        "unoeuro",
                        "variomedia",
                        "veesp",
                        "vercel",
                        "vscale",
                        "vultr",
                        "websupport",
                        "west_cn",
                        "world4you",
                        "yandex360",
                        "yc",
                        "zilore",
                        "zone",
                        "zoneedit",
                        "zonomi"
                    ]
                },
                "data": {
                    "type": "string",
                    "description": "DNS plugin data. (base64 encoded)"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the config."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "validation-delay": {
                    "type": "number",
                    "description": "Extra delay in seconds to wait before requesting validation. Allows to cope with a long TTL of DNS records.",
                    "default": 30
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/acme/plugins/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_acme_plugins",
        "description": "Delete ACME plugin configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/acme/plugins/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_acme_account",
        "description": "ACMEAccount index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/acme/account",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_acme_account",
        "description": "Register a new ACME account with CA.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "contact": {
                    "type": "string",
                    "description": "Contact email addresses."
                },
                "directory": {
                    "type": "string",
                    "description": "URL of ACME CA directory endpoint.",
                    "default": "https://acme-v02.api.letsencrypt.org/directory"
                },
                "eab-hmac-key": {
                    "type": "string",
                    "description": "HMAC key for External Account Binding."
                },
                "eab-kid": {
                    "type": "string",
                    "description": "Key Identifier for External Account Binding."
                },
                "name": {
                    "type": "string",
                    "description": "ACME account config file name.",
                    "default": "default"
                },
                "tos_url": {
                    "type": "string",
                    "description": "URL of CA TermsOfService - setting this indicates agreement."
                }
            },
            "required": [
                "contact"
            ]
        },
        "path": "/cluster/acme/account",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_acme_account",
        "description": "Return existing ACME account information.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/acme/account/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_acme_account",
        "description": "Update existing ACME account information with CA. Note: not specifying any new account information triggers a refresh.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "contact": {
                    "type": "string",
                    "description": "Contact email addresses."
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/acme/account/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_acme_account",
        "description": "Deactivate existing ACME account at CA.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "name"
            ]
        },
        "path": "/cluster/acme/account/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_acme_tos",
        "description": "Retrieve ACME TermsOfService URL from CA. Deprecated, please use /cluster/acme/meta.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "URL of ACME CA directory endpoint.",
                    "default": "https://acme-v02.api.letsencrypt.org/directory"
                }
            },
            "required": []
        },
        "path": "/cluster/acme/tos",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_acme_meta",
        "description": "Retrieve ACME Directory Meta Information",
        "inputSchema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "URL of ACME CA directory endpoint.",
                    "default": "https://acme-v02.api.letsencrypt.org/directory"
                }
            },
            "required": []
        },
        "path": "/cluster/acme/meta",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_acme_directories",
        "description": "Get named known ACME directory endpoints.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/acme/directories",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_acme_challenge-schema",
        "description": "Get schema of ACME challenge types.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/acme/challenge-schema",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ceph",
        "description": "Cluster ceph index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ceph",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ceph_metadata",
        "description": "Get ceph metadata.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "scope": {
                    "type": "string",
                    "description": "scope",
                    "enum": [
                        "all",
                        "versions"
                    ],
                    "default": "all"
                }
            },
            "required": []
        },
        "path": "/cluster/ceph/metadata",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ceph_status",
        "description": "Get ceph status.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ceph/status",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_ceph_flags",
        "description": "get the status of all ceph flags",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/ceph/flags",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_ceph_flags_flags",
        "description": "Set/Unset multiple ceph flags at once.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "nobackfill": {
                    "type": "boolean",
                    "description": "Backfilling of PGs is suspended."
                },
                "nodeep-scrub": {
                    "type": "boolean",
                    "description": "Deep Scrubbing is disabled."
                },
                "nodown": {
                    "type": "boolean",
                    "description": "OSD failure reports are being ignored, such that the monitors will not mark OSDs down."
                },
                "noin": {
                    "type": "boolean",
                    "description": "OSDs that were previously marked out will not be marked back in when they start."
                },
                "noout": {
                    "type": "boolean",
                    "description": "OSDs will not automatically be marked out after the configured interval."
                },
                "norebalance": {
                    "type": "boolean",
                    "description": "Rebalancing of PGs is suspended."
                },
                "norecover": {
                    "type": "boolean",
                    "description": "Recovery of PGs is suspended."
                },
                "noscrub": {
                    "type": "boolean",
                    "description": "Scrubbing is disabled."
                },
                "notieragent": {
                    "type": "boolean",
                    "description": "Cache tiering activity is suspended."
                },
                "noup": {
                    "type": "boolean",
                    "description": "OSDs are not allowed to start."
                },
                "pause": {
                    "type": "boolean",
                    "description": "Pauses read and writes."
                }
            },
            "required": []
        },
        "path": "/cluster/ceph/flags",
        "method": "PUT"
    },
    {
        "name": "pve_get_cluster_ceph_flags",
        "description": "Get the status of a specific ceph flag.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "flag": {
                    "type": "string",
                    "description": "Path parameter: flag"
                }
            },
            "required": [
                "flag"
            ]
        },
        "path": "/cluster/ceph/flags/{flag}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_ceph_flags_flags",
        "description": "Set or clear (unset) a specific ceph flag",
        "inputSchema": {
            "type": "object",
            "properties": {
                "flag": {
                    "type": "string",
                    "description": "Path parameter: flag"
                },
                "value": {
                    "type": "boolean",
                    "description": "The new value of the flag"
                }
            },
            "required": [
                "flag",
                "value"
            ]
        },
        "path": "/cluster/ceph/flags/{flag}",
        "method": "PUT"
    },
    {
        "name": "pve_list_cluster_jobs",
        "description": "Index for jobs related endpoints.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/jobs",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_jobs_realm-sync",
        "description": "List configured realm-sync-jobs.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/jobs/realm-sync",
        "method": "GET"
    },
    {
        "name": "pve_get_cluster_jobs_realm-sync",
        "description": "Read realm-sync job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/jobs/realm-sync/{id}",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_jobs_realm-sync",
        "description": "Create new realm-sync job.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "comment": {
                    "type": "string",
                    "description": "Description for the Job."
                },
                "enable-new": {
                    "type": "boolean",
                    "description": "Enable newly synced users immediately.",
                    "default": "1"
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Determines if the job is enabled.",
                    "default": 1
                },
                "realm": {
                    "type": "string",
                    "description": "Authentication domain ID"
                },
                "remove-vanished": {
                    "type": "string",
                    "description": "A semicolon-separated list of things to remove when they or the user vanishes during a sync. The following values are possible: 'entry' removes the user/group when not returned from the sync. 'properties' removes the set properties on existing user/group that do not appear in the source (even custom",
                    "default": "none"
                },
                "schedule": {
                    "type": "string",
                    "description": "Backup schedule. The format is a subset of `systemd` calendar events."
                },
                "scope": {
                    "type": "string",
                    "description": "Select what to sync.",
                    "enum": [
                        "users",
                        "groups",
                        "both"
                    ]
                }
            },
            "required": [
                "id",
                "schedule"
            ]
        },
        "path": "/cluster/jobs/realm-sync/{id}",
        "method": "POST"
    },
    {
        "name": "pve_update_cluster_jobs_realm-sync",
        "description": "Update realm-sync job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "comment": {
                    "type": "string",
                    "description": "Description for the Job."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "enable-new": {
                    "type": "boolean",
                    "description": "Enable newly synced users immediately.",
                    "default": "1"
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Determines if the job is enabled.",
                    "default": 1
                },
                "remove-vanished": {
                    "type": "string",
                    "description": "A semicolon-separated list of things to remove when they or the user vanishes during a sync. The following values are possible: 'entry' removes the user/group when not returned from the sync. 'properties' removes the set properties on existing user/group that do not appear in the source (even custom",
                    "default": "none"
                },
                "schedule": {
                    "type": "string",
                    "description": "Backup schedule. The format is a subset of `systemd` calendar events."
                },
                "scope": {
                    "type": "string",
                    "description": "Select what to sync.",
                    "enum": [
                        "users",
                        "groups",
                        "both"
                    ]
                }
            },
            "required": [
                "id",
                "schedule"
            ]
        },
        "path": "/cluster/jobs/realm-sync/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_jobs_realm-sync",
        "description": "Delete realm-sync job definition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/jobs/realm-sync/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_jobs_schedule-analyze",
        "description": "Returns a list of future schedule runtimes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "iterations": {
                    "type": "number",
                    "description": "Number of event-iteration to simulate and return.",
                    "default": 10
                },
                "schedule": {
                    "type": "string",
                    "description": "Job schedule. The format is a subset of `systemd` calendar events."
                },
                "starttime": {
                    "type": "number",
                    "description": "UNIX timestamp to start the calculation from. Defaults to the current time."
                }
            },
            "required": [
                "schedule"
            ]
        },
        "path": "/cluster/jobs/schedule-analyze",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_mapping",
        "description": "List resource types.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/mapping",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_mapping_dir",
        "description": "List directory mapping",
        "inputSchema": {
            "type": "object",
            "properties": {
                "check-node": {
                    "type": "string",
                    "description": "If given, checks the configurations on the given node for correctness, and adds relevant diagnostics for the directory to the response."
                }
            },
            "required": []
        },
        "path": "/cluster/mapping/dir",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_mapping_dir",
        "description": "Create a new directory mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the directory mapping"
                },
                "id": {
                    "type": "string",
                    "description": "The ID of the directory mapping"
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                }
            },
            "required": [
                "id",
                "map"
            ]
        },
        "path": "/cluster/mapping/dir",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_mapping_dir",
        "description": "Get directory mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/dir/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_mapping_dir",
        "description": "Update a directory mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description of the directory mapping"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/dir/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_mapping_dir",
        "description": "Remove directory mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/dir/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_mapping_pci",
        "description": "List PCI Hardware Mapping",
        "inputSchema": {
            "type": "object",
            "properties": {
                "check-node": {
                    "type": "string",
                    "description": "If given, checks the configurations on the given node for correctness, and adds relevant diagnostics for the devices to the response."
                }
            },
            "required": []
        },
        "path": "/cluster/mapping/pci",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_mapping_pci",
        "description": "Create a new hardware mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the logical PCI device."
                },
                "id": {
                    "type": "string",
                    "description": "The ID of the logical PCI mapping."
                },
                "live-migration-capable": {
                    "type": "boolean",
                    "description": "Marks the device(s) as being able to be live-migrated (Experimental). This needs hardware and driver support to work.",
                    "default": 0
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                },
                "mdev": {
                    "type": "boolean",
                    "description": "Marks the device(s) as being capable of providing mediated devices.",
                    "default": 0
                }
            },
            "required": [
                "id",
                "map"
            ]
        },
        "path": "/cluster/mapping/pci",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_mapping_pci",
        "description": "Get PCI Mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/pci/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_mapping_pci",
        "description": "Update a hardware mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description of the logical PCI device."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "live-migration-capable": {
                    "type": "boolean",
                    "description": "Marks the device(s) as being able to be live-migrated (Experimental). This needs hardware and driver support to work.",
                    "default": 0
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                },
                "mdev": {
                    "type": "boolean",
                    "description": "Marks the device(s) as being capable of providing mediated devices.",
                    "default": 0
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/pci/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_mapping_pci",
        "description": "Remove Hardware Mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/pci/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_mapping_usb",
        "description": "List USB Hardware Mappings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "check-node": {
                    "type": "string",
                    "description": "If given, checks the configurations on the given node for correctness, and adds relevant errors to the devices."
                }
            },
            "required": []
        },
        "path": "/cluster/mapping/usb",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_mapping_usb",
        "description": "Create a new hardware mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Description of the logical USB device."
                },
                "id": {
                    "type": "string",
                    "description": "The ID of the logical USB mapping."
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                }
            },
            "required": [
                "id",
                "map"
            ]
        },
        "path": "/cluster/mapping/usb",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_mapping_usb",
        "description": "Get USB Mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/usb/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_mapping_usb",
        "description": "Update a hardware mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description of the logical USB device."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "map": {
                    "type": "array",
                    "description": "A list of maps for the cluster nodes."
                }
            },
            "required": [
                "id",
                "map"
            ]
        },
        "path": "/cluster/mapping/usb/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_mapping_usb",
        "description": "Remove Hardware Mapping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/mapping/usb/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_bulk-action",
        "description": "List resource types.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/bulk-action",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_bulk-action_guest",
        "description": "Bulk action index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/bulk-action/guest",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_bulk-action_guest_start",
        "description": "Bulk start or resume all guests on the cluster.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "maxworkers": {
                    "type": "number",
                    "description": "How many parallel tasks at maximum should be started.",
                    "default": 1
                },
                "timeout": {
                    "type": "number",
                    "description": "Default start timeout in seconds. Only valid for VMs. (default depends on the guest configuration)."
                },
                "vms": {
                    "type": "array",
                    "description": "Only consider guests from this list of VMIDs."
                }
            },
            "required": []
        },
        "path": "/cluster/bulk-action/guest/start",
        "method": "POST"
    },
    {
        "name": "pve_create_cluster_bulk-action_guest_shutdown",
        "description": "Bulk shutdown all guests on the cluster.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "force-stop": {
                    "type": "boolean",
                    "description": "Makes sure the Guest stops after the timeout.",
                    "default": 1
                },
                "maxworkers": {
                    "type": "number",
                    "description": "How many parallel tasks at maximum should be started.",
                    "default": 1
                },
                "timeout": {
                    "type": "number",
                    "description": "Default shutdown timeout in seconds if none is configured for the guest.",
                    "default": 180
                },
                "vms": {
                    "type": "array",
                    "description": "Only consider guests from this list of VMIDs."
                }
            },
            "required": []
        },
        "path": "/cluster/bulk-action/guest/shutdown",
        "method": "POST"
    },
    {
        "name": "pve_create_cluster_bulk-action_guest_suspend",
        "description": "Bulk suspend all guests on the cluster.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "maxworkers": {
                    "type": "number",
                    "description": "How many parallel tasks at maximum should be started.",
                    "default": 1
                },
                "statestorage": {
                    "type": "string",
                    "description": "The storage for the VM state."
                },
                "to-disk": {
                    "type": "boolean",
                    "description": "If set, suspends the guests to disk. Will be resumed on next start.",
                    "default": 0
                },
                "vms": {
                    "type": "array",
                    "description": "Only consider guests from this list of VMIDs."
                }
            },
            "required": []
        },
        "path": "/cluster/bulk-action/guest/suspend",
        "method": "POST"
    },
    {
        "name": "pve_create_cluster_bulk-action_guest_migrate",
        "description": "Bulk migrate all guests on the cluster.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "maxworkers": {
                    "type": "number",
                    "description": "How many parallel tasks at maximum should be started.",
                    "default": 1
                },
                "online": {
                    "type": "boolean",
                    "description": "Enable live migration for VMs and restart migration for CTs."
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                },
                "vms": {
                    "type": "array",
                    "description": "Only consider guests from this list of VMIDs."
                },
                "with-local-disks": {
                    "type": "boolean",
                    "description": "Enable live storage migration for local disk"
                }
            },
            "required": [
                "target"
            ]
        },
        "path": "/cluster/bulk-action/guest/migrate",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_sdn",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/sdn",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn",
        "description": "Apply sdn controller changes && reload.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "release-lock": {
                    "type": "boolean",
                    "description": "When lock-token has been provided and configuration successfully commited, release the lock automatically afterwards",
                    "default": 1
                }
            },
            "required": []
        },
        "path": "/cluster/sdn",
        "method": "PUT"
    },
    {
        "name": "pve_list_cluster_sdn_vnets",
        "description": "SDN vnets index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/vnets",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_vnets",
        "description": "Create a new sdn vnet object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "alias": {
                    "type": "string",
                    "description": "Alias name of the VNet."
                },
                "isolate-ports": {
                    "type": "boolean",
                    "description": "If true, sets the isolated property for all interfaces on the bridge of this VNet."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "tag": {
                    "type": "number",
                    "description": "VLAN Tag (for VLAN or QinQ zones) or VXLAN VNI (for VXLAN or EVPN zones)."
                },
                "type": {
                    "type": "string",
                    "description": "Type of the VNet.",
                    "enum": [
                        "vnet"
                    ]
                },
                "vlanaware": {
                    "type": "boolean",
                    "description": "Allow VLANs to pass through this vnet."
                },
                "vnet": {
                    "type": "string",
                    "description": "The SDN vnet object identifier."
                },
                "zone": {
                    "type": "string",
                    "description": "Name of the zone this VNet belongs to."
                }
            },
            "required": [
                "vnet",
                "zone"
            ]
        },
        "path": "/cluster/sdn/vnets",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_vnets",
        "description": "Read sdn vnet configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_vnets",
        "description": "Update sdn vnet object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "alias": {
                    "type": "string",
                    "description": "Alias name of the VNet."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "isolate-ports": {
                    "type": "boolean",
                    "description": "If true, sets the isolated property for all interfaces on the bridge of this VNet."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "tag": {
                    "type": "number",
                    "description": "VLAN Tag (for VLAN or QinQ zones) or VXLAN VNI (for VXLAN or EVPN zones)."
                },
                "vlanaware": {
                    "type": "boolean",
                    "description": "Allow VLANs to pass through this vnet."
                },
                "zone": {
                    "type": "string",
                    "description": "Name of the zone this VNet belongs to."
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_vnets",
        "description": "Delete sdn vnet object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_firewall",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall",
        "method": "GET"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_firewall_rules_rules",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_vnets_firewall_rules",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "vnet",
                "action",
                "type"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_firewall_rules_rules",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "vnet",
                "pos"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/rules/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_vnets_firewall_rules",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "vnet",
                "pos"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/rules/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_vnets_firewall_rules",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "vnet",
                "pos"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/rules/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_firewall_options",
        "description": "Get vnet firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/options",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_vnets_firewall_options",
        "description": "Set Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable/disable firewall rules.",
                    "default": 0
                },
                "log_level_forward": {
                    "type": "string",
                    "description": "Log level for forwarded traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "policy_forward": {
                    "type": "string",
                    "description": "Forward policy.",
                    "enum": [
                        "ACCEPT",
                        "DROP"
                    ]
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/firewall/options",
        "method": "PUT"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_subnets_subnets",
        "description": "SDN subnets index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "vnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/subnets",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_vnets_subnets",
        "description": "Create a new sdn subnet object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "dhcp-dns-server": {
                    "type": "string",
                    "description": "IP address for the DNS server"
                },
                "dhcp-range": {
                    "type": "array",
                    "description": "A list of DHCP ranges for this subnet"
                },
                "dnszoneprefix": {
                    "type": "string",
                    "description": "dns domain zone prefix  ex: 'adm' -> <hostname>.adm.mydomain.com"
                },
                "gateway": {
                    "type": "string",
                    "description": "Subnet Gateway: Will be assign on vnet for layer3 zones"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "snat": {
                    "type": "boolean",
                    "description": "enable masquerade for this subnet if pve-firewall"
                },
                "subnet": {
                    "type": "string",
                    "description": "The SDN subnet object identifier."
                },
                "type": {
                    "type": "string",
                    "description": "type",
                    "enum": [
                        "subnet"
                    ]
                }
            },
            "required": [
                "vnet",
                "subnet",
                "type"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/subnets",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_vnets_subnets_subnets",
        "description": "Read sdn subnet configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "subnet": {
                    "type": "string",
                    "description": "Path parameter: subnet"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "vnet",
                "subnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/subnets/{subnet}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_vnets_subnets",
        "description": "Update sdn subnet object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "subnet": {
                    "type": "string",
                    "description": "Path parameter: subnet"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dhcp-dns-server": {
                    "type": "string",
                    "description": "IP address for the DNS server"
                },
                "dhcp-range": {
                    "type": "array",
                    "description": "A list of DHCP ranges for this subnet"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dnszoneprefix": {
                    "type": "string",
                    "description": "dns domain zone prefix  ex: 'adm' -> <hostname>.adm.mydomain.com"
                },
                "gateway": {
                    "type": "string",
                    "description": "Subnet Gateway: Will be assign on vnet for layer3 zones"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "snat": {
                    "type": "boolean",
                    "description": "enable masquerade for this subnet if pve-firewall"
                }
            },
            "required": [
                "vnet",
                "subnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/subnets/{subnet}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_vnets_subnets",
        "description": "Delete sdn subnet object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "subnet": {
                    "type": "string",
                    "description": "Path parameter: subnet"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "vnet",
                "subnet"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/subnets/{subnet}",
        "method": "DELETE"
    },
    {
        "name": "pve_create_cluster_sdn_vnets_ips",
        "description": "Create IP Mapping in a VNet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "ip": {
                    "type": "string",
                    "description": "The IP address to associate with the given MAC address"
                },
                "mac": {
                    "type": "string",
                    "description": "Unicast MAC address."
                },
                "zone": {
                    "type": "string",
                    "description": "The SDN zone object identifier."
                }
            },
            "required": [
                "vnet",
                "ip",
                "zone"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/ips",
        "method": "POST"
    },
    {
        "name": "pve_update_cluster_sdn_vnets_ips",
        "description": "Update IP Mapping in a VNet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "ip": {
                    "type": "string",
                    "description": "The IP address to associate with the given MAC address"
                },
                "mac": {
                    "type": "string",
                    "description": "Unicast MAC address."
                },
                "vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                },
                "zone": {
                    "type": "string",
                    "description": "The SDN zone object identifier."
                }
            },
            "required": [
                "vnet",
                "ip",
                "zone"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/ips",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_vnets_ips",
        "description": "Delete IP Mappings in a VNet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                },
                "ip": {
                    "type": "string",
                    "description": "The IP address to delete"
                },
                "mac": {
                    "type": "string",
                    "description": "Unicast MAC address."
                },
                "zone": {
                    "type": "string",
                    "description": "The SDN zone object identifier."
                }
            },
            "required": [
                "vnet",
                "ip",
                "zone"
            ]
        },
        "path": "/cluster/sdn/vnets/{vnet}/ips",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_zones",
        "description": "SDN zones index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                },
                "type": {
                    "type": "string",
                    "description": "Only list SDN zones of specific type",
                    "enum": [
                        "evpn",
                        "faucet",
                        "qinq",
                        "simple",
                        "vlan",
                        "vxlan"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/zones",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_zones",
        "description": "Create a new sdn zone object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "advertise-subnets": {
                    "type": "boolean",
                    "description": "Advertise IP prefixes (Type-5 routes) instead of MAC/IP pairs (Type-2 routes)."
                },
                "bridge": {
                    "type": "string",
                    "description": "The bridge for which VLANs should be managed."
                },
                "bridge-disable-mac-learning": {
                    "type": "boolean",
                    "description": "Disable auto mac learning."
                },
                "controller": {
                    "type": "string",
                    "description": "Controller for this zone."
                },
                "dhcp": {
                    "type": "string",
                    "description": "Type of the DHCP backend for this zone",
                    "enum": [
                        "dnsmasq"
                    ]
                },
                "disable-arp-nd-suppression": {
                    "type": "boolean",
                    "description": "Suppress IPv4 ARP && IPv6 Neighbour Discovery messages."
                },
                "dns": {
                    "type": "string",
                    "description": "dns api server"
                },
                "dnszone": {
                    "type": "string",
                    "description": "dns domain zone  ex: mydomain.com"
                },
                "dp-id": {
                    "type": "number",
                    "description": "Faucet dataplane id"
                },
                "exitnodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "exitnodes-local-routing": {
                    "type": "boolean",
                    "description": "Allow exitnodes to connect to EVPN guests."
                },
                "exitnodes-primary": {
                    "type": "string",
                    "description": "Force traffic through this exitnode first."
                },
                "fabric": {
                    "type": "string",
                    "description": "SDN fabric to use as underlay for this VXLAN zone."
                },
                "ipam": {
                    "type": "string",
                    "description": "use a specific ipam"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "mac": {
                    "type": "string",
                    "description": "Anycast logical router mac address."
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU of the zone, will be used for the created VNet bridges."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "peers": {
                    "type": "string",
                    "description": "Comma-separated list of peers, that are part of the VXLAN zone. Usually the IPs of the nodes."
                },
                "reversedns": {
                    "type": "string",
                    "description": "reverse dns api server"
                },
                "rt-import": {
                    "type": "string",
                    "description": "List of Route Targets that should be imported into the VRF of the zone."
                },
                "tag": {
                    "type": "number",
                    "description": "Service-VLAN Tag (outer VLAN)"
                },
                "type": {
                    "type": "string",
                    "description": "Plugin type.",
                    "enum": [
                        "evpn",
                        "faucet",
                        "qinq",
                        "simple",
                        "vlan",
                        "vxlan"
                    ]
                },
                "vlan-protocol": {
                    "type": "string",
                    "description": "Which VLAN protocol should be used for the creation of the QinQ zone.",
                    "enum": [
                        "802.1q",
                        "802.1ad"
                    ],
                    "default": "802.1q"
                },
                "vrf-vxlan": {
                    "type": "number",
                    "description": "VNI for the zone VRF."
                },
                "vxlan-port": {
                    "type": "number",
                    "description": "UDP port that should be used for the VXLAN tunnel (default 4789).",
                    "default": 4789
                },
                "zone": {
                    "type": "string",
                    "description": "The SDN zone object identifier."
                }
            },
            "required": [
                "type",
                "zone"
            ]
        },
        "path": "/cluster/sdn/zones",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_zones",
        "description": "Read sdn zone configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "zone"
            ]
        },
        "path": "/cluster/sdn/zones/{zone}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_zones",
        "description": "Update sdn zone object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                },
                "advertise-subnets": {
                    "type": "boolean",
                    "description": "Advertise IP prefixes (Type-5 routes) instead of MAC/IP pairs (Type-2 routes)."
                },
                "bridge": {
                    "type": "string",
                    "description": "The bridge for which VLANs should be managed."
                },
                "bridge-disable-mac-learning": {
                    "type": "boolean",
                    "description": "Disable auto mac learning."
                },
                "controller": {
                    "type": "string",
                    "description": "Controller for this zone."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dhcp": {
                    "type": "string",
                    "description": "Type of the DHCP backend for this zone",
                    "enum": [
                        "dnsmasq"
                    ]
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable-arp-nd-suppression": {
                    "type": "boolean",
                    "description": "Suppress IPv4 ARP && IPv6 Neighbour Discovery messages."
                },
                "dns": {
                    "type": "string",
                    "description": "dns api server"
                },
                "dnszone": {
                    "type": "string",
                    "description": "dns domain zone  ex: mydomain.com"
                },
                "dp-id": {
                    "type": "number",
                    "description": "Faucet dataplane id"
                },
                "exitnodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "exitnodes-local-routing": {
                    "type": "boolean",
                    "description": "Allow exitnodes to connect to EVPN guests."
                },
                "exitnodes-primary": {
                    "type": "string",
                    "description": "Force traffic through this exitnode first."
                },
                "fabric": {
                    "type": "string",
                    "description": "SDN fabric to use as underlay for this VXLAN zone."
                },
                "ipam": {
                    "type": "string",
                    "description": "use a specific ipam"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "mac": {
                    "type": "string",
                    "description": "Anycast logical router mac address."
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU of the zone, will be used for the created VNet bridges."
                },
                "nodes": {
                    "type": "string",
                    "description": "List of cluster node names."
                },
                "peers": {
                    "type": "string",
                    "description": "Comma-separated list of peers, that are part of the VXLAN zone. Usually the IPs of the nodes."
                },
                "reversedns": {
                    "type": "string",
                    "description": "reverse dns api server"
                },
                "rt-import": {
                    "type": "string",
                    "description": "List of Route Targets that should be imported into the VRF of the zone."
                },
                "tag": {
                    "type": "number",
                    "description": "Service-VLAN Tag (outer VLAN)"
                },
                "vlan-protocol": {
                    "type": "string",
                    "description": "Which VLAN protocol should be used for the creation of the QinQ zone.",
                    "enum": [
                        "802.1q",
                        "802.1ad"
                    ],
                    "default": "802.1q"
                },
                "vrf-vxlan": {
                    "type": "number",
                    "description": "VNI for the zone VRF."
                },
                "vxlan-port": {
                    "type": "number",
                    "description": "UDP port that should be used for the VXLAN tunnel (default 4789).",
                    "default": 4789
                }
            },
            "required": [
                "zone"
            ]
        },
        "path": "/cluster/sdn/zones/{zone}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_zones",
        "description": "Delete sdn zone object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "zone"
            ]
        },
        "path": "/cluster/sdn/zones/{zone}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_controllers",
        "description": "SDN controllers index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                },
                "type": {
                    "type": "string",
                    "description": "Only list sdn controllers of specific type",
                    "enum": [
                        "bgp",
                        "evpn",
                        "faucet",
                        "isis"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/controllers",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_controllers",
        "description": "Create a new sdn controller object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "asn": {
                    "type": "number",
                    "description": "autonomous system number"
                },
                "bgp-multipath-as-path-relax": {
                    "type": "boolean",
                    "description": "Consider different AS paths of equal length for multipath computation."
                },
                "controller": {
                    "type": "string",
                    "description": "The SDN controller object identifier."
                },
                "ebgp": {
                    "type": "boolean",
                    "description": "Enable eBGP (remote-as external)."
                },
                "ebgp-multihop": {
                    "type": "number",
                    "description": "Set maximum amount of hops for eBGP peers."
                },
                "fabric": {
                    "type": "string",
                    "description": "SDN fabric to use as underlay for this EVPN controller."
                },
                "isis-domain": {
                    "type": "string",
                    "description": "Name of the IS-IS domain."
                },
                "isis-ifaces": {
                    "type": "string",
                    "description": "Comma-separated list of interfaces where IS-IS should be active."
                },
                "isis-net": {
                    "type": "string",
                    "description": "Network Entity title for this node in the IS-IS network."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "loopback": {
                    "type": "string",
                    "description": "Name of the loopback/dummy interface that provides the Router-IP."
                },
                "node": {
                    "type": "string",
                    "description": "The cluster node name."
                },
                "peers": {
                    "type": "string",
                    "description": "peers address list."
                },
                "type": {
                    "type": "string",
                    "description": "Plugin type.",
                    "enum": [
                        "bgp",
                        "evpn",
                        "faucet",
                        "isis"
                    ]
                }
            },
            "required": [
                "controller",
                "type"
            ]
        },
        "path": "/cluster/sdn/controllers",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_controllers",
        "description": "Read sdn controller configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "controller": {
                    "type": "string",
                    "description": "Path parameter: controller"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "controller"
            ]
        },
        "path": "/cluster/sdn/controllers/{controller}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_controllers",
        "description": "Update sdn controller object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "controller": {
                    "type": "string",
                    "description": "Path parameter: controller"
                },
                "asn": {
                    "type": "number",
                    "description": "autonomous system number"
                },
                "bgp-multipath-as-path-relax": {
                    "type": "boolean",
                    "description": "Consider different AS paths of equal length for multipath computation."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "ebgp": {
                    "type": "boolean",
                    "description": "Enable eBGP (remote-as external)."
                },
                "ebgp-multihop": {
                    "type": "number",
                    "description": "Set maximum amount of hops for eBGP peers."
                },
                "fabric": {
                    "type": "string",
                    "description": "SDN fabric to use as underlay for this EVPN controller."
                },
                "isis-domain": {
                    "type": "string",
                    "description": "Name of the IS-IS domain."
                },
                "isis-ifaces": {
                    "type": "string",
                    "description": "Comma-separated list of interfaces where IS-IS should be active."
                },
                "isis-net": {
                    "type": "string",
                    "description": "Network Entity title for this node in the IS-IS network."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "loopback": {
                    "type": "string",
                    "description": "Name of the loopback/dummy interface that provides the Router-IP."
                },
                "node": {
                    "type": "string",
                    "description": "The cluster node name."
                },
                "peers": {
                    "type": "string",
                    "description": "peers address list."
                }
            },
            "required": [
                "controller"
            ]
        },
        "path": "/cluster/sdn/controllers/{controller}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_controllers",
        "description": "Delete sdn controller object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "controller": {
                    "type": "string",
                    "description": "Path parameter: controller"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "controller"
            ]
        },
        "path": "/cluster/sdn/controllers/{controller}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_ipams",
        "description": "SDN ipams index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list sdn ipams of specific type",
                    "enum": [
                        "netbox",
                        "phpipam",
                        "pve"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/ipams",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_ipams",
        "description": "Create a new sdn ipam object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "ipam": {
                    "type": "string",
                    "description": "The SDN ipam object identifier."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "section": {
                    "type": "number",
                    "description": "section"
                },
                "token": {
                    "type": "string",
                    "description": "token"
                },
                "type": {
                    "type": "string",
                    "description": "Plugin type.",
                    "enum": [
                        "netbox",
                        "phpipam",
                        "pve"
                    ]
                },
                "url": {
                    "type": "string",
                    "description": "url"
                }
            },
            "required": [
                "ipam",
                "type"
            ]
        },
        "path": "/cluster/sdn/ipams",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_ipams",
        "description": "Read sdn ipam configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ipam": {
                    "type": "string",
                    "description": "Path parameter: ipam"
                }
            },
            "required": [
                "ipam"
            ]
        },
        "path": "/cluster/sdn/ipams/{ipam}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_ipams",
        "description": "Update sdn ipam object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ipam": {
                    "type": "string",
                    "description": "Path parameter: ipam"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "section": {
                    "type": "number",
                    "description": "section"
                },
                "token": {
                    "type": "string",
                    "description": "token"
                },
                "url": {
                    "type": "string",
                    "description": "url"
                }
            },
            "required": [
                "ipam"
            ]
        },
        "path": "/cluster/sdn/ipams/{ipam}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_ipams",
        "description": "Delete sdn ipam object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ipam": {
                    "type": "string",
                    "description": "Path parameter: ipam"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "ipam"
            ]
        },
        "path": "/cluster/sdn/ipams/{ipam}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_cluster_sdn_ipams_status",
        "description": "List PVE IPAM Entries",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ipam": {
                    "type": "string",
                    "description": "Path parameter: ipam"
                }
            },
            "required": [
                "ipam"
            ]
        },
        "path": "/cluster/sdn/ipams/{ipam}/status",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_sdn_dns",
        "description": "SDN dns index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list sdn dns of specific type",
                    "enum": [
                        "powerdns"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/dns",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_dns",
        "description": "Create a new sdn dns object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dns": {
                    "type": "string",
                    "description": "The SDN dns object identifier."
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "key": {
                    "type": "string",
                    "description": "key"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "reversemaskv6": {
                    "type": "number",
                    "description": "reversemaskv6"
                },
                "reversev6mask": {
                    "type": "number",
                    "description": "reversev6mask"
                },
                "ttl": {
                    "type": "number",
                    "description": "ttl"
                },
                "type": {
                    "type": "string",
                    "description": "Plugin type.",
                    "enum": [
                        "powerdns"
                    ]
                },
                "url": {
                    "type": "string",
                    "description": "url"
                }
            },
            "required": [
                "dns",
                "key",
                "type",
                "url"
            ]
        },
        "path": "/cluster/sdn/dns",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_dns",
        "description": "Read sdn dns configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dns": {
                    "type": "string",
                    "description": "Path parameter: dns"
                }
            },
            "required": [
                "dns"
            ]
        },
        "path": "/cluster/sdn/dns/{dns}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_dns",
        "description": "Update sdn dns object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dns": {
                    "type": "string",
                    "description": "Path parameter: dns"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "key": {
                    "type": "string",
                    "description": "key"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "reversemaskv6": {
                    "type": "number",
                    "description": "reversemaskv6"
                },
                "ttl": {
                    "type": "number",
                    "description": "ttl"
                },
                "url": {
                    "type": "string",
                    "description": "url"
                }
            },
            "required": [
                "dns"
            ]
        },
        "path": "/cluster/sdn/dns/{dns}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_dns",
        "description": "Delete sdn dns object configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dns": {
                    "type": "string",
                    "description": "Path parameter: dns"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": [
                "dns"
            ]
        },
        "path": "/cluster/sdn/dns/{dns}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_fabrics",
        "description": "SDN Fabrics Index",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/sdn/fabrics",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_sdn_fabrics_fabric",
        "description": "SDN Fabrics Index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/fabrics/fabric",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_fabrics_fabric",
        "description": "Add a fabric",
        "inputSchema": {
            "type": "object",
            "properties": {
                "area": {
                    "type": "string",
                    "description": "OSPF area. Either a IPv4 address or a 32-bit number. Gets validated in rust."
                },
                "csnp_interval": {
                    "type": "number",
                    "description": "The csnp_interval property for Openfabric"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "hello_interval": {
                    "type": "number",
                    "description": "The hello_interval property for Openfabric"
                },
                "id": {
                    "type": "string",
                    "description": "Identifier for SDN fabrics"
                },
                "ip6_prefix": {
                    "type": "string",
                    "description": "The IP prefix for Node IPs"
                },
                "ip_prefix": {
                    "type": "string",
                    "description": "The IP prefix for Node IPs"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "protocol": {
                    "type": "string",
                    "description": "Type of configuration entry in an SDN Fabric section config",
                    "enum": [
                        "openfabric",
                        "ospf"
                    ]
                }
            },
            "required": [
                "id",
                "protocol"
            ]
        },
        "path": "/cluster/sdn/fabrics/fabric",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_fabrics_fabric",
        "description": "Update a fabric",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/sdn/fabrics/fabric/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_fabrics_fabric",
        "description": "Update a fabric",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "area": {
                    "type": "string",
                    "description": "OSPF area. Either a IPv4 address or a 32-bit number. Gets validated in rust."
                },
                "csnp_interval": {
                    "type": "number",
                    "description": "The csnp_interval property for Openfabric"
                },
                "delete": {
                    "type": "array",
                    "description": "delete"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "hello_interval": {
                    "type": "number",
                    "description": "The hello_interval property for Openfabric"
                },
                "ip6_prefix": {
                    "type": "string",
                    "description": "The IP prefix for Node IPs"
                },
                "ip_prefix": {
                    "type": "string",
                    "description": "The IP prefix for Node IPs"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "protocol": {
                    "type": "string",
                    "description": "Type of configuration entry in an SDN Fabric section config",
                    "enum": [
                        "openfabric",
                        "ospf"
                    ]
                }
            },
            "required": [
                "id",
                "delete",
                "protocol"
            ]
        },
        "path": "/cluster/sdn/fabrics/fabric/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_fabrics_fabric",
        "description": "Add a fabric",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "id"
            ]
        },
        "path": "/cluster/sdn/fabrics/fabric/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_fabrics_node",
        "description": "SDN Fabrics Index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/fabrics/node",
        "method": "GET"
    },
    {
        "name": "pve_get_cluster_sdn_fabrics_node_node",
        "description": "SDN Fabrics Index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fabric_id": {
                    "type": "string",
                    "description": "Path parameter: fabric_id"
                },
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": [
                "fabric_id"
            ]
        },
        "path": "/cluster/sdn/fabrics/node/{fabric_id}",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_fabrics_node",
        "description": "Add a node",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fabric_id": {
                    "type": "string",
                    "description": "Path parameter: fabric_id"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "interfaces": {
                    "type": "array",
                    "description": "interfaces"
                },
                "ip": {
                    "type": "string",
                    "description": "IPv4 address for this node"
                },
                "ip6": {
                    "type": "string",
                    "description": "IPv6 address for this node"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "node_id": {
                    "type": "string",
                    "description": "Identifier for nodes in an SDN fabric"
                },
                "protocol": {
                    "type": "string",
                    "description": "Type of configuration entry in an SDN Fabric section config",
                    "enum": [
                        "openfabric",
                        "ospf"
                    ]
                }
            },
            "required": [
                "fabric_id",
                "interfaces",
                "node_id",
                "protocol"
            ]
        },
        "path": "/cluster/sdn/fabrics/node/{fabric_id}",
        "method": "POST"
    },
    {
        "name": "pve_get_cluster_sdn_fabrics_node_node",
        "description": "Get a node",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fabric_id": {
                    "type": "string",
                    "description": "Path parameter: fabric_id"
                },
                "node_id": {
                    "type": "string",
                    "description": "Path parameter: node_id"
                }
            },
            "required": [
                "fabric_id",
                "node_id"
            ]
        },
        "path": "/cluster/sdn/fabrics/node/{fabric_id}/{node_id}",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_sdn_fabrics_node",
        "description": "Update a node",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fabric_id": {
                    "type": "string",
                    "description": "Path parameter: fabric_id"
                },
                "node_id": {
                    "type": "string",
                    "description": "Path parameter: node_id"
                },
                "delete": {
                    "type": "array",
                    "description": "delete"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "interfaces": {
                    "type": "array",
                    "description": "interfaces"
                },
                "ip": {
                    "type": "string",
                    "description": "IPv4 address for this node"
                },
                "ip6": {
                    "type": "string",
                    "description": "IPv6 address for this node"
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "protocol": {
                    "type": "string",
                    "description": "Type of configuration entry in an SDN Fabric section config",
                    "enum": [
                        "openfabric",
                        "ospf"
                    ]
                }
            },
            "required": [
                "fabric_id",
                "node_id",
                "interfaces",
                "protocol"
            ]
        },
        "path": "/cluster/sdn/fabrics/node/{fabric_id}/{node_id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_cluster_sdn_fabrics_node",
        "description": "Add a node",
        "inputSchema": {
            "type": "object",
            "properties": {
                "fabric_id": {
                    "type": "string",
                    "description": "Path parameter: fabric_id"
                },
                "node_id": {
                    "type": "string",
                    "description": "Path parameter: node_id"
                }
            },
            "required": [
                "fabric_id",
                "node_id"
            ]
        },
        "path": "/cluster/sdn/fabrics/node/{fabric_id}/{node_id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_cluster_sdn_fabrics_all",
        "description": "SDN Fabrics Index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pending": {
                    "type": "boolean",
                    "description": "Display pending config."
                },
                "running": {
                    "type": "boolean",
                    "description": "Display running config."
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/fabrics/all",
        "method": "GET"
    },
    {
        "name": "pve_create_cluster_sdn_lock",
        "description": "Acquire global lock for SDN configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "allow-pending": {
                    "type": "boolean",
                    "description": "if true, allow acquiring lock even though there are pending changes",
                    "default": 0
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/lock",
        "method": "POST"
    },
    {
        "name": "pve_delete_cluster_sdn_lock",
        "description": "Release global lock for SDN configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "force": {
                    "type": "boolean",
                    "description": "if true, allow releasing lock without providing the token",
                    "default": 0
                },
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/lock",
        "method": "DELETE"
    },
    {
        "name": "pve_create_cluster_sdn_rollback",
        "description": "Rollback pending changes to SDN configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lock-token": {
                    "type": "string",
                    "description": "the token for unlocking the global SDN configuration"
                },
                "release-lock": {
                    "type": "boolean",
                    "description": "When lock-token has been provided and configuration successfully rollbacked, release the lock automatically afterwards",
                    "default": 1
                }
            },
            "required": []
        },
        "path": "/cluster/sdn/rollback",
        "method": "POST"
    },
    {
        "name": "pve_list_cluster_log",
        "description": "Read cluster log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "max": {
                    "type": "number",
                    "description": "Maximum number of entries."
                }
            },
            "required": []
        },
        "path": "/cluster/log",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_resources",
        "description": "Resources index (cluster wide).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Resource type.",
                    "enum": [
                        "vm",
                        "storage",
                        "node",
                        "sdn"
                    ]
                }
            },
            "required": []
        },
        "path": "/cluster/resources",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_tasks",
        "description": "List recent tasks (cluster wide).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/tasks",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_options",
        "description": "Get datacenter options. Without 'Sys.Audit' on '/' not all options are returned.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/options",
        "method": "GET"
    },
    {
        "name": "pve_update_cluster_options",
        "description": "Set datacenter options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bwlimit": {
                    "type": "string",
                    "description": "Set I/O bandwidth limit for various operations (in KiB/s)."
                },
                "consent-text": {
                    "type": "string",
                    "description": "Consent text that is displayed before logging in."
                },
                "console": {
                    "type": "string",
                    "description": "Select the default Console viewer. You can either use the builtin java applet (VNC; deprecated and maps to html5), an external virt-viewer comtatible application (SPICE), an HTML5 based vnc viewer (noVNC), or an HTML5 based console client (xtermjs). If the selected viewer is not available (e.g. SPIC",
                    "enum": [
                        "applet",
                        "vv",
                        "html5",
                        "xtermjs"
                    ]
                },
                "crs": {
                    "type": "string",
                    "description": "Cluster resource scheduling settings."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Datacenter description. Shown in the web-interface datacenter notes panel. This is saved as comment inside the configuration file."
                },
                "email_from": {
                    "type": "string",
                    "description": "Specify email address to send notification from (default is root@$hostname)"
                },
                "fencing": {
                    "type": "string",
                    "description": "Set the fencing mode of the HA cluster. Hardware mode needs a valid configuration of fence devices in /etc/pve/ha/fence.cfg. With both all two modes are used.\n\nWARNING: 'hardware' and 'both' are EXPERIMENTAL & WIP",
                    "enum": [
                        "watchdog",
                        "hardware",
                        "both"
                    ],
                    "default": "watchdog"
                },
                "ha": {
                    "type": "string",
                    "description": "Cluster wide HA settings."
                },
                "http_proxy": {
                    "type": "string",
                    "description": "Specify external http proxy which is used for downloads (example: 'http://username:password@host:port/')"
                },
                "keyboard": {
                    "type": "string",
                    "description": "Default keybord layout for vnc server.",
                    "enum": [
                        "de",
                        "de-ch",
                        "da",
                        "en-gb",
                        "en-us",
                        "es",
                        "fi",
                        "fr",
                        "fr-be",
                        "fr-ca",
                        "fr-ch",
                        "hu",
                        "is",
                        "it",
                        "ja",
                        "lt",
                        "mk",
                        "nl",
                        "no",
                        "pl",
                        "pt",
                        "pt-br",
                        "sv",
                        "sl",
                        "tr"
                    ]
                },
                "language": {
                    "type": "string",
                    "description": "Default GUI language.",
                    "enum": [
                        "ar",
                        "ca",
                        "da",
                        "de",
                        "en",
                        "es",
                        "eu",
                        "fa",
                        "fr",
                        "hr",
                        "he",
                        "it",
                        "ja",
                        "ka",
                        "kr",
                        "nb",
                        "nl",
                        "nn",
                        "pl",
                        "pt_BR",
                        "ru",
                        "sl",
                        "sv",
                        "tr",
                        "ukr",
                        "zh_CN",
                        "zh_TW"
                    ]
                },
                "mac_prefix": {
                    "type": "string",
                    "description": "Prefix for the auto-generated MAC addresses of virtual guests. The default 'BC:24:11' is the OUI assigned by the IEEE to Proxmox Server Solutions GmbH for a 24-bit large MAC block. You're allowed to use this in local networks, i.e., those not directly reachable by the public (e.g., in a LAN or behin",
                    "default": "BC:24:11"
                },
                "max_workers": {
                    "type": "number",
                    "description": "Defines how many workers (per node) are maximal started  on actions like 'stopall VMs' or task from the ha-manager."
                },
                "migration": {
                    "type": "string",
                    "description": "For cluster wide migration settings."
                },
                "migration_unsecure": {
                    "type": "boolean",
                    "description": "Migration is secure using SSH tunnel by default. For secure private networks you can disable it to speed up migration. Deprecated, use the 'migration' property instead!"
                },
                "next-id": {
                    "type": "string",
                    "description": "Control the range for the free VMID auto-selection pool."
                },
                "notify": {
                    "type": "string",
                    "description": "Cluster-wide notification settings."
                },
                "registered-tags": {
                    "type": "string",
                    "description": "A list of tags that require a `Sys.Modify` on '/' to set and delete. Tags set here that are also in 'user-tag-access' also require `Sys.Modify`."
                },
                "replication": {
                    "type": "string",
                    "description": "For cluster wide replication settings."
                },
                "tag-style": {
                    "type": "string",
                    "description": "Tag style options."
                },
                "u2f": {
                    "type": "string",
                    "description": "u2f"
                },
                "user-tag-access": {
                    "type": "string",
                    "description": "Privilege options for user-settable tags"
                },
                "webauthn": {
                    "type": "string",
                    "description": "webauthn configuration"
                }
            },
            "required": []
        },
        "path": "/cluster/options",
        "method": "PUT"
    },
    {
        "name": "pve_list_cluster_status",
        "description": "Get cluster status information.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/cluster/status",
        "method": "GET"
    },
    {
        "name": "pve_list_cluster_nextid",
        "description": "Get next free VMID. Pass a VMID to assert that its free (at time of check).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                }
            },
            "required": []
        },
        "path": "/cluster/nextid",
        "method": "GET"
    },
    {
        "name": "pve_list_nodes",
        "description": "Cluster node index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/nodes",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes",
        "description": "Node index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_qemu",
        "description": "Virtual machine index (per node).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "full": {
                    "type": "boolean",
                    "description": "Determine the full status of active VMs."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/qemu",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu",
        "description": "Create or restore a virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "acpi": {
                    "type": "boolean",
                    "description": "Enable/disable ACPI.",
                    "default": 1
                },
                "affinity": {
                    "type": "string",
                    "description": "List of host cores used to execute guest processes, for example: 0,5,8-11"
                },
                "agent": {
                    "type": "string",
                    "description": "Enable/disable communication with the QEMU Guest Agent and its properties."
                },
                "allow-ksm": {
                    "type": "boolean",
                    "description": "Allow memory pages of this guest to be merged via KSM (Kernel Samepage Merging).",
                    "default": 1
                },
                "amd-sev": {
                    "type": "string",
                    "description": "Secure Encrypted Virtualization (SEV) features by AMD CPUs"
                },
                "arch": {
                    "type": "string",
                    "description": "Virtual processor architecture. Defaults to the host.",
                    "enum": [
                        "x86_64",
                        "aarch64"
                    ]
                },
                "archive": {
                    "type": "string",
                    "description": "The backup archive. Either the file system path to a .tar or .vma file (use '-' to pipe data from stdin) or a proxmox storage backup volume identifier."
                },
                "args": {
                    "type": "string",
                    "description": "Arbitrary arguments passed to kvm."
                },
                "audio0": {
                    "type": "string",
                    "description": "Configure a audio device, useful in combination with QXL/Spice."
                },
                "autostart": {
                    "type": "boolean",
                    "description": "Automatic restart after crash (currently ignored).",
                    "default": 0
                },
                "balloon": {
                    "type": "number",
                    "description": "Amount of target RAM for the VM in MiB. Using zero disables the ballon driver."
                },
                "bios": {
                    "type": "string",
                    "description": "Select BIOS implementation.",
                    "enum": [
                        "seabios",
                        "ovmf"
                    ],
                    "default": "seabios"
                },
                "boot": {
                    "type": "string",
                    "description": "Specify guest boot order. Use the 'order=' sub-property as usage with no key or 'legacy=' is deprecated."
                },
                "bootdisk": {
                    "type": "string",
                    "description": "Enable booting from specified disk. Deprecated: Use 'boot: order=foo;bar' instead."
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "restore limit from datacenter or storage config"
                },
                "cdrom": {
                    "type": "string",
                    "description": "This is an alias for option -ide2"
                },
                "cicustom": {
                    "type": "string",
                    "description": "cloud-init: Specify custom files to replace the automatically generated ones at start."
                },
                "cipassword": {
                    "type": "string",
                    "description": "cloud-init: Password to assign the user. Using this is generally not recommended. Use ssh keys instead. Also note that older cloud-init versions do not support hashed passwords."
                },
                "citype": {
                    "type": "string",
                    "description": "Specifies the cloud-init configuration format. The default depends on the configured operating system type (`ostype`. We use the `nocloud` format for Linux, and `configdrive2` for windows.",
                    "enum": [
                        "configdrive2",
                        "nocloud",
                        "opennebula"
                    ]
                },
                "ciupgrade": {
                    "type": "boolean",
                    "description": "cloud-init: do an automatic package upgrade after the first boot.",
                    "default": 1
                },
                "ciuser": {
                    "type": "string",
                    "description": "cloud-init: User name to change ssh keys and password for instead of the image's configured default user."
                },
                "cores": {
                    "type": "number",
                    "description": "The number of cores per socket.",
                    "default": 1
                },
                "cpu": {
                    "type": "string",
                    "description": "Emulated CPU type."
                },
                "cpulimit": {
                    "type": "number",
                    "description": "Limit of CPU usage.",
                    "default": 0
                },
                "cpuunits": {
                    "type": "number",
                    "description": "CPU weight for a VM, will be clamped to [1, 10000] in cgroup v2.",
                    "default": "cgroup v1: 1024, cgroup v2: 100"
                },
                "description": {
                    "type": "string",
                    "description": "Description for the VM. Shown in the web-interface VM's summary. This is saved as comment inside the configuration file."
                },
                "efidisk0": {
                    "type": "string",
                    "description": "Configure a disk for storing EFI vars. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and that the default EFI vars are copied to the volume instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "force": {
                    "type": "boolean",
                    "description": "Allow to overwrite existing VM."
                },
                "freeze": {
                    "type": "boolean",
                    "description": "Freeze CPU at startup (use 'c' monitor command to start execution)."
                },
                "ha-managed": {
                    "type": "boolean",
                    "description": "Add the VM as a HA resource after it was created.",
                    "default": 0
                },
                "hookscript": {
                    "type": "string",
                    "description": "Script that will be executed during various steps in the vms lifetime."
                },
                "hostpci[n]": {
                    "type": "string",
                    "description": "Map host PCI devices into guest."
                },
                "hotplug": {
                    "type": "string",
                    "description": "Selectively enable hotplug features. This is a comma separated list of hotplug features: 'network', 'disk', 'cpu', 'memory', 'usb' and 'cloudinit'. Use '0' to disable hotplug completely. Using '1' as value is an alias for the default `network,disk,usb`. USB hotplugging is possible for guests with ma",
                    "default": "network,disk,usb"
                },
                "hugepages": {
                    "type": "string",
                    "description": "Enables hugepages memory.\n\nSets the size of hugepages in MiB. If the value is set to 'any' then 1 GiB hugepages will be used if possible, otherwise the size will fall back to 2 MiB.",
                    "enum": [
                        "any",
                        "2",
                        "1024"
                    ]
                },
                "ide[n]": {
                    "type": "string",
                    "description": "Use volume as IDE hard disk or CD-ROM (n is 0 to 3). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "import-working-storage": {
                    "type": "string",
                    "description": "A file-based storage with 'images' content-type enabled, which is used as an intermediary extraction storage during import. Defaults to the source storage."
                },
                "intel-tdx": {
                    "type": "string",
                    "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
                },
                "ipconfig[n]": {
                    "type": "string",
                    "description": "cloud-init: Specify IP addresses and gateways for the corresponding interface.\n\nIP addresses use CIDR notation, gateways are optional but need an IP of the same type specified.\n\nThe special string 'dhcp' can be used for IP addresses to use DHCP, in which case no explicit\ngateway should be provided.\n"
                },
                "ivshmem": {
                    "type": "string",
                    "description": "Inter-VM shared memory. Useful for direct communication between VMs, or to the host."
                },
                "keephugepages": {
                    "type": "boolean",
                    "description": "Use together with hugepages. If enabled, hugepages will not not be deleted after VM shutdown and can be used for subsequent starts.",
                    "default": 0
                },
                "keyboard": {
                    "type": "string",
                    "description": "Keyboard layout for VNC server. This option is generally not required and is often better handled from within the guest OS.",
                    "enum": [
                        "de",
                        "de-ch",
                        "da",
                        "en-gb",
                        "en-us",
                        "es",
                        "fi",
                        "fr",
                        "fr-be",
                        "fr-ca",
                        "fr-ch",
                        "hu",
                        "is",
                        "it",
                        "ja",
                        "lt",
                        "mk",
                        "nl",
                        "no",
                        "pl",
                        "pt",
                        "pt-br",
                        "sv",
                        "sl",
                        "tr"
                    ],
                    "default": null
                },
                "kvm": {
                    "type": "boolean",
                    "description": "Enable/disable KVM hardware virtualization.",
                    "default": 1
                },
                "live-restore": {
                    "type": "boolean",
                    "description": "Start the VM immediately while importing or restoring in the background."
                },
                "localtime": {
                    "type": "boolean",
                    "description": "Set the real time clock (RTC) to local time. This is enabled by default if the `ostype` indicates a Microsoft Windows OS."
                },
                "lock": {
                    "type": "string",
                    "description": "Lock/unlock the VM.",
                    "enum": [
                        "backup",
                        "clone",
                        "create",
                        "migrate",
                        "rollback",
                        "snapshot",
                        "snapshot-delete",
                        "suspending",
                        "suspended"
                    ]
                },
                "machine": {
                    "type": "string",
                    "description": "Specify the QEMU machine."
                },
                "memory": {
                    "type": "string",
                    "description": "Memory properties."
                },
                "migrate_downtime": {
                    "type": "number",
                    "description": "Set maximum tolerated downtime (in seconds) for migrations. Should the migration not be able to converge in the very end, because too much newly dirtied RAM needs to be transferred, the limit will be increased automatically step-by-step until migration can converge.",
                    "default": 0.1
                },
                "migrate_speed": {
                    "type": "number",
                    "description": "Set maximum speed (in MB/s) for migrations. Value 0 is no limit.",
                    "default": 0
                },
                "name": {
                    "type": "string",
                    "description": "Set a name for the VM. Only used on the configuration web interface."
                },
                "nameserver": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS server IP address for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "net[n]": {
                    "type": "string",
                    "description": "Specify network devices."
                },
                "numa": {
                    "type": "boolean",
                    "description": "Enable/disable NUMA.",
                    "default": 0
                },
                "numa[n]": {
                    "type": "string",
                    "description": "NUMA topology."
                },
                "onboot": {
                    "type": "boolean",
                    "description": "Specifies whether a VM will be started during system bootup.",
                    "default": 0
                },
                "ostype": {
                    "type": "string",
                    "description": "Specify guest operating system.",
                    "enum": [
                        "other",
                        "wxp",
                        "w2k",
                        "w2k3",
                        "w2k8",
                        "wvista",
                        "win7",
                        "win8",
                        "win10",
                        "win11",
                        "l24",
                        "l26",
                        "solaris"
                    ],
                    "default": "other"
                },
                "parallel[n]": {
                    "type": "string",
                    "description": "Map host parallel devices (n is 0 to 2)."
                },
                "pool": {
                    "type": "string",
                    "description": "Add the VM to the specified pool."
                },
                "protection": {
                    "type": "boolean",
                    "description": "Sets the protection flag of the VM. This will disable the remove VM and remove disk operations.",
                    "default": 0
                },
                "reboot": {
                    "type": "boolean",
                    "description": "Allow reboot. If set to '0' the VM exit on reboot.",
                    "default": 1
                },
                "rng0": {
                    "type": "string",
                    "description": "Configure a VirtIO-based Random Number Generator."
                },
                "sata[n]": {
                    "type": "string",
                    "description": "Use volume as SATA hard disk or CD-ROM (n is 0 to 5). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsi[n]": {
                    "type": "string",
                    "description": "Use volume as SCSI hard disk or CD-ROM (n is 0 to 30). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsihw": {
                    "type": "string",
                    "description": "SCSI controller model",
                    "enum": [
                        "lsi",
                        "lsi53c810",
                        "virtio-scsi-pci",
                        "virtio-scsi-single",
                        "megasas",
                        "pvscsi"
                    ],
                    "default": "lsi"
                },
                "searchdomain": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS search domains for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "serial[n]": {
                    "type": "string",
                    "description": "Create a serial device inside the VM (n is 0 to 3)"
                },
                "shares": {
                    "type": "number",
                    "description": "Amount of memory shares for auto-ballooning. The larger the number is, the more memory this VM gets. Number is relative to weights of all other running VMs. Using zero disables auto-ballooning. Auto-ballooning is done by pvestatd.",
                    "default": 1000
                },
                "smbios1": {
                    "type": "string",
                    "description": "Specify SMBIOS type 1 fields."
                },
                "smp": {
                    "type": "number",
                    "description": "The number of CPUs. Please use option -sockets instead.",
                    "default": 1
                },
                "sockets": {
                    "type": "number",
                    "description": "The number of CPU sockets.",
                    "default": 1
                },
                "spice_enhancements": {
                    "type": "string",
                    "description": "Configure additional enhancements for SPICE."
                },
                "sshkeys": {
                    "type": "string",
                    "description": "cloud-init: Setup public SSH keys (one key per line, OpenSSH format)."
                },
                "start": {
                    "type": "boolean",
                    "description": "Start VM after it was created successfully.",
                    "default": 0
                },
                "startdate": {
                    "type": "string",
                    "description": "Set the initial date of the real time clock. Valid format for date are:'now' or '2006-06-17T16:01:21' or '2006-06-17'.",
                    "default": "now"
                },
                "startup": {
                    "type": "string",
                    "description": "Startup and shutdown behavior. Order is a non-negative number defining the general startup order. Shutdown in done with reverse ordering. Additionally you can set the 'up' or 'down' delay in seconds, which specifies a delay to wait before the next VM is started or stopped."
                },
                "storage": {
                    "type": "string",
                    "description": "Default storage."
                },
                "tablet": {
                    "type": "boolean",
                    "description": "Enable/disable the USB tablet device.",
                    "default": 1
                },
                "tags": {
                    "type": "string",
                    "description": "Tags of the VM. This is only meta information."
                },
                "tdf": {
                    "type": "boolean",
                    "description": "Enable/disable time drift fix.",
                    "default": 0
                },
                "template": {
                    "type": "boolean",
                    "description": "Enable/disable Template.",
                    "default": 0
                },
                "tpmstate0": {
                    "type": "string",
                    "description": "Configure a Disk for storing TPM state. The format is fixed to 'raw'. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and 4 MiB will be used instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "unique": {
                    "type": "boolean",
                    "description": "Assign a unique random ethernet address."
                },
                "unused[n]": {
                    "type": "string",
                    "description": "Reference to unused volumes. This is used internally, and should not be modified manually."
                },
                "usb[n]": {
                    "type": "string",
                    "description": "Configure an USB device (n is 0 to 4, for machine version >= 7.1 and ostype l26 or windows > 7, n can be up to 14)."
                },
                "vcpus": {
                    "type": "number",
                    "description": "Number of hotplugged vcpus.",
                    "default": 0
                },
                "vga": {
                    "type": "string",
                    "description": "Configure the VGA hardware."
                },
                "virtio[n]": {
                    "type": "string",
                    "description": "Use volume as VIRTIO hard disk (n is 0 to 15). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "virtiofs[n]": {
                    "type": "string",
                    "description": "Configuration for sharing a directory between host and guest using Virtio-fs."
                },
                "vmgenid": {
                    "type": "string",
                    "description": "Set VM Generation ID. Use '1' to autogenerate on create or update, pass '0' to disable explicitly.",
                    "default": "1 (autogenerated)"
                },
                "vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                },
                "vmstatestorage": {
                    "type": "string",
                    "description": "Default storage for VM state volumes/files."
                },
                "watchdog": {
                    "type": "string",
                    "description": "Create a virtual hardware watchdog device."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_qemu",
        "description": "Directory index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_qemu",
        "description": "Destroy the VM and  all used/owned volumes. Removes any VM specific permissions and firewall rules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "destroy-unreferenced-disks": {
                    "type": "boolean",
                    "description": "If set, destroy additionally all disks not referenced in the config but with a matching VMID from all enabled storages.",
                    "default": 0
                },
                "purge": {
                    "type": "boolean",
                    "description": "Remove VMID from configurations, like backup & replication jobs and HA."
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_firewall",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_rules_rules",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_firewall_rules",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "action",
                "type"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_rules_rules",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/rules/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_firewall_rules",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/rules/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_qemu_firewall_rules",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/rules/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_aliases_aliases",
        "description": "List aliases",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/aliases",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_firewall_aliases",
        "description": "Create IP or Network Alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "name": {
                    "type": "string",
                    "description": "Alias name."
                }
            },
            "required": [
                "node",
                "vmid",
                "cidr",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/aliases",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_aliases_aliases",
        "description": "Read alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/aliases/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_firewall_aliases",
        "description": "Update IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing alias."
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/aliases/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_qemu_firewall_aliases",
        "description": "Remove IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/aliases/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_ipset_ipset",
        "description": "List IPSets",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_firewall_ipset_ipset",
        "description": "Create new IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "name": {
                    "type": "string",
                    "description": "IP set name."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing IPSet. You can set 'rename' to the same value as 'name' to update the 'comment' of an existing IPSet."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_ipset_ipset",
        "description": "List IPSet content",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_firewall_ipset_ipset",
        "description": "Add IP or Network to IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_qemu_firewall_ipset_ipset",
        "description": "Delete IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "force": {
                    "type": "boolean",
                    "description": "Delete all members of the IPSet, if there are any."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_ipset_ipset",
        "description": "Read IP or Network settings from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_firewall_ipset",
        "description": "Update IP or Network settings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_qemu_firewall_ipset_ipset",
        "description": "Remove IP or Network from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_options",
        "description": "Get VM firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/options",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_firewall_options",
        "description": "Set Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dhcp": {
                    "type": "boolean",
                    "description": "Enable DHCP.",
                    "default": 0
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable/disable firewall rules.",
                    "default": 0
                },
                "ipfilter": {
                    "type": "boolean",
                    "description": "Enable default IP filters. This is equivalent to adding an empty ipfilter-net<id> ipset for every interface. Such ipsets implicitly contain sane default restrictions such as restricting IPv6 link local addresses to the one derived from the interface's MAC address. For containers the configured IP ad"
                },
                "log_level_in": {
                    "type": "string",
                    "description": "Log level for incoming traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "log_level_out": {
                    "type": "string",
                    "description": "Log level for outgoing traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macfilter": {
                    "type": "boolean",
                    "description": "Enable/disable MAC address filter.",
                    "default": 1
                },
                "ndp": {
                    "type": "boolean",
                    "description": "Enable NDP (Neighbor Discovery Protocol).",
                    "default": 1
                },
                "policy_in": {
                    "type": "string",
                    "description": "Input policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                },
                "policy_out": {
                    "type": "string",
                    "description": "Output policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                },
                "radv": {
                    "type": "boolean",
                    "description": "Allow sending Router Advertisement."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/options",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_log",
        "description": "Read firewall log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "since": {
                    "type": "number",
                    "description": "Display log since this UNIX epoch."
                },
                "start": {
                    "type": "number",
                    "description": "start"
                },
                "until": {
                    "type": "number",
                    "description": "Display log until this UNIX epoch."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/log",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_firewall_refs",
        "description": "Lists possible IPSet/Alias reference which are allowed in source/dest properties.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "type": {
                    "type": "string",
                    "description": "Only list references of specified type.",
                    "enum": [
                        "alias",
                        "ipset"
                    ]
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/firewall/refs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent",
        "description": "QEMU Guest Agent command index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_agent",
        "description": "Execute QEMU Guest Agent commands.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "command": {
                    "type": "string",
                    "description": "The QGA command.",
                    "enum": [
                        "fsfreeze-freeze",
                        "fsfreeze-status",
                        "fsfreeze-thaw",
                        "fstrim",
                        "get-fsinfo",
                        "get-host-name",
                        "get-memory-block-info",
                        "get-memory-blocks",
                        "get-osinfo",
                        "get-time",
                        "get-timezone",
                        "get-users",
                        "get-vcpus",
                        "info",
                        "network-get-interfaces",
                        "ping",
                        "shutdown",
                        "suspend-disk",
                        "suspend-hybrid",
                        "suspend-ram"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "command"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_fsfreeze-freeze",
        "description": "Execute fsfreeze-freeze.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/fsfreeze-freeze",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_fsfreeze-status",
        "description": "Execute fsfreeze-status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/fsfreeze-status",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_fsfreeze-thaw",
        "description": "Execute fsfreeze-thaw.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/fsfreeze-thaw",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_fstrim",
        "description": "Execute fstrim.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/fstrim",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-fsinfo",
        "description": "Execute get-fsinfo.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-fsinfo",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-host-name",
        "description": "Execute get-host-name.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-host-name",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-memory-block-info",
        "description": "Execute get-memory-block-info.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-memory-block-info",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-memory-blocks",
        "description": "Execute get-memory-blocks.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-memory-blocks",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-osinfo",
        "description": "Execute get-osinfo.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-osinfo",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-time",
        "description": "Execute get-time.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-time",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-timezone",
        "description": "Execute get-timezone.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-timezone",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-users",
        "description": "Execute get-users.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-users",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_get-vcpus",
        "description": "Execute get-vcpus.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/get-vcpus",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_info",
        "description": "Execute info.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/info",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_network-get-interfaces",
        "description": "Execute network-get-interfaces.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/network-get-interfaces",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_agent_ping",
        "description": "Execute ping.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/ping",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_shutdown",
        "description": "Execute shutdown.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/shutdown",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_suspend-disk",
        "description": "Execute suspend-disk.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/suspend-disk",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_suspend-hybrid",
        "description": "Execute suspend-hybrid.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/suspend-hybrid",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_suspend-ram",
        "description": "Execute suspend-ram.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/suspend-ram",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_set-user-password",
        "description": "Sets the password for the given user to the given password",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "crypted": {
                    "type": "boolean",
                    "description": "set to 1 if the password has already been passed through crypt()",
                    "default": 0
                },
                "password": {
                    "type": "string",
                    "description": "The new password."
                },
                "username": {
                    "type": "string",
                    "description": "The user to set the password for."
                }
            },
            "required": [
                "node",
                "vmid",
                "password",
                "username"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/set-user-password",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_agent_exec",
        "description": "Executes the given command in the vm via the guest-agent and returns an object with the pid.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "command": {
                    "type": "array",
                    "description": "The command as a list of program + arguments."
                },
                "input-data": {
                    "type": "string",
                    "description": "Data to pass as 'input-data' to the guest. Usually treated as STDIN to 'command'."
                }
            },
            "required": [
                "node",
                "vmid",
                "command"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/exec",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_agent_exec-status",
        "description": "Gets the status of the given pid started by the guest-agent",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pid": {
                    "type": "number",
                    "description": "The PID to query"
                }
            },
            "required": [
                "node",
                "vmid",
                "pid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/exec-status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_agent_file-read",
        "description": "Reads the given file via guest agent. Is limited to 16777216 bytes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "file": {
                    "type": "string",
                    "description": "The path to the file"
                }
            },
            "required": [
                "node",
                "vmid",
                "file"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/file-read",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_agent_file-write",
        "description": "Writes the given file via guest agent.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "content": {
                    "type": "string",
                    "description": "The content to write into the file."
                },
                "encode": {
                    "type": "boolean",
                    "description": "If set, the content will be encoded as base64 (required by QEMU).Otherwise the content needs to be encoded beforehand - defaults to true.",
                    "default": 1
                },
                "file": {
                    "type": "string",
                    "description": "The path to the file."
                }
            },
            "required": [
                "node",
                "vmid",
                "content",
                "file"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/agent/file-write",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_rrd",
        "description": "Read VM RRD statistics (returns PNG)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "ds": {
                    "type": "string",
                    "description": "The list of datasources you want to display."
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "ds",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/rrd",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_rrddata",
        "description": "Read VM RRD statistics",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/rrddata",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_config",
        "description": "Get the virtual machine configuration with pending configuration changes applied. Set the 'current' parameter to get the current configuration instead.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "current": {
                    "type": "boolean",
                    "description": "Get current values (instead of pending values).",
                    "default": 0
                },
                "snapshot": {
                    "type": "string",
                    "description": "Fetch config values from given snapshot."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/config",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_config",
        "description": "Set virtual machine options (asynchronous API).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "acpi": {
                    "type": "boolean",
                    "description": "Enable/disable ACPI.",
                    "default": 1
                },
                "affinity": {
                    "type": "string",
                    "description": "List of host cores used to execute guest processes, for example: 0,5,8-11"
                },
                "agent": {
                    "type": "string",
                    "description": "Enable/disable communication with the QEMU Guest Agent and its properties."
                },
                "allow-ksm": {
                    "type": "boolean",
                    "description": "Allow memory pages of this guest to be merged via KSM (Kernel Samepage Merging).",
                    "default": 1
                },
                "amd-sev": {
                    "type": "string",
                    "description": "Secure Encrypted Virtualization (SEV) features by AMD CPUs"
                },
                "arch": {
                    "type": "string",
                    "description": "Virtual processor architecture. Defaults to the host.",
                    "enum": [
                        "x86_64",
                        "aarch64"
                    ]
                },
                "args": {
                    "type": "string",
                    "description": "Arbitrary arguments passed to kvm."
                },
                "audio0": {
                    "type": "string",
                    "description": "Configure a audio device, useful in combination with QXL/Spice."
                },
                "autostart": {
                    "type": "boolean",
                    "description": "Automatic restart after crash (currently ignored).",
                    "default": 0
                },
                "background_delay": {
                    "type": "number",
                    "description": "Time to wait for the task to finish. We return 'null' if the task finish within that time."
                },
                "balloon": {
                    "type": "number",
                    "description": "Amount of target RAM for the VM in MiB. Using zero disables the ballon driver."
                },
                "bios": {
                    "type": "string",
                    "description": "Select BIOS implementation.",
                    "enum": [
                        "seabios",
                        "ovmf"
                    ],
                    "default": "seabios"
                },
                "boot": {
                    "type": "string",
                    "description": "Specify guest boot order. Use the 'order=' sub-property as usage with no key or 'legacy=' is deprecated."
                },
                "bootdisk": {
                    "type": "string",
                    "description": "Enable booting from specified disk. Deprecated: Use 'boot: order=foo;bar' instead."
                },
                "cdrom": {
                    "type": "string",
                    "description": "This is an alias for option -ide2"
                },
                "cicustom": {
                    "type": "string",
                    "description": "cloud-init: Specify custom files to replace the automatically generated ones at start."
                },
                "cipassword": {
                    "type": "string",
                    "description": "cloud-init: Password to assign the user. Using this is generally not recommended. Use ssh keys instead. Also note that older cloud-init versions do not support hashed passwords."
                },
                "citype": {
                    "type": "string",
                    "description": "Specifies the cloud-init configuration format. The default depends on the configured operating system type (`ostype`. We use the `nocloud` format for Linux, and `configdrive2` for windows.",
                    "enum": [
                        "configdrive2",
                        "nocloud",
                        "opennebula"
                    ]
                },
                "ciupgrade": {
                    "type": "boolean",
                    "description": "cloud-init: do an automatic package upgrade after the first boot.",
                    "default": 1
                },
                "ciuser": {
                    "type": "string",
                    "description": "cloud-init: User name to change ssh keys and password for instead of the image's configured default user."
                },
                "cores": {
                    "type": "number",
                    "description": "The number of cores per socket.",
                    "default": 1
                },
                "cpu": {
                    "type": "string",
                    "description": "Emulated CPU type."
                },
                "cpulimit": {
                    "type": "number",
                    "description": "Limit of CPU usage.",
                    "default": 0
                },
                "cpuunits": {
                    "type": "number",
                    "description": "CPU weight for a VM, will be clamped to [1, 10000] in cgroup v2.",
                    "default": "cgroup v1: 1024, cgroup v2: 100"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description for the VM. Shown in the web-interface VM's summary. This is saved as comment inside the configuration file."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "efidisk0": {
                    "type": "string",
                    "description": "Configure a disk for storing EFI vars. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and that the default EFI vars are copied to the volume instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "force": {
                    "type": "boolean",
                    "description": "Force physical removal. Without this, we simple remove the disk from the config file and create an additional configuration entry called 'unused[n]', which contains the volume ID. Unlink of unused[n] always cause physical removal."
                },
                "freeze": {
                    "type": "boolean",
                    "description": "Freeze CPU at startup (use 'c' monitor command to start execution)."
                },
                "hookscript": {
                    "type": "string",
                    "description": "Script that will be executed during various steps in the vms lifetime."
                },
                "hostpci[n]": {
                    "type": "string",
                    "description": "Map host PCI devices into guest."
                },
                "hotplug": {
                    "type": "string",
                    "description": "Selectively enable hotplug features. This is a comma separated list of hotplug features: 'network', 'disk', 'cpu', 'memory', 'usb' and 'cloudinit'. Use '0' to disable hotplug completely. Using '1' as value is an alias for the default `network,disk,usb`. USB hotplugging is possible for guests with ma",
                    "default": "network,disk,usb"
                },
                "hugepages": {
                    "type": "string",
                    "description": "Enables hugepages memory.\n\nSets the size of hugepages in MiB. If the value is set to 'any' then 1 GiB hugepages will be used if possible, otherwise the size will fall back to 2 MiB.",
                    "enum": [
                        "any",
                        "2",
                        "1024"
                    ]
                },
                "ide[n]": {
                    "type": "string",
                    "description": "Use volume as IDE hard disk or CD-ROM (n is 0 to 3). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "import-working-storage": {
                    "type": "string",
                    "description": "A file-based storage with 'images' content-type enabled, which is used as an intermediary extraction storage during import. Defaults to the source storage."
                },
                "intel-tdx": {
                    "type": "string",
                    "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
                },
                "ipconfig[n]": {
                    "type": "string",
                    "description": "cloud-init: Specify IP addresses and gateways for the corresponding interface.\n\nIP addresses use CIDR notation, gateways are optional but need an IP of the same type specified.\n\nThe special string 'dhcp' can be used for IP addresses to use DHCP, in which case no explicit\ngateway should be provided.\n"
                },
                "ivshmem": {
                    "type": "string",
                    "description": "Inter-VM shared memory. Useful for direct communication between VMs, or to the host."
                },
                "keephugepages": {
                    "type": "boolean",
                    "description": "Use together with hugepages. If enabled, hugepages will not not be deleted after VM shutdown and can be used for subsequent starts.",
                    "default": 0
                },
                "keyboard": {
                    "type": "string",
                    "description": "Keyboard layout for VNC server. This option is generally not required and is often better handled from within the guest OS.",
                    "enum": [
                        "de",
                        "de-ch",
                        "da",
                        "en-gb",
                        "en-us",
                        "es",
                        "fi",
                        "fr",
                        "fr-be",
                        "fr-ca",
                        "fr-ch",
                        "hu",
                        "is",
                        "it",
                        "ja",
                        "lt",
                        "mk",
                        "nl",
                        "no",
                        "pl",
                        "pt",
                        "pt-br",
                        "sv",
                        "sl",
                        "tr"
                    ],
                    "default": null
                },
                "kvm": {
                    "type": "boolean",
                    "description": "Enable/disable KVM hardware virtualization.",
                    "default": 1
                },
                "localtime": {
                    "type": "boolean",
                    "description": "Set the real time clock (RTC) to local time. This is enabled by default if the `ostype` indicates a Microsoft Windows OS."
                },
                "lock": {
                    "type": "string",
                    "description": "Lock/unlock the VM.",
                    "enum": [
                        "backup",
                        "clone",
                        "create",
                        "migrate",
                        "rollback",
                        "snapshot",
                        "snapshot-delete",
                        "suspending",
                        "suspended"
                    ]
                },
                "machine": {
                    "type": "string",
                    "description": "Specify the QEMU machine."
                },
                "memory": {
                    "type": "string",
                    "description": "Memory properties."
                },
                "migrate_downtime": {
                    "type": "number",
                    "description": "Set maximum tolerated downtime (in seconds) for migrations. Should the migration not be able to converge in the very end, because too much newly dirtied RAM needs to be transferred, the limit will be increased automatically step-by-step until migration can converge.",
                    "default": 0.1
                },
                "migrate_speed": {
                    "type": "number",
                    "description": "Set maximum speed (in MB/s) for migrations. Value 0 is no limit.",
                    "default": 0
                },
                "name": {
                    "type": "string",
                    "description": "Set a name for the VM. Only used on the configuration web interface."
                },
                "nameserver": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS server IP address for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "net[n]": {
                    "type": "string",
                    "description": "Specify network devices."
                },
                "numa": {
                    "type": "boolean",
                    "description": "Enable/disable NUMA.",
                    "default": 0
                },
                "numa[n]": {
                    "type": "string",
                    "description": "NUMA topology."
                },
                "onboot": {
                    "type": "boolean",
                    "description": "Specifies whether a VM will be started during system bootup.",
                    "default": 0
                },
                "ostype": {
                    "type": "string",
                    "description": "Specify guest operating system.",
                    "enum": [
                        "other",
                        "wxp",
                        "w2k",
                        "w2k3",
                        "w2k8",
                        "wvista",
                        "win7",
                        "win8",
                        "win10",
                        "win11",
                        "l24",
                        "l26",
                        "solaris"
                    ],
                    "default": "other"
                },
                "parallel[n]": {
                    "type": "string",
                    "description": "Map host parallel devices (n is 0 to 2)."
                },
                "protection": {
                    "type": "boolean",
                    "description": "Sets the protection flag of the VM. This will disable the remove VM and remove disk operations.",
                    "default": 0
                },
                "reboot": {
                    "type": "boolean",
                    "description": "Allow reboot. If set to '0' the VM exit on reboot.",
                    "default": 1
                },
                "revert": {
                    "type": "string",
                    "description": "Revert a pending change."
                },
                "rng0": {
                    "type": "string",
                    "description": "Configure a VirtIO-based Random Number Generator."
                },
                "sata[n]": {
                    "type": "string",
                    "description": "Use volume as SATA hard disk or CD-ROM (n is 0 to 5). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsi[n]": {
                    "type": "string",
                    "description": "Use volume as SCSI hard disk or CD-ROM (n is 0 to 30). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsihw": {
                    "type": "string",
                    "description": "SCSI controller model",
                    "enum": [
                        "lsi",
                        "lsi53c810",
                        "virtio-scsi-pci",
                        "virtio-scsi-single",
                        "megasas",
                        "pvscsi"
                    ],
                    "default": "lsi"
                },
                "searchdomain": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS search domains for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "serial[n]": {
                    "type": "string",
                    "description": "Create a serial device inside the VM (n is 0 to 3)"
                },
                "shares": {
                    "type": "number",
                    "description": "Amount of memory shares for auto-ballooning. The larger the number is, the more memory this VM gets. Number is relative to weights of all other running VMs. Using zero disables auto-ballooning. Auto-ballooning is done by pvestatd.",
                    "default": 1000
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "smbios1": {
                    "type": "string",
                    "description": "Specify SMBIOS type 1 fields."
                },
                "smp": {
                    "type": "number",
                    "description": "The number of CPUs. Please use option -sockets instead.",
                    "default": 1
                },
                "sockets": {
                    "type": "number",
                    "description": "The number of CPU sockets.",
                    "default": 1
                },
                "spice_enhancements": {
                    "type": "string",
                    "description": "Configure additional enhancements for SPICE."
                },
                "sshkeys": {
                    "type": "string",
                    "description": "cloud-init: Setup public SSH keys (one key per line, OpenSSH format)."
                },
                "startdate": {
                    "type": "string",
                    "description": "Set the initial date of the real time clock. Valid format for date are:'now' or '2006-06-17T16:01:21' or '2006-06-17'.",
                    "default": "now"
                },
                "startup": {
                    "type": "string",
                    "description": "Startup and shutdown behavior. Order is a non-negative number defining the general startup order. Shutdown in done with reverse ordering. Additionally you can set the 'up' or 'down' delay in seconds, which specifies a delay to wait before the next VM is started or stopped."
                },
                "tablet": {
                    "type": "boolean",
                    "description": "Enable/disable the USB tablet device.",
                    "default": 1
                },
                "tags": {
                    "type": "string",
                    "description": "Tags of the VM. This is only meta information."
                },
                "tdf": {
                    "type": "boolean",
                    "description": "Enable/disable time drift fix.",
                    "default": 0
                },
                "template": {
                    "type": "boolean",
                    "description": "Enable/disable Template.",
                    "default": 0
                },
                "tpmstate0": {
                    "type": "string",
                    "description": "Configure a Disk for storing TPM state. The format is fixed to 'raw'. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and 4 MiB will be used instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "unused[n]": {
                    "type": "string",
                    "description": "Reference to unused volumes. This is used internally, and should not be modified manually."
                },
                "usb[n]": {
                    "type": "string",
                    "description": "Configure an USB device (n is 0 to 4, for machine version >= 7.1 and ostype l26 or windows > 7, n can be up to 14)."
                },
                "vcpus": {
                    "type": "number",
                    "description": "Number of hotplugged vcpus.",
                    "default": 0
                },
                "vga": {
                    "type": "string",
                    "description": "Configure the VGA hardware."
                },
                "virtio[n]": {
                    "type": "string",
                    "description": "Use volume as VIRTIO hard disk (n is 0 to 15). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "virtiofs[n]": {
                    "type": "string",
                    "description": "Configuration for sharing a directory between host and guest using Virtio-fs."
                },
                "vmgenid": {
                    "type": "string",
                    "description": "Set VM Generation ID. Use '1' to autogenerate on create or update, pass '0' to disable explicitly.",
                    "default": "1 (autogenerated)"
                },
                "vmstatestorage": {
                    "type": "string",
                    "description": "Default storage for VM state volumes/files."
                },
                "watchdog": {
                    "type": "string",
                    "description": "Create a virtual hardware watchdog device."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/config",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_qemu_config",
        "description": "Set virtual machine options (synchronous API) - You should consider using the POST method instead for any actions involving hotplug or storage allocation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "acpi": {
                    "type": "boolean",
                    "description": "Enable/disable ACPI.",
                    "default": 1
                },
                "affinity": {
                    "type": "string",
                    "description": "List of host cores used to execute guest processes, for example: 0,5,8-11"
                },
                "agent": {
                    "type": "string",
                    "description": "Enable/disable communication with the QEMU Guest Agent and its properties."
                },
                "allow-ksm": {
                    "type": "boolean",
                    "description": "Allow memory pages of this guest to be merged via KSM (Kernel Samepage Merging).",
                    "default": 1
                },
                "amd-sev": {
                    "type": "string",
                    "description": "Secure Encrypted Virtualization (SEV) features by AMD CPUs"
                },
                "arch": {
                    "type": "string",
                    "description": "Virtual processor architecture. Defaults to the host.",
                    "enum": [
                        "x86_64",
                        "aarch64"
                    ]
                },
                "args": {
                    "type": "string",
                    "description": "Arbitrary arguments passed to kvm."
                },
                "audio0": {
                    "type": "string",
                    "description": "Configure a audio device, useful in combination with QXL/Spice."
                },
                "autostart": {
                    "type": "boolean",
                    "description": "Automatic restart after crash (currently ignored).",
                    "default": 0
                },
                "balloon": {
                    "type": "number",
                    "description": "Amount of target RAM for the VM in MiB. Using zero disables the ballon driver."
                },
                "bios": {
                    "type": "string",
                    "description": "Select BIOS implementation.",
                    "enum": [
                        "seabios",
                        "ovmf"
                    ],
                    "default": "seabios"
                },
                "boot": {
                    "type": "string",
                    "description": "Specify guest boot order. Use the 'order=' sub-property as usage with no key or 'legacy=' is deprecated."
                },
                "bootdisk": {
                    "type": "string",
                    "description": "Enable booting from specified disk. Deprecated: Use 'boot: order=foo;bar' instead."
                },
                "cdrom": {
                    "type": "string",
                    "description": "This is an alias for option -ide2"
                },
                "cicustom": {
                    "type": "string",
                    "description": "cloud-init: Specify custom files to replace the automatically generated ones at start."
                },
                "cipassword": {
                    "type": "string",
                    "description": "cloud-init: Password to assign the user. Using this is generally not recommended. Use ssh keys instead. Also note that older cloud-init versions do not support hashed passwords."
                },
                "citype": {
                    "type": "string",
                    "description": "Specifies the cloud-init configuration format. The default depends on the configured operating system type (`ostype`. We use the `nocloud` format for Linux, and `configdrive2` for windows.",
                    "enum": [
                        "configdrive2",
                        "nocloud",
                        "opennebula"
                    ]
                },
                "ciupgrade": {
                    "type": "boolean",
                    "description": "cloud-init: do an automatic package upgrade after the first boot.",
                    "default": 1
                },
                "ciuser": {
                    "type": "string",
                    "description": "cloud-init: User name to change ssh keys and password for instead of the image's configured default user."
                },
                "cores": {
                    "type": "number",
                    "description": "The number of cores per socket.",
                    "default": 1
                },
                "cpu": {
                    "type": "string",
                    "description": "Emulated CPU type."
                },
                "cpulimit": {
                    "type": "number",
                    "description": "Limit of CPU usage.",
                    "default": 0
                },
                "cpuunits": {
                    "type": "number",
                    "description": "CPU weight for a VM, will be clamped to [1, 10000] in cgroup v2.",
                    "default": "cgroup v1: 1024, cgroup v2: 100"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description for the VM. Shown in the web-interface VM's summary. This is saved as comment inside the configuration file."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "efidisk0": {
                    "type": "string",
                    "description": "Configure a disk for storing EFI vars. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and that the default EFI vars are copied to the volume instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "force": {
                    "type": "boolean",
                    "description": "Force physical removal. Without this, we simple remove the disk from the config file and create an additional configuration entry called 'unused[n]', which contains the volume ID. Unlink of unused[n] always cause physical removal."
                },
                "freeze": {
                    "type": "boolean",
                    "description": "Freeze CPU at startup (use 'c' monitor command to start execution)."
                },
                "hookscript": {
                    "type": "string",
                    "description": "Script that will be executed during various steps in the vms lifetime."
                },
                "hostpci[n]": {
                    "type": "string",
                    "description": "Map host PCI devices into guest."
                },
                "hotplug": {
                    "type": "string",
                    "description": "Selectively enable hotplug features. This is a comma separated list of hotplug features: 'network', 'disk', 'cpu', 'memory', 'usb' and 'cloudinit'. Use '0' to disable hotplug completely. Using '1' as value is an alias for the default `network,disk,usb`. USB hotplugging is possible for guests with ma",
                    "default": "network,disk,usb"
                },
                "hugepages": {
                    "type": "string",
                    "description": "Enables hugepages memory.\n\nSets the size of hugepages in MiB. If the value is set to 'any' then 1 GiB hugepages will be used if possible, otherwise the size will fall back to 2 MiB.",
                    "enum": [
                        "any",
                        "2",
                        "1024"
                    ]
                },
                "ide[n]": {
                    "type": "string",
                    "description": "Use volume as IDE hard disk or CD-ROM (n is 0 to 3). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "intel-tdx": {
                    "type": "string",
                    "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
                },
                "ipconfig[n]": {
                    "type": "string",
                    "description": "cloud-init: Specify IP addresses and gateways for the corresponding interface.\n\nIP addresses use CIDR notation, gateways are optional but need an IP of the same type specified.\n\nThe special string 'dhcp' can be used for IP addresses to use DHCP, in which case no explicit\ngateway should be provided.\n"
                },
                "ivshmem": {
                    "type": "string",
                    "description": "Inter-VM shared memory. Useful for direct communication between VMs, or to the host."
                },
                "keephugepages": {
                    "type": "boolean",
                    "description": "Use together with hugepages. If enabled, hugepages will not not be deleted after VM shutdown and can be used for subsequent starts.",
                    "default": 0
                },
                "keyboard": {
                    "type": "string",
                    "description": "Keyboard layout for VNC server. This option is generally not required and is often better handled from within the guest OS.",
                    "enum": [
                        "de",
                        "de-ch",
                        "da",
                        "en-gb",
                        "en-us",
                        "es",
                        "fi",
                        "fr",
                        "fr-be",
                        "fr-ca",
                        "fr-ch",
                        "hu",
                        "is",
                        "it",
                        "ja",
                        "lt",
                        "mk",
                        "nl",
                        "no",
                        "pl",
                        "pt",
                        "pt-br",
                        "sv",
                        "sl",
                        "tr"
                    ],
                    "default": null
                },
                "kvm": {
                    "type": "boolean",
                    "description": "Enable/disable KVM hardware virtualization.",
                    "default": 1
                },
                "localtime": {
                    "type": "boolean",
                    "description": "Set the real time clock (RTC) to local time. This is enabled by default if the `ostype` indicates a Microsoft Windows OS."
                },
                "lock": {
                    "type": "string",
                    "description": "Lock/unlock the VM.",
                    "enum": [
                        "backup",
                        "clone",
                        "create",
                        "migrate",
                        "rollback",
                        "snapshot",
                        "snapshot-delete",
                        "suspending",
                        "suspended"
                    ]
                },
                "machine": {
                    "type": "string",
                    "description": "Specify the QEMU machine."
                },
                "memory": {
                    "type": "string",
                    "description": "Memory properties."
                },
                "migrate_downtime": {
                    "type": "number",
                    "description": "Set maximum tolerated downtime (in seconds) for migrations. Should the migration not be able to converge in the very end, because too much newly dirtied RAM needs to be transferred, the limit will be increased automatically step-by-step until migration can converge.",
                    "default": 0.1
                },
                "migrate_speed": {
                    "type": "number",
                    "description": "Set maximum speed (in MB/s) for migrations. Value 0 is no limit.",
                    "default": 0
                },
                "name": {
                    "type": "string",
                    "description": "Set a name for the VM. Only used on the configuration web interface."
                },
                "nameserver": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS server IP address for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "net[n]": {
                    "type": "string",
                    "description": "Specify network devices."
                },
                "numa": {
                    "type": "boolean",
                    "description": "Enable/disable NUMA.",
                    "default": 0
                },
                "numa[n]": {
                    "type": "string",
                    "description": "NUMA topology."
                },
                "onboot": {
                    "type": "boolean",
                    "description": "Specifies whether a VM will be started during system bootup.",
                    "default": 0
                },
                "ostype": {
                    "type": "string",
                    "description": "Specify guest operating system.",
                    "enum": [
                        "other",
                        "wxp",
                        "w2k",
                        "w2k3",
                        "w2k8",
                        "wvista",
                        "win7",
                        "win8",
                        "win10",
                        "win11",
                        "l24",
                        "l26",
                        "solaris"
                    ],
                    "default": "other"
                },
                "parallel[n]": {
                    "type": "string",
                    "description": "Map host parallel devices (n is 0 to 2)."
                },
                "protection": {
                    "type": "boolean",
                    "description": "Sets the protection flag of the VM. This will disable the remove VM and remove disk operations.",
                    "default": 0
                },
                "reboot": {
                    "type": "boolean",
                    "description": "Allow reboot. If set to '0' the VM exit on reboot.",
                    "default": 1
                },
                "revert": {
                    "type": "string",
                    "description": "Revert a pending change."
                },
                "rng0": {
                    "type": "string",
                    "description": "Configure a VirtIO-based Random Number Generator."
                },
                "sata[n]": {
                    "type": "string",
                    "description": "Use volume as SATA hard disk or CD-ROM (n is 0 to 5). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsi[n]": {
                    "type": "string",
                    "description": "Use volume as SCSI hard disk or CD-ROM (n is 0 to 30). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "scsihw": {
                    "type": "string",
                    "description": "SCSI controller model",
                    "enum": [
                        "lsi",
                        "lsi53c810",
                        "virtio-scsi-pci",
                        "virtio-scsi-single",
                        "megasas",
                        "pvscsi"
                    ],
                    "default": "lsi"
                },
                "searchdomain": {
                    "type": "string",
                    "description": "cloud-init: Sets DNS search domains for a container. Create will automatically use the setting from the host if neither searchdomain nor nameserver are set."
                },
                "serial[n]": {
                    "type": "string",
                    "description": "Create a serial device inside the VM (n is 0 to 3)"
                },
                "shares": {
                    "type": "number",
                    "description": "Amount of memory shares for auto-ballooning. The larger the number is, the more memory this VM gets. Number is relative to weights of all other running VMs. Using zero disables auto-ballooning. Auto-ballooning is done by pvestatd.",
                    "default": 1000
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "smbios1": {
                    "type": "string",
                    "description": "Specify SMBIOS type 1 fields."
                },
                "smp": {
                    "type": "number",
                    "description": "The number of CPUs. Please use option -sockets instead.",
                    "default": 1
                },
                "sockets": {
                    "type": "number",
                    "description": "The number of CPU sockets.",
                    "default": 1
                },
                "spice_enhancements": {
                    "type": "string",
                    "description": "Configure additional enhancements for SPICE."
                },
                "sshkeys": {
                    "type": "string",
                    "description": "cloud-init: Setup public SSH keys (one key per line, OpenSSH format)."
                },
                "startdate": {
                    "type": "string",
                    "description": "Set the initial date of the real time clock. Valid format for date are:'now' or '2006-06-17T16:01:21' or '2006-06-17'.",
                    "default": "now"
                },
                "startup": {
                    "type": "string",
                    "description": "Startup and shutdown behavior. Order is a non-negative number defining the general startup order. Shutdown in done with reverse ordering. Additionally you can set the 'up' or 'down' delay in seconds, which specifies a delay to wait before the next VM is started or stopped."
                },
                "tablet": {
                    "type": "boolean",
                    "description": "Enable/disable the USB tablet device.",
                    "default": 1
                },
                "tags": {
                    "type": "string",
                    "description": "Tags of the VM. This is only meta information."
                },
                "tdf": {
                    "type": "boolean",
                    "description": "Enable/disable time drift fix.",
                    "default": 0
                },
                "template": {
                    "type": "boolean",
                    "description": "Enable/disable Template.",
                    "default": 0
                },
                "tpmstate0": {
                    "type": "string",
                    "description": "Configure a Disk for storing TPM state. The format is fixed to 'raw'. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Note that SIZE_IN_GiB is ignored here and 4 MiB will be used instead. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "unused[n]": {
                    "type": "string",
                    "description": "Reference to unused volumes. This is used internally, and should not be modified manually."
                },
                "usb[n]": {
                    "type": "string",
                    "description": "Configure an USB device (n is 0 to 4, for machine version >= 7.1 and ostype l26 or windows > 7, n can be up to 14)."
                },
                "vcpus": {
                    "type": "number",
                    "description": "Number of hotplugged vcpus.",
                    "default": 0
                },
                "vga": {
                    "type": "string",
                    "description": "Configure the VGA hardware."
                },
                "virtio[n]": {
                    "type": "string",
                    "description": "Use volume as VIRTIO hard disk (n is 0 to 15). Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume. Use STORAGE_ID:0 and the 'import-from' parameter to import from an existing volume."
                },
                "virtiofs[n]": {
                    "type": "string",
                    "description": "Configuration for sharing a directory between host and guest using Virtio-fs."
                },
                "vmgenid": {
                    "type": "string",
                    "description": "Set VM Generation ID. Use '1' to autogenerate on create or update, pass '0' to disable explicitly.",
                    "default": "1 (autogenerated)"
                },
                "vmstatestorage": {
                    "type": "string",
                    "description": "Default storage for VM state volumes/files."
                },
                "watchdog": {
                    "type": "string",
                    "description": "Create a virtual hardware watchdog device."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/config",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_qemu_pending",
        "description": "Get the virtual machine configuration with both current and pending values.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/pending",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_cloudinit",
        "description": "Get the cloudinit configuration with both current and pending values.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/cloudinit",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_cloudinit",
        "description": "Regenerate and change cloudinit config drive.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/cloudinit",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_qemu_cloudinit_dump",
        "description": "Get automatically generated cloudinit config.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "type": {
                    "type": "string",
                    "description": "Config type.",
                    "enum": [
                        "user",
                        "network",
                        "meta"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "type"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/cloudinit/dump",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_unlink",
        "description": "Unlink/delete disk images.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "force": {
                    "type": "boolean",
                    "description": "Force physical removal. Without this, we simple remove the disk from the config file and create an additional configuration entry called 'unused[n]', which contains the volume ID. Unlink of unused[n] always cause physical removal."
                },
                "idlist": {
                    "type": "string",
                    "description": "A list of disk IDs you want to delete."
                }
            },
            "required": [
                "node",
                "vmid",
                "idlist"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/unlink",
        "method": "PUT"
    },
    {
        "name": "pve_create_nodes_qemu_vncproxy",
        "description": "Creates a TCP VNC proxy connections.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "generate-password": {
                    "type": "boolean",
                    "description": "Generates a random password to be used as ticket instead of the API ticket.",
                    "default": 0
                },
                "websocket": {
                    "type": "boolean",
                    "description": "Prepare for websocket upgrade (only required when using serial terminal, otherwise upgrade is always possible)."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/vncproxy",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_termproxy",
        "description": "Creates a TCP proxy connections.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "serial": {
                    "type": "string",
                    "description": "opens a serial terminal (defaults to display)",
                    "enum": [
                        "serial0",
                        "serial1",
                        "serial2",
                        "serial3"
                    ]
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/termproxy",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_vncwebsocket",
        "description": "Opens a websocket for VNC traffic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "port": {
                    "type": "number",
                    "description": "Port number returned by previous vncproxy call."
                },
                "vncticket": {
                    "type": "string",
                    "description": "Ticket from previous call to vncproxy."
                }
            },
            "required": [
                "node",
                "vmid",
                "port",
                "vncticket"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/vncwebsocket",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_spiceproxy",
        "description": "Returns a SPICE configuration to connect to the VM.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "proxy": {
                    "type": "string",
                    "description": "SPICE proxy server. This can be used by the client to specify the proxy server. All nodes in a cluster runs 'spiceproxy', so it is up to the client to choose one. By default, we return the node where the VM is currently running. As reasonable setting is to use same node you use to connect to the API"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/spiceproxy",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_status",
        "description": "Directory index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_qemu_status_current",
        "description": "Get virtual machine status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/current",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_status_start",
        "description": "Start virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "force-cpu": {
                    "type": "string",
                    "description": "Override QEMU's -cpu argument with the given string."
                },
                "machine": {
                    "type": "string",
                    "description": "Specify the QEMU machine."
                },
                "migratedfrom": {
                    "type": "string",
                    "description": "The cluster node name."
                },
                "migration_network": {
                    "type": "string",
                    "description": "CIDR of the (sub) network that is used for migration."
                },
                "migration_type": {
                    "type": "string",
                    "description": "Migration traffic is encrypted using an SSH tunnel by default. On secure, completely private networks this can be disabled to increase performance.",
                    "enum": [
                        "secure",
                        "insecure"
                    ]
                },
                "nets-host-mtu": {
                    "type": "string",
                    "description": "Used for migration compat. List of VirtIO network devices and their effective host_mtu setting according to the QEMU object model on the source side of the migration. A value of 0 means that the host_mtu parameter is to be avoided for the corresponding device."
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "stateuri": {
                    "type": "string",
                    "description": "Some command save/restore state from this location."
                },
                "targetstorage": {
                    "type": "string",
                    "description": "Mapping from source to target storages. Providing only a single storage ID maps all source storages to that storage. Providing the special value '1' will map each source storage to itself."
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds.",
                    "default": "max(30, vm memory in GiB)"
                },
                "with-conntrack-state": {
                    "type": "boolean",
                    "description": "Whether to migrate conntrack entries for running VMs.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/start",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_stop",
        "description": "Stop virtual machine. The qemu process will exit immediately. This is akin to pulling the power plug of a running computer and may damage the VM data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "keepActive": {
                    "type": "boolean",
                    "description": "Do not deactivate storage volumes.",
                    "default": 0
                },
                "migratedfrom": {
                    "type": "string",
                    "description": "The cluster node name."
                },
                "overrule-shutdown": {
                    "type": "boolean",
                    "description": "Try to abort active 'qmshutdown' tasks before stopping.",
                    "default": 0
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/stop",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_reset",
        "description": "Reset virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/reset",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_shutdown",
        "description": "Shutdown virtual machine. This is similar to pressing the power button on a physical machine. This will send an ACPI event for the guest OS, which should then proceed to a clean shutdown.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "forceStop": {
                    "type": "boolean",
                    "description": "Make sure the VM stops.",
                    "default": 0
                },
                "keepActive": {
                    "type": "boolean",
                    "description": "Do not deactivate storage volumes.",
                    "default": 0
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/shutdown",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_reboot",
        "description": "Reboot the VM by shutting it down, and starting it again. Applies pending changes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds for the shutdown."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/reboot",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_suspend",
        "description": "Suspend virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                },
                "statestorage": {
                    "type": "string",
                    "description": "The storage for the VM state"
                },
                "todisk": {
                    "type": "boolean",
                    "description": "If set, suspends the VM to disk. Will be resumed on next VM start.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/suspend",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_status_resume",
        "description": "Resume virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "nocheck": {
                    "type": "boolean",
                    "description": "nocheck"
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/status/resume",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_qemu_sendkey",
        "description": "Send key event to virtual machine.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "key": {
                    "type": "string",
                    "description": "The key (qemu monitor encoding)."
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid",
                "key"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/sendkey",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_qemu_feature",
        "description": "Check if feature for virtual machine is available.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "feature": {
                    "type": "string",
                    "description": "Feature to check.",
                    "enum": [
                        "snapshot",
                        "clone",
                        "copy"
                    ]
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                }
            },
            "required": [
                "node",
                "vmid",
                "feature"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/feature",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_clone",
        "description": "Create a copy of virtual machine/template.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "clone limit from datacenter or storage config"
                },
                "description": {
                    "type": "string",
                    "description": "Description for the new VM."
                },
                "format": {
                    "type": "string",
                    "description": "Target format for file storage. Only valid for full clone.",
                    "enum": [
                        "raw",
                        "qcow2",
                        "vmdk"
                    ]
                },
                "full": {
                    "type": "boolean",
                    "description": "Create a full copy of all disks. This is always done when you clone a normal VM. For VM templates, we try to create a linked clone by default."
                },
                "name": {
                    "type": "string",
                    "description": "Set a name for the new VM."
                },
                "newid": {
                    "type": "number",
                    "description": "VMID for the clone."
                },
                "pool": {
                    "type": "string",
                    "description": "Add the new VM to the specified pool."
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                },
                "storage": {
                    "type": "string",
                    "description": "Target storage for full clone."
                },
                "target": {
                    "type": "string",
                    "description": "Target node. Only allowed if the original VM is on shared storage."
                }
            },
            "required": [
                "node",
                "vmid",
                "newid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/clone",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_move_disk",
        "description": "Move volume to different storage or to a different VM.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "move limit from datacenter or storage config"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Delete the original disk after successful copy. By default the original disk is kept as unused disk.",
                    "default": 0
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "disk": {
                    "type": "string",
                    "description": "The disk you want to move.",
                    "enum": [
                        "ide0",
                        "ide1",
                        "ide2",
                        "ide3",
                        "scsi0",
                        "scsi1",
                        "scsi2",
                        "scsi3",
                        "scsi4",
                        "scsi5",
                        "scsi6",
                        "scsi7",
                        "scsi8",
                        "scsi9",
                        "scsi10",
                        "scsi11",
                        "scsi12",
                        "scsi13",
                        "scsi14",
                        "scsi15",
                        "scsi16",
                        "scsi17",
                        "scsi18",
                        "scsi19",
                        "scsi20",
                        "scsi21",
                        "scsi22",
                        "scsi23",
                        "scsi24",
                        "scsi25",
                        "scsi26",
                        "scsi27",
                        "scsi28",
                        "scsi29",
                        "scsi30",
                        "virtio0",
                        "virtio1",
                        "virtio2",
                        "virtio3",
                        "virtio4",
                        "virtio5",
                        "virtio6",
                        "virtio7",
                        "virtio8",
                        "virtio9",
                        "virtio10",
                        "virtio11",
                        "virtio12",
                        "virtio13",
                        "virtio14",
                        "virtio15",
                        "sata0",
                        "sata1",
                        "sata2",
                        "sata3",
                        "sata4",
                        "sata5",
                        "efidisk0",
                        "tpmstate0",
                        "unused0",
                        "unused1",
                        "unused2",
                        "unused3",
                        "unused4",
                        "unused5",
                        "unused6",
                        "unused7",
                        "unused8",
                        "unused9",
                        "unused10",
                        "unused11",
                        "unused12",
                        "unused13",
                        "unused14",
                        "unused15",
                        "unused16",
                        "unused17",
                        "unused18",
                        "unused19",
                        "unused20",
                        "unused21",
                        "unused22",
                        "unused23",
                        "unused24",
                        "unused25",
                        "unused26",
                        "unused27",
                        "unused28",
                        "unused29",
                        "unused30",
                        "unused31",
                        "unused32",
                        "unused33",
                        "unused34",
                        "unused35",
                        "unused36",
                        "unused37",
                        "unused38",
                        "unused39",
                        "unused40",
                        "unused41",
                        "unused42",
                        "unused43",
                        "unused44",
                        "unused45",
                        "unused46",
                        "unused47",
                        "unused48",
                        "unused49",
                        "unused50",
                        "unused51",
                        "unused52",
                        "unused53",
                        "unused54",
                        "unused55",
                        "unused56",
                        "unused57",
                        "unused58",
                        "unused59",
                        "unused60",
                        "unused61",
                        "unused62",
                        "unused63",
                        "unused64",
                        "unused65",
                        "unused66",
                        "unused67",
                        "unused68",
                        "unused69",
                        "unused70",
                        "unused71",
                        "unused72",
                        "unused73",
                        "unused74",
                        "unused75",
                        "unused76",
                        "unused77",
                        "unused78",
                        "unused79",
                        "unused80",
                        "unused81",
                        "unused82",
                        "unused83",
                        "unused84",
                        "unused85",
                        "unused86",
                        "unused87",
                        "unused88",
                        "unused89",
                        "unused90",
                        "unused91",
                        "unused92",
                        "unused93",
                        "unused94",
                        "unused95",
                        "unused96",
                        "unused97",
                        "unused98",
                        "unused99",
                        "unused100",
                        "unused101",
                        "unused102",
                        "unused103",
                        "unused104",
                        "unused105",
                        "unused106",
                        "unused107",
                        "unused108",
                        "unused109",
                        "unused110",
                        "unused111",
                        "unused112",
                        "unused113",
                        "unused114",
                        "unused115",
                        "unused116",
                        "unused117",
                        "unused118",
                        "unused119",
                        "unused120",
                        "unused121",
                        "unused122",
                        "unused123",
                        "unused124",
                        "unused125",
                        "unused126",
                        "unused127",
                        "unused128",
                        "unused129",
                        "unused130",
                        "unused131",
                        "unused132",
                        "unused133",
                        "unused134",
                        "unused135",
                        "unused136",
                        "unused137",
                        "unused138",
                        "unused139",
                        "unused140",
                        "unused141",
                        "unused142",
                        "unused143",
                        "unused144",
                        "unused145",
                        "unused146",
                        "unused147",
                        "unused148",
                        "unused149",
                        "unused150",
                        "unused151",
                        "unused152",
                        "unused153",
                        "unused154",
                        "unused155",
                        "unused156",
                        "unused157",
                        "unused158",
                        "unused159",
                        "unused160",
                        "unused161",
                        "unused162",
                        "unused163",
                        "unused164",
                        "unused165",
                        "unused166",
                        "unused167",
                        "unused168",
                        "unused169",
                        "unused170",
                        "unused171",
                        "unused172",
                        "unused173",
                        "unused174",
                        "unused175",
                        "unused176",
                        "unused177",
                        "unused178",
                        "unused179",
                        "unused180",
                        "unused181",
                        "unused182",
                        "unused183",
                        "unused184",
                        "unused185",
                        "unused186",
                        "unused187",
                        "unused188",
                        "unused189",
                        "unused190",
                        "unused191",
                        "unused192",
                        "unused193",
                        "unused194",
                        "unused195",
                        "unused196",
                        "unused197",
                        "unused198",
                        "unused199",
                        "unused200",
                        "unused201",
                        "unused202",
                        "unused203",
                        "unused204",
                        "unused205",
                        "unused206",
                        "unused207",
                        "unused208",
                        "unused209",
                        "unused210",
                        "unused211",
                        "unused212",
                        "unused213",
                        "unused214",
                        "unused215",
                        "unused216",
                        "unused217",
                        "unused218",
                        "unused219",
                        "unused220",
                        "unused221",
                        "unused222",
                        "unused223",
                        "unused224",
                        "unused225",
                        "unused226",
                        "unused227",
                        "unused228",
                        "unused229",
                        "unused230",
                        "unused231",
                        "unused232",
                        "unused233",
                        "unused234",
                        "unused235",
                        "unused236",
                        "unused237",
                        "unused238",
                        "unused239",
                        "unused240",
                        "unused241",
                        "unused242",
                        "unused243",
                        "unused244",
                        "unused245",
                        "unused246",
                        "unused247",
                        "unused248",
                        "unused249",
                        "unused250",
                        "unused251",
                        "unused252",
                        "unused253",
                        "unused254",
                        "unused255"
                    ]
                },
                "format": {
                    "type": "string",
                    "description": "Target Format.",
                    "enum": [
                        "raw",
                        "qcow2",
                        "vmdk"
                    ]
                },
                "storage": {
                    "type": "string",
                    "description": "Target storage."
                },
                "target-digest": {
                    "type": "string",
                    "description": "Prevent changes if the current config file of the target VM has a different SHA1 digest. This can be used to detect concurrent modifications."
                },
                "target-disk": {
                    "type": "string",
                    "description": "The config key the disk will be moved to on the target VM (for example, ide0 or scsi1). Default is the source disk key.",
                    "enum": [
                        "ide0",
                        "ide1",
                        "ide2",
                        "ide3",
                        "scsi0",
                        "scsi1",
                        "scsi2",
                        "scsi3",
                        "scsi4",
                        "scsi5",
                        "scsi6",
                        "scsi7",
                        "scsi8",
                        "scsi9",
                        "scsi10",
                        "scsi11",
                        "scsi12",
                        "scsi13",
                        "scsi14",
                        "scsi15",
                        "scsi16",
                        "scsi17",
                        "scsi18",
                        "scsi19",
                        "scsi20",
                        "scsi21",
                        "scsi22",
                        "scsi23",
                        "scsi24",
                        "scsi25",
                        "scsi26",
                        "scsi27",
                        "scsi28",
                        "scsi29",
                        "scsi30",
                        "virtio0",
                        "virtio1",
                        "virtio2",
                        "virtio3",
                        "virtio4",
                        "virtio5",
                        "virtio6",
                        "virtio7",
                        "virtio8",
                        "virtio9",
                        "virtio10",
                        "virtio11",
                        "virtio12",
                        "virtio13",
                        "virtio14",
                        "virtio15",
                        "sata0",
                        "sata1",
                        "sata2",
                        "sata3",
                        "sata4",
                        "sata5",
                        "efidisk0",
                        "tpmstate0",
                        "unused0",
                        "unused1",
                        "unused2",
                        "unused3",
                        "unused4",
                        "unused5",
                        "unused6",
                        "unused7",
                        "unused8",
                        "unused9",
                        "unused10",
                        "unused11",
                        "unused12",
                        "unused13",
                        "unused14",
                        "unused15",
                        "unused16",
                        "unused17",
                        "unused18",
                        "unused19",
                        "unused20",
                        "unused21",
                        "unused22",
                        "unused23",
                        "unused24",
                        "unused25",
                        "unused26",
                        "unused27",
                        "unused28",
                        "unused29",
                        "unused30",
                        "unused31",
                        "unused32",
                        "unused33",
                        "unused34",
                        "unused35",
                        "unused36",
                        "unused37",
                        "unused38",
                        "unused39",
                        "unused40",
                        "unused41",
                        "unused42",
                        "unused43",
                        "unused44",
                        "unused45",
                        "unused46",
                        "unused47",
                        "unused48",
                        "unused49",
                        "unused50",
                        "unused51",
                        "unused52",
                        "unused53",
                        "unused54",
                        "unused55",
                        "unused56",
                        "unused57",
                        "unused58",
                        "unused59",
                        "unused60",
                        "unused61",
                        "unused62",
                        "unused63",
                        "unused64",
                        "unused65",
                        "unused66",
                        "unused67",
                        "unused68",
                        "unused69",
                        "unused70",
                        "unused71",
                        "unused72",
                        "unused73",
                        "unused74",
                        "unused75",
                        "unused76",
                        "unused77",
                        "unused78",
                        "unused79",
                        "unused80",
                        "unused81",
                        "unused82",
                        "unused83",
                        "unused84",
                        "unused85",
                        "unused86",
                        "unused87",
                        "unused88",
                        "unused89",
                        "unused90",
                        "unused91",
                        "unused92",
                        "unused93",
                        "unused94",
                        "unused95",
                        "unused96",
                        "unused97",
                        "unused98",
                        "unused99",
                        "unused100",
                        "unused101",
                        "unused102",
                        "unused103",
                        "unused104",
                        "unused105",
                        "unused106",
                        "unused107",
                        "unused108",
                        "unused109",
                        "unused110",
                        "unused111",
                        "unused112",
                        "unused113",
                        "unused114",
                        "unused115",
                        "unused116",
                        "unused117",
                        "unused118",
                        "unused119",
                        "unused120",
                        "unused121",
                        "unused122",
                        "unused123",
                        "unused124",
                        "unused125",
                        "unused126",
                        "unused127",
                        "unused128",
                        "unused129",
                        "unused130",
                        "unused131",
                        "unused132",
                        "unused133",
                        "unused134",
                        "unused135",
                        "unused136",
                        "unused137",
                        "unused138",
                        "unused139",
                        "unused140",
                        "unused141",
                        "unused142",
                        "unused143",
                        "unused144",
                        "unused145",
                        "unused146",
                        "unused147",
                        "unused148",
                        "unused149",
                        "unused150",
                        "unused151",
                        "unused152",
                        "unused153",
                        "unused154",
                        "unused155",
                        "unused156",
                        "unused157",
                        "unused158",
                        "unused159",
                        "unused160",
                        "unused161",
                        "unused162",
                        "unused163",
                        "unused164",
                        "unused165",
                        "unused166",
                        "unused167",
                        "unused168",
                        "unused169",
                        "unused170",
                        "unused171",
                        "unused172",
                        "unused173",
                        "unused174",
                        "unused175",
                        "unused176",
                        "unused177",
                        "unused178",
                        "unused179",
                        "unused180",
                        "unused181",
                        "unused182",
                        "unused183",
                        "unused184",
                        "unused185",
                        "unused186",
                        "unused187",
                        "unused188",
                        "unused189",
                        "unused190",
                        "unused191",
                        "unused192",
                        "unused193",
                        "unused194",
                        "unused195",
                        "unused196",
                        "unused197",
                        "unused198",
                        "unused199",
                        "unused200",
                        "unused201",
                        "unused202",
                        "unused203",
                        "unused204",
                        "unused205",
                        "unused206",
                        "unused207",
                        "unused208",
                        "unused209",
                        "unused210",
                        "unused211",
                        "unused212",
                        "unused213",
                        "unused214",
                        "unused215",
                        "unused216",
                        "unused217",
                        "unused218",
                        "unused219",
                        "unused220",
                        "unused221",
                        "unused222",
                        "unused223",
                        "unused224",
                        "unused225",
                        "unused226",
                        "unused227",
                        "unused228",
                        "unused229",
                        "unused230",
                        "unused231",
                        "unused232",
                        "unused233",
                        "unused234",
                        "unused235",
                        "unused236",
                        "unused237",
                        "unused238",
                        "unused239",
                        "unused240",
                        "unused241",
                        "unused242",
                        "unused243",
                        "unused244",
                        "unused245",
                        "unused246",
                        "unused247",
                        "unused248",
                        "unused249",
                        "unused250",
                        "unused251",
                        "unused252",
                        "unused253",
                        "unused254",
                        "unused255"
                    ]
                },
                "target-vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                }
            },
            "required": [
                "node",
                "vmid",
                "disk"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/move_disk",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_migrate",
        "description": "Get preconditions for migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/migrate",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_migrate",
        "description": "Migrate virtual machine. Creates a new migration task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "migrate limit from datacenter or storage config"
                },
                "force": {
                    "type": "boolean",
                    "description": "Allow to migrate VMs which use local devices. Only root may use this option."
                },
                "migration_network": {
                    "type": "string",
                    "description": "CIDR of the (sub) network that is used for migration."
                },
                "migration_type": {
                    "type": "string",
                    "description": "Migration traffic is encrypted using an SSH tunnel by default. On secure, completely private networks this can be disabled to increase performance.",
                    "enum": [
                        "secure",
                        "insecure"
                    ]
                },
                "online": {
                    "type": "boolean",
                    "description": "Use online/live migration if VM is running. Ignored if VM is stopped."
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                },
                "targetstorage": {
                    "type": "string",
                    "description": "Mapping from source to target storages. Providing only a single storage ID maps all source storages to that storage. Providing the special value '1' will map each source storage to itself."
                },
                "with-conntrack-state": {
                    "type": "boolean",
                    "description": "Whether to migrate conntrack entries for running VMs.",
                    "default": 0
                },
                "with-local-disks": {
                    "type": "boolean",
                    "description": "Enable live storage migration for local disk"
                }
            },
            "required": [
                "node",
                "vmid",
                "target"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/migrate",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_remote_migrate",
        "description": "Migrate virtual machine to a remote cluster. Creates a new migration task. EXPERIMENTAL feature!",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "migrate limit from datacenter or storage config"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Delete the original VM and related data after successful migration. By default the original VM is kept on the source cluster in a stopped state.",
                    "default": 0
                },
                "online": {
                    "type": "boolean",
                    "description": "Use online/live migration if VM is running. Ignored if VM is stopped."
                },
                "target-bridge": {
                    "type": "string",
                    "description": "Mapping from source to target bridges. Providing only a single bridge ID maps all source bridges to that bridge. Providing the special value '1' will map each source bridge to itself."
                },
                "target-endpoint": {
                    "type": "string",
                    "description": "Remote target endpoint"
                },
                "target-storage": {
                    "type": "string",
                    "description": "Mapping from source to target storages. Providing only a single storage ID maps all source storages to that storage. Providing the special value '1' will map each source storage to itself."
                },
                "target-vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                }
            },
            "required": [
                "node",
                "vmid",
                "target-bridge",
                "target-endpoint",
                "target-storage"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/remote_migrate",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_monitor",
        "description": "Execute QEMU monitor commands.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "command": {
                    "type": "string",
                    "description": "The monitor command."
                }
            },
            "required": [
                "node",
                "vmid",
                "command"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/monitor",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_qemu_resize",
        "description": "Extend volume size.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "disk": {
                    "type": "string",
                    "description": "The disk you want to resize.",
                    "enum": [
                        "ide0",
                        "ide1",
                        "ide2",
                        "ide3",
                        "scsi0",
                        "scsi1",
                        "scsi2",
                        "scsi3",
                        "scsi4",
                        "scsi5",
                        "scsi6",
                        "scsi7",
                        "scsi8",
                        "scsi9",
                        "scsi10",
                        "scsi11",
                        "scsi12",
                        "scsi13",
                        "scsi14",
                        "scsi15",
                        "scsi16",
                        "scsi17",
                        "scsi18",
                        "scsi19",
                        "scsi20",
                        "scsi21",
                        "scsi22",
                        "scsi23",
                        "scsi24",
                        "scsi25",
                        "scsi26",
                        "scsi27",
                        "scsi28",
                        "scsi29",
                        "scsi30",
                        "virtio0",
                        "virtio1",
                        "virtio2",
                        "virtio3",
                        "virtio4",
                        "virtio5",
                        "virtio6",
                        "virtio7",
                        "virtio8",
                        "virtio9",
                        "virtio10",
                        "virtio11",
                        "virtio12",
                        "virtio13",
                        "virtio14",
                        "virtio15",
                        "sata0",
                        "sata1",
                        "sata2",
                        "sata3",
                        "sata4",
                        "sata5",
                        "efidisk0",
                        "tpmstate0"
                    ]
                },
                "size": {
                    "type": "string",
                    "description": "The new size. With the `+` sign the value is added to the actual size of the volume and without it, the value is taken as an absolute one. Shrinking disk size is not supported."
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid",
                "disk",
                "size"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/resize",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_qemu_snapshot_snapshot",
        "description": "List all snapshots.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_snapshot",
        "description": "Snapshot a VM.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "description": {
                    "type": "string",
                    "description": "A textual description or comment."
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                },
                "vmstate": {
                    "type": "boolean",
                    "description": "Save the vmstate"
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_snapshot_snapshot",
        "description": "",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot/{snapname}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_qemu_snapshot",
        "description": "Delete a VM snapshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "force": {
                    "type": "boolean",
                    "description": "For removal from config file, even if removing disk snapshots fails."
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot/{snapname}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_qemu_snapshot_config",
        "description": "Get snapshot configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot/{snapname}/config",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_qemu_snapshot_config",
        "description": "Update snapshot metadata.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "description": {
                    "type": "string",
                    "description": "A textual description or comment."
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot/{snapname}/config",
        "method": "PUT"
    },
    {
        "name": "pve_create_nodes_qemu_snapshot_rollback",
        "description": "Rollback VM state to specified snapshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "start": {
                    "type": "boolean",
                    "description": "Whether the VM should get started after rolling back successfully. (Note: VMs will be automatically started if the snapshot includes RAM.)",
                    "default": 0
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/snapshot/{snapname}/rollback",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_template",
        "description": "Create a Template.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "disk": {
                    "type": "string",
                    "description": "If you want to convert only 1 disk to base image.",
                    "enum": [
                        "ide0",
                        "ide1",
                        "ide2",
                        "ide3",
                        "scsi0",
                        "scsi1",
                        "scsi2",
                        "scsi3",
                        "scsi4",
                        "scsi5",
                        "scsi6",
                        "scsi7",
                        "scsi8",
                        "scsi9",
                        "scsi10",
                        "scsi11",
                        "scsi12",
                        "scsi13",
                        "scsi14",
                        "scsi15",
                        "scsi16",
                        "scsi17",
                        "scsi18",
                        "scsi19",
                        "scsi20",
                        "scsi21",
                        "scsi22",
                        "scsi23",
                        "scsi24",
                        "scsi25",
                        "scsi26",
                        "scsi27",
                        "scsi28",
                        "scsi29",
                        "scsi30",
                        "virtio0",
                        "virtio1",
                        "virtio2",
                        "virtio3",
                        "virtio4",
                        "virtio5",
                        "virtio6",
                        "virtio7",
                        "virtio8",
                        "virtio9",
                        "virtio10",
                        "virtio11",
                        "virtio12",
                        "virtio13",
                        "virtio14",
                        "virtio15",
                        "sata0",
                        "sata1",
                        "sata2",
                        "sata3",
                        "sata4",
                        "sata5",
                        "efidisk0",
                        "tpmstate0"
                    ]
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/template",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_qemu_mtunnel",
        "description": "Migration tunnel endpoint - only for internal use by VM migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bridges": {
                    "type": "string",
                    "description": "List of network bridges to check availability. Will be checked again for actually used bridges during migration."
                },
                "storages": {
                    "type": "string",
                    "description": "List of storages to check permission and availability. Will be checked again for all actually used storages during migration."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/mtunnel",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_qemu_mtunnelwebsocket",
        "description": "Migration tunnel endpoint for websocket upgrade - only for internal use by VM migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "socket": {
                    "type": "string",
                    "description": "unix socket to forward to"
                },
                "ticket": {
                    "type": "string",
                    "description": "ticket return by initial 'mtunnel' API call, or retrieved via 'ticket' tunnel command"
                }
            },
            "required": [
                "node",
                "vmid",
                "socket",
                "ticket"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/mtunnelwebsocket",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_qemu_dbus-vmstate",
        "description": "Control the dbus-vmstate helper for a given running VM.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "action": {
                    "type": "string",
                    "description": "Action to perform on the DBus VMState helper.",
                    "enum": [
                        "start",
                        "stop"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "action"
            ]
        },
        "path": "/nodes/{node}/qemu/{vmid}/dbus-vmstate",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_lxc",
        "description": "LXC container index (per node).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/lxc",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc",
        "description": "Create or restore a container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "arch": {
                    "type": "string",
                    "description": "OS architecture type.",
                    "enum": [
                        "amd64",
                        "i386",
                        "arm64",
                        "armhf",
                        "riscv32",
                        "riscv64"
                    ],
                    "default": "amd64"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "restore limit from datacenter or storage config"
                },
                "cmode": {
                    "type": "string",
                    "description": "Console mode. By default, the console command tries to open a connection to one of the available tty devices. By setting cmode to 'console' it tries to attach to /dev/console instead. If you set cmode to 'shell', it simply invokes a shell inside the container (no login).",
                    "enum": [
                        "shell",
                        "console",
                        "tty"
                    ],
                    "default": "tty"
                },
                "console": {
                    "type": "boolean",
                    "description": "Attach a console device (/dev/console) to the container.",
                    "default": 1
                },
                "cores": {
                    "type": "number",
                    "description": "The number of cores assigned to the container. A container can use all available cores by default."
                },
                "cpulimit": {
                    "type": "number",
                    "description": "Limit of CPU usage.\n\nNOTE: If the computer has 2 CPUs, it has a total of '2' CPU time. Value '0' indicates no CPU limit.",
                    "default": 0
                },
                "cpuunits": {
                    "type": "number",
                    "description": "CPU weight for a container, will be clamped to [1, 10000] in cgroup v2.",
                    "default": "cgroup v1: 1024, cgroup v2: 100"
                },
                "debug": {
                    "type": "boolean",
                    "description": "Try to be more verbose. For now this only enables debug log-level on start.",
                    "default": 0
                },
                "description": {
                    "type": "string",
                    "description": "Description for the Container. Shown in the web-interface CT's summary. This is saved as comment inside the configuration file."
                },
                "dev[n]": {
                    "type": "string",
                    "description": "Device to pass through to the container"
                },
                "entrypoint": {
                    "type": "string",
                    "description": "Command to run as init, optionally with arguments; may start with an absolute path, relative path, or a binary in $PATH.",
                    "default": "/sbin/init"
                },
                "env": {
                    "type": "string",
                    "description": "The container runtime environment as NUL-separated list. Replaces any lxc.environment.runtime entries in the config."
                },
                "features": {
                    "type": "string",
                    "description": "Allow containers access to advanced features."
                },
                "force": {
                    "type": "boolean",
                    "description": "Allow to overwrite existing container."
                },
                "ha-managed": {
                    "type": "boolean",
                    "description": "Add the CT as a HA resource after it was created.",
                    "default": 0
                },
                "hookscript": {
                    "type": "string",
                    "description": "Script that will be executed during various steps in the containers lifetime."
                },
                "hostname": {
                    "type": "string",
                    "description": "Set a host name for the container."
                },
                "ignore-unpack-errors": {
                    "type": "boolean",
                    "description": "Ignore errors when extracting the template."
                },
                "lock": {
                    "type": "string",
                    "description": "Lock/unlock the container.",
                    "enum": [
                        "backup",
                        "create",
                        "destroyed",
                        "disk",
                        "fstrim",
                        "migrate",
                        "mounted",
                        "rollback",
                        "snapshot",
                        "snapshot-delete"
                    ]
                },
                "memory": {
                    "type": "number",
                    "description": "Amount of RAM for the container in MB.",
                    "default": 512
                },
                "mp[n]": {
                    "type": "string",
                    "description": "Use volume as container mount point. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume."
                },
                "nameserver": {
                    "type": "string",
                    "description": "Sets DNS server IP address for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
                },
                "net[n]": {
                    "type": "string",
                    "description": "Specifies network interfaces for the container."
                },
                "onboot": {
                    "type": "boolean",
                    "description": "Specifies whether a container will be started during system bootup.",
                    "default": 0
                },
                "ostemplate": {
                    "type": "string",
                    "description": "The OS template or backup file."
                },
                "ostype": {
                    "type": "string",
                    "description": "OS type. This is used to setup configuration inside the container, and corresponds to lxc setup scripts in /usr/share/lxc/config/<ostype>.common.conf. Value 'unmanaged' can be used to skip and OS specific setup.",
                    "enum": [
                        "debian",
                        "devuan",
                        "ubuntu",
                        "centos",
                        "fedora",
                        "opensuse",
                        "archlinux",
                        "alpine",
                        "gentoo",
                        "nixos",
                        "unmanaged"
                    ]
                },
                "password": {
                    "type": "string",
                    "description": "Sets root password inside container."
                },
                "pool": {
                    "type": "string",
                    "description": "Add the VM to the specified pool."
                },
                "protection": {
                    "type": "boolean",
                    "description": "Sets the protection flag of the container. This will prevent the CT or CT's disk remove/update operation.",
                    "default": 0
                },
                "restore": {
                    "type": "boolean",
                    "description": "Mark this as restore task."
                },
                "rootfs": {
                    "type": "string",
                    "description": "Use volume as container root."
                },
                "searchdomain": {
                    "type": "string",
                    "description": "Sets DNS search domains for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
                },
                "ssh-public-keys": {
                    "type": "string",
                    "description": "Setup public SSH keys (one key per line, OpenSSH format)."
                },
                "start": {
                    "type": "boolean",
                    "description": "Start the CT after its creation finished successfully.",
                    "default": 0
                },
                "startup": {
                    "type": "string",
                    "description": "Startup and shutdown behavior. Order is a non-negative number defining the general startup order. Shutdown in done with reverse ordering. Additionally you can set the 'up' or 'down' delay in seconds, which specifies a delay to wait before the next VM is started or stopped."
                },
                "storage": {
                    "type": "string",
                    "description": "Default Storage.",
                    "default": "local"
                },
                "swap": {
                    "type": "number",
                    "description": "Amount of SWAP for the container in MB.",
                    "default": 512
                },
                "tags": {
                    "type": "string",
                    "description": "Tags of the Container. This is only meta information."
                },
                "template": {
                    "type": "boolean",
                    "description": "Enable/disable Template.",
                    "default": 0
                },
                "timezone": {
                    "type": "string",
                    "description": "Time zone to use in the container. If option isn't set, then nothing will be done. Can be set to 'host' to match the host time zone, or an arbitrary time zone option from /usr/share/zoneinfo/zone.tab"
                },
                "tty": {
                    "type": "number",
                    "description": "Specify the number of tty available to the container",
                    "default": 2
                },
                "unique": {
                    "type": "boolean",
                    "description": "Assign a unique random ethernet address."
                },
                "unprivileged": {
                    "type": "boolean",
                    "description": "Makes the container run as unprivileged user. For creation, the default is 1. For restore, the default is the value from the backup. (Should not be modified manually.)",
                    "default": 0
                },
                "unused[n]": {
                    "type": "string",
                    "description": "Reference to unused volumes. This is used internally, and should not be modified manually."
                },
                "vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                }
            },
            "required": [
                "node",
                "ostemplate",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_lxc",
        "description": "Directory index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_lxc",
        "description": "Destroy the container (also delete all uses files).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "destroy-unreferenced-disks": {
                    "type": "boolean",
                    "description": "If set, destroy additionally all disks with the VMID from all enabled storages which are not referenced in the config."
                },
                "force": {
                    "type": "boolean",
                    "description": "Force destroy, even if running.",
                    "default": 0
                },
                "purge": {
                    "type": "boolean",
                    "description": "Remove container from all related configurations. For example, backup jobs, replication jobs or HA. Related ACLs and Firewall entries will *always* be removed.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_lxc_config",
        "description": "Get container configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "current": {
                    "type": "boolean",
                    "description": "Get current values (instead of pending values).",
                    "default": 0
                },
                "snapshot": {
                    "type": "string",
                    "description": "Fetch config values from given snapshot."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/config",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_config",
        "description": "Set container options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "arch": {
                    "type": "string",
                    "description": "OS architecture type.",
                    "enum": [
                        "amd64",
                        "i386",
                        "arm64",
                        "armhf",
                        "riscv32",
                        "riscv64"
                    ],
                    "default": "amd64"
                },
                "cmode": {
                    "type": "string",
                    "description": "Console mode. By default, the console command tries to open a connection to one of the available tty devices. By setting cmode to 'console' it tries to attach to /dev/console instead. If you set cmode to 'shell', it simply invokes a shell inside the container (no login).",
                    "enum": [
                        "shell",
                        "console",
                        "tty"
                    ],
                    "default": "tty"
                },
                "console": {
                    "type": "boolean",
                    "description": "Attach a console device (/dev/console) to the container.",
                    "default": 1
                },
                "cores": {
                    "type": "number",
                    "description": "The number of cores assigned to the container. A container can use all available cores by default."
                },
                "cpulimit": {
                    "type": "number",
                    "description": "Limit of CPU usage.\n\nNOTE: If the computer has 2 CPUs, it has a total of '2' CPU time. Value '0' indicates no CPU limit.",
                    "default": 0
                },
                "cpuunits": {
                    "type": "number",
                    "description": "CPU weight for a container, will be clamped to [1, 10000] in cgroup v2.",
                    "default": "cgroup v1: 1024, cgroup v2: 100"
                },
                "debug": {
                    "type": "boolean",
                    "description": "Try to be more verbose. For now this only enables debug log-level on start.",
                    "default": 0
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description for the Container. Shown in the web-interface CT's summary. This is saved as comment inside the configuration file."
                },
                "dev[n]": {
                    "type": "string",
                    "description": "Device to pass through to the container"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "entrypoint": {
                    "type": "string",
                    "description": "Command to run as init, optionally with arguments; may start with an absolute path, relative path, or a binary in $PATH.",
                    "default": "/sbin/init"
                },
                "env": {
                    "type": "string",
                    "description": "The container runtime environment as NUL-separated list. Replaces any lxc.environment.runtime entries in the config."
                },
                "features": {
                    "type": "string",
                    "description": "Allow containers access to advanced features."
                },
                "hookscript": {
                    "type": "string",
                    "description": "Script that will be executed during various steps in the containers lifetime."
                },
                "hostname": {
                    "type": "string",
                    "description": "Set a host name for the container."
                },
                "lock": {
                    "type": "string",
                    "description": "Lock/unlock the container.",
                    "enum": [
                        "backup",
                        "create",
                        "destroyed",
                        "disk",
                        "fstrim",
                        "migrate",
                        "mounted",
                        "rollback",
                        "snapshot",
                        "snapshot-delete"
                    ]
                },
                "memory": {
                    "type": "number",
                    "description": "Amount of RAM for the container in MB.",
                    "default": 512
                },
                "mp[n]": {
                    "type": "string",
                    "description": "Use volume as container mount point. Use the special syntax STORAGE_ID:SIZE_IN_GiB to allocate a new volume."
                },
                "nameserver": {
                    "type": "string",
                    "description": "Sets DNS server IP address for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
                },
                "net[n]": {
                    "type": "string",
                    "description": "Specifies network interfaces for the container."
                },
                "onboot": {
                    "type": "boolean",
                    "description": "Specifies whether a container will be started during system bootup.",
                    "default": 0
                },
                "ostype": {
                    "type": "string",
                    "description": "OS type. This is used to setup configuration inside the container, and corresponds to lxc setup scripts in /usr/share/lxc/config/<ostype>.common.conf. Value 'unmanaged' can be used to skip and OS specific setup.",
                    "enum": [
                        "debian",
                        "devuan",
                        "ubuntu",
                        "centos",
                        "fedora",
                        "opensuse",
                        "archlinux",
                        "alpine",
                        "gentoo",
                        "nixos",
                        "unmanaged"
                    ]
                },
                "protection": {
                    "type": "boolean",
                    "description": "Sets the protection flag of the container. This will prevent the CT or CT's disk remove/update operation.",
                    "default": 0
                },
                "revert": {
                    "type": "string",
                    "description": "Revert a pending change."
                },
                "rootfs": {
                    "type": "string",
                    "description": "Use volume as container root."
                },
                "searchdomain": {
                    "type": "string",
                    "description": "Sets DNS search domains for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
                },
                "startup": {
                    "type": "string",
                    "description": "Startup and shutdown behavior. Order is a non-negative number defining the general startup order. Shutdown in done with reverse ordering. Additionally you can set the 'up' or 'down' delay in seconds, which specifies a delay to wait before the next VM is started or stopped."
                },
                "swap": {
                    "type": "number",
                    "description": "Amount of SWAP for the container in MB.",
                    "default": 512
                },
                "tags": {
                    "type": "string",
                    "description": "Tags of the Container. This is only meta information."
                },
                "template": {
                    "type": "boolean",
                    "description": "Enable/disable Template.",
                    "default": 0
                },
                "timezone": {
                    "type": "string",
                    "description": "Time zone to use in the container. If option isn't set, then nothing will be done. Can be set to 'host' to match the host time zone, or an arbitrary time zone option from /usr/share/zoneinfo/zone.tab"
                },
                "tty": {
                    "type": "number",
                    "description": "Specify the number of tty available to the container",
                    "default": 2
                },
                "unprivileged": {
                    "type": "boolean",
                    "description": "Makes the container run as unprivileged user. For creation, the default is 1. For restore, the default is the value from the backup. (Should not be modified manually.)",
                    "default": 0
                },
                "unused[n]": {
                    "type": "string",
                    "description": "Reference to unused volumes. This is used internally, and should not be modified manually."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/config",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_lxc_status",
        "description": "Directory index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_status_current",
        "description": "Get virtual machine status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/current",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_status_start",
        "description": "Start the container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "debug": {
                    "type": "boolean",
                    "description": "If set, enables very verbose debug log-level on start.",
                    "default": 0
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/start",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_status_stop",
        "description": "Stop the container. This will abruptly stop all processes running in the container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "overrule-shutdown": {
                    "type": "boolean",
                    "description": "Try to abort active 'vzshutdown' tasks before stopping.",
                    "default": 0
                },
                "skiplock": {
                    "type": "boolean",
                    "description": "Ignore locks - only root is allowed to use this option."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/stop",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_status_shutdown",
        "description": "Shutdown the container. This will trigger a clean shutdown of the container, see lxc-stop(1) for details.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "forceStop": {
                    "type": "boolean",
                    "description": "Make sure the Container stops.",
                    "default": 0
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds.",
                    "default": 60
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/shutdown",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_status_suspend",
        "description": "Suspend the container. This is experimental.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/suspend",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_status_resume",
        "description": "Resume the container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/resume",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_status_reboot",
        "description": "Reboot the container by shutting it down, and starting it again. Applies pending changes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "timeout": {
                    "type": "number",
                    "description": "Wait maximal timeout seconds for the shutdown."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/status/reboot",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_snapshot_snapshot",
        "description": "List all snapshots.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_snapshot",
        "description": "Snapshot a container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "description": {
                    "type": "string",
                    "description": "A textual description or comment."
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_snapshot_snapshot",
        "description": "",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot/{snapname}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_lxc_snapshot",
        "description": "Delete a LXC snapshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "force": {
                    "type": "boolean",
                    "description": "For removal from config file, even if removing disk snapshots fails."
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot/{snapname}",
        "method": "DELETE"
    },
    {
        "name": "pve_create_nodes_lxc_snapshot_rollback",
        "description": "Rollback LXC state to specified snapshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "start": {
                    "type": "boolean",
                    "description": "Whether the container should get started after rolling back successfully",
                    "default": 0
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot/{snapname}/rollback",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_snapshot_config",
        "description": "Get snapshot configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot/{snapname}/config",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_snapshot_config",
        "description": "Update snapshot metadata.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "snapname": {
                    "type": "string",
                    "description": "Path parameter: snapname"
                },
                "description": {
                    "type": "string",
                    "description": "A textual description or comment."
                }
            },
            "required": [
                "node",
                "vmid",
                "snapname"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/snapshot/{snapname}/config",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_lxc_firewall",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_rules_rules",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_firewall_rules",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "action",
                "type"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_rules_rules",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/rules/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_firewall_rules",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/rules/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_lxc_firewall_rules",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "pos"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/rules/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_aliases_aliases",
        "description": "List aliases",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/aliases",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_firewall_aliases",
        "description": "Create IP or Network Alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "name": {
                    "type": "string",
                    "description": "Alias name."
                }
            },
            "required": [
                "node",
                "vmid",
                "cidr",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/aliases",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_aliases_aliases",
        "description": "Read alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/aliases/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_firewall_aliases",
        "description": "Update IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing alias."
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/aliases/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_lxc_firewall_aliases",
        "description": "Remove IP or Network alias.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/aliases/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_ipset_ipset",
        "description": "List IPSets",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_firewall_ipset_ipset",
        "description": "Create new IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "name": {
                    "type": "string",
                    "description": "IP set name."
                },
                "rename": {
                    "type": "string",
                    "description": "Rename an existing IPSet. You can set 'rename' to the same value as 'name' to update the 'comment' of an existing IPSet."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_ipset_ipset",
        "description": "List IPSet content",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_firewall_ipset_ipset",
        "description": "Add IP or Network to IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Network/IP specification in CIDR format."
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_lxc_firewall_ipset_ipset",
        "description": "Delete IPSet",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "force": {
                    "type": "boolean",
                    "description": "Delete all members of the IPSet, if there are any."
                }
            },
            "required": [
                "node",
                "vmid",
                "name"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_ipset_ipset",
        "description": "Read IP or Network settings from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_firewall_ipset",
        "description": "Update IP or Network settings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "nomatch": {
                    "type": "boolean",
                    "description": "nomatch"
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_lxc_firewall_ipset_ipset",
        "description": "Remove IP or Network from IPSet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cidr": {
                    "type": "string",
                    "description": "Path parameter: cidr"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "vmid",
                "name",
                "cidr"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/ipset/{name}/{cidr}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_options",
        "description": "Get VM firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/options",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_lxc_firewall_options",
        "description": "Set Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dhcp": {
                    "type": "boolean",
                    "description": "Enable DHCP.",
                    "default": 0
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable/disable firewall rules.",
                    "default": 0
                },
                "ipfilter": {
                    "type": "boolean",
                    "description": "Enable default IP filters. This is equivalent to adding an empty ipfilter-net<id> ipset for every interface. Such ipsets implicitly contain sane default restrictions such as restricting IPv6 link local addresses to the one derived from the interface's MAC address. For containers the configured IP ad"
                },
                "log_level_in": {
                    "type": "string",
                    "description": "Log level for incoming traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "log_level_out": {
                    "type": "string",
                    "description": "Log level for outgoing traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macfilter": {
                    "type": "boolean",
                    "description": "Enable/disable MAC address filter.",
                    "default": 1
                },
                "ndp": {
                    "type": "boolean",
                    "description": "Enable NDP (Neighbor Discovery Protocol).",
                    "default": 1
                },
                "policy_in": {
                    "type": "string",
                    "description": "Input policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                },
                "policy_out": {
                    "type": "string",
                    "description": "Output policy.",
                    "enum": [
                        "ACCEPT",
                        "REJECT",
                        "DROP"
                    ]
                },
                "radv": {
                    "type": "boolean",
                    "description": "Allow sending Router Advertisement."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/options",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_log",
        "description": "Read firewall log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "since": {
                    "type": "number",
                    "description": "Display log since this UNIX epoch."
                },
                "start": {
                    "type": "number",
                    "description": "start"
                },
                "until": {
                    "type": "number",
                    "description": "Display log until this UNIX epoch."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/log",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_firewall_refs",
        "description": "Lists possible IPSet/Alias reference which are allowed in source/dest properties.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "type": {
                    "type": "string",
                    "description": "Only list references of specified type.",
                    "enum": [
                        "alias",
                        "ipset"
                    ]
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/firewall/refs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_rrd",
        "description": "Read VM RRD statistics (returns PNG)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "ds": {
                    "type": "string",
                    "description": "The list of datasources you want to display."
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "ds",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/rrd",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_rrddata",
        "description": "Read VM RRD statistics",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/rrddata",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_vncproxy",
        "description": "Creates a TCP VNC proxy connections.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "height": {
                    "type": "number",
                    "description": "sets the height of the console in pixels."
                },
                "websocket": {
                    "type": "boolean",
                    "description": "use websocket instead of standard VNC."
                },
                "width": {
                    "type": "number",
                    "description": "sets the width of the console in pixels."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/vncproxy",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_termproxy",
        "description": "Creates a TCP proxy connection.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/termproxy",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_vncwebsocket",
        "description": "Opens a websocket for VNC traffic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "port": {
                    "type": "number",
                    "description": "Port number returned by previous vncproxy call."
                },
                "vncticket": {
                    "type": "string",
                    "description": "Ticket from previous call to vncproxy."
                }
            },
            "required": [
                "node",
                "vmid",
                "port",
                "vncticket"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/vncwebsocket",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_spiceproxy",
        "description": "Returns a SPICE configuration to connect to the CT.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "proxy": {
                    "type": "string",
                    "description": "SPICE proxy server. This can be used by the client to specify the proxy server. All nodes in a cluster runs 'spiceproxy', so it is up to the client to choose one. By default, we return the node where the VM is currently running. As reasonable setting is to use same node you use to connect to the API"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/spiceproxy",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_remote_migrate",
        "description": "Migrate the container to another cluster. Creates a new migration task. EXPERIMENTAL feature!",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "migrate limit from datacenter or storage config"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Delete the original CT and related data after successful migration. By default the original CT is kept on the source cluster in a stopped state.",
                    "default": 0
                },
                "online": {
                    "type": "boolean",
                    "description": "Use online/live migration."
                },
                "restart": {
                    "type": "boolean",
                    "description": "Use restart migration"
                },
                "target-bridge": {
                    "type": "string",
                    "description": "Mapping from source to target bridges. Providing only a single bridge ID maps all source bridges to that bridge. Providing the special value '1' will map each source bridge to itself."
                },
                "target-endpoint": {
                    "type": "string",
                    "description": "Remote target endpoint"
                },
                "target-storage": {
                    "type": "string",
                    "description": "Mapping from source to target storages. Providing only a single storage ID maps all source storages to that storage. Providing the special value '1' will map each source storage to itself."
                },
                "target-vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in seconds for shutdown for restart migration",
                    "default": 180
                }
            },
            "required": [
                "node",
                "vmid",
                "target-bridge",
                "target-endpoint",
                "target-storage"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/remote_migrate",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_migrate",
        "description": "Get preconditions for migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/migrate",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_migrate",
        "description": "Migrate the container to another node. Creates a new migration task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "migrate limit from datacenter or storage config"
                },
                "online": {
                    "type": "boolean",
                    "description": "Use online/live migration."
                },
                "restart": {
                    "type": "boolean",
                    "description": "Use restart migration"
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                },
                "target-storage": {
                    "type": "string",
                    "description": "Mapping from source to target storages. Providing only a single storage ID maps all source storages to that storage. Providing the special value '1' will map each source storage to itself."
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in seconds for shutdown for restart migration",
                    "default": 180
                }
            },
            "required": [
                "node",
                "vmid",
                "target"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/migrate",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_feature",
        "description": "Check if feature for virtual machine is available.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "feature": {
                    "type": "string",
                    "description": "Feature to check.",
                    "enum": [
                        "snapshot",
                        "clone",
                        "copy"
                    ]
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                }
            },
            "required": [
                "node",
                "vmid",
                "feature"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/feature",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_template",
        "description": "Create a Template.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/template",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_lxc_clone",
        "description": "Create a container clone/copy",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "clone limit from datacenter or storage config"
                },
                "description": {
                    "type": "string",
                    "description": "Description for the new CT."
                },
                "full": {
                    "type": "boolean",
                    "description": "Create a full copy of all disks. This is always done when you clone a normal CT. For CT templates, we try to create a linked clone by default."
                },
                "hostname": {
                    "type": "string",
                    "description": "Set a hostname for the new CT."
                },
                "newid": {
                    "type": "number",
                    "description": "VMID for the clone."
                },
                "pool": {
                    "type": "string",
                    "description": "Add the new CT to the specified pool."
                },
                "snapname": {
                    "type": "string",
                    "description": "The name of the snapshot."
                },
                "storage": {
                    "type": "string",
                    "description": "Target storage for full clone."
                },
                "target": {
                    "type": "string",
                    "description": "Target node. Only allowed if the original VM is on shared storage."
                }
            },
            "required": [
                "node",
                "vmid",
                "newid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/clone",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_lxc_resize",
        "description": "Resize a container mount point.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "disk": {
                    "type": "string",
                    "description": "The disk you want to resize.",
                    "enum": [
                        "rootfs",
                        "mp0",
                        "mp1",
                        "mp2",
                        "mp3",
                        "mp4",
                        "mp5",
                        "mp6",
                        "mp7",
                        "mp8",
                        "mp9",
                        "mp10",
                        "mp11",
                        "mp12",
                        "mp13",
                        "mp14",
                        "mp15",
                        "mp16",
                        "mp17",
                        "mp18",
                        "mp19",
                        "mp20",
                        "mp21",
                        "mp22",
                        "mp23",
                        "mp24",
                        "mp25",
                        "mp26",
                        "mp27",
                        "mp28",
                        "mp29",
                        "mp30",
                        "mp31",
                        "mp32",
                        "mp33",
                        "mp34",
                        "mp35",
                        "mp36",
                        "mp37",
                        "mp38",
                        "mp39",
                        "mp40",
                        "mp41",
                        "mp42",
                        "mp43",
                        "mp44",
                        "mp45",
                        "mp46",
                        "mp47",
                        "mp48",
                        "mp49",
                        "mp50",
                        "mp51",
                        "mp52",
                        "mp53",
                        "mp54",
                        "mp55",
                        "mp56",
                        "mp57",
                        "mp58",
                        "mp59",
                        "mp60",
                        "mp61",
                        "mp62",
                        "mp63",
                        "mp64",
                        "mp65",
                        "mp66",
                        "mp67",
                        "mp68",
                        "mp69",
                        "mp70",
                        "mp71",
                        "mp72",
                        "mp73",
                        "mp74",
                        "mp75",
                        "mp76",
                        "mp77",
                        "mp78",
                        "mp79",
                        "mp80",
                        "mp81",
                        "mp82",
                        "mp83",
                        "mp84",
                        "mp85",
                        "mp86",
                        "mp87",
                        "mp88",
                        "mp89",
                        "mp90",
                        "mp91",
                        "mp92",
                        "mp93",
                        "mp94",
                        "mp95",
                        "mp96",
                        "mp97",
                        "mp98",
                        "mp99",
                        "mp100",
                        "mp101",
                        "mp102",
                        "mp103",
                        "mp104",
                        "mp105",
                        "mp106",
                        "mp107",
                        "mp108",
                        "mp109",
                        "mp110",
                        "mp111",
                        "mp112",
                        "mp113",
                        "mp114",
                        "mp115",
                        "mp116",
                        "mp117",
                        "mp118",
                        "mp119",
                        "mp120",
                        "mp121",
                        "mp122",
                        "mp123",
                        "mp124",
                        "mp125",
                        "mp126",
                        "mp127",
                        "mp128",
                        "mp129",
                        "mp130",
                        "mp131",
                        "mp132",
                        "mp133",
                        "mp134",
                        "mp135",
                        "mp136",
                        "mp137",
                        "mp138",
                        "mp139",
                        "mp140",
                        "mp141",
                        "mp142",
                        "mp143",
                        "mp144",
                        "mp145",
                        "mp146",
                        "mp147",
                        "mp148",
                        "mp149",
                        "mp150",
                        "mp151",
                        "mp152",
                        "mp153",
                        "mp154",
                        "mp155",
                        "mp156",
                        "mp157",
                        "mp158",
                        "mp159",
                        "mp160",
                        "mp161",
                        "mp162",
                        "mp163",
                        "mp164",
                        "mp165",
                        "mp166",
                        "mp167",
                        "mp168",
                        "mp169",
                        "mp170",
                        "mp171",
                        "mp172",
                        "mp173",
                        "mp174",
                        "mp175",
                        "mp176",
                        "mp177",
                        "mp178",
                        "mp179",
                        "mp180",
                        "mp181",
                        "mp182",
                        "mp183",
                        "mp184",
                        "mp185",
                        "mp186",
                        "mp187",
                        "mp188",
                        "mp189",
                        "mp190",
                        "mp191",
                        "mp192",
                        "mp193",
                        "mp194",
                        "mp195",
                        "mp196",
                        "mp197",
                        "mp198",
                        "mp199",
                        "mp200",
                        "mp201",
                        "mp202",
                        "mp203",
                        "mp204",
                        "mp205",
                        "mp206",
                        "mp207",
                        "mp208",
                        "mp209",
                        "mp210",
                        "mp211",
                        "mp212",
                        "mp213",
                        "mp214",
                        "mp215",
                        "mp216",
                        "mp217",
                        "mp218",
                        "mp219",
                        "mp220",
                        "mp221",
                        "mp222",
                        "mp223",
                        "mp224",
                        "mp225",
                        "mp226",
                        "mp227",
                        "mp228",
                        "mp229",
                        "mp230",
                        "mp231",
                        "mp232",
                        "mp233",
                        "mp234",
                        "mp235",
                        "mp236",
                        "mp237",
                        "mp238",
                        "mp239",
                        "mp240",
                        "mp241",
                        "mp242",
                        "mp243",
                        "mp244",
                        "mp245",
                        "mp246",
                        "mp247",
                        "mp248",
                        "mp249",
                        "mp250",
                        "mp251",
                        "mp252",
                        "mp253",
                        "mp254",
                        "mp255"
                    ]
                },
                "size": {
                    "type": "string",
                    "description": "The new size. With the '+' sign the value is added to the actual size of the volume and without it, the value is taken as an absolute one. Shrinking disk size is not supported."
                }
            },
            "required": [
                "node",
                "vmid",
                "disk",
                "size"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/resize",
        "method": "PUT"
    },
    {
        "name": "pve_create_nodes_lxc_move_volume",
        "description": "Move a rootfs-/mp-volume to a different storage or to a different container.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Override I/O bandwidth limit (in KiB/s).",
                    "default": "clone limit from datacenter or storage config"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Delete the original volume after successful copy. By default the original is kept as an unused volume entry.",
                    "default": 0
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 \" .\n\t\t    \"digest. This can be used to prevent concurrent modifications."
                },
                "storage": {
                    "type": "string",
                    "description": "Target Storage."
                },
                "target-digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file of the target \" .\n\t\t    \"container has a different SHA1 digest. This can be used to prevent \" .\n\t\t    \"concurrent modifications."
                },
                "target-vmid": {
                    "type": "number",
                    "description": "The (unique) ID of the VM."
                },
                "target-volume": {
                    "type": "string",
                    "description": "The config key the volume will be moved to. Default is the source volume key.",
                    "enum": [
                        "rootfs",
                        "mp0",
                        "mp1",
                        "mp2",
                        "mp3",
                        "mp4",
                        "mp5",
                        "mp6",
                        "mp7",
                        "mp8",
                        "mp9",
                        "mp10",
                        "mp11",
                        "mp12",
                        "mp13",
                        "mp14",
                        "mp15",
                        "mp16",
                        "mp17",
                        "mp18",
                        "mp19",
                        "mp20",
                        "mp21",
                        "mp22",
                        "mp23",
                        "mp24",
                        "mp25",
                        "mp26",
                        "mp27",
                        "mp28",
                        "mp29",
                        "mp30",
                        "mp31",
                        "mp32",
                        "mp33",
                        "mp34",
                        "mp35",
                        "mp36",
                        "mp37",
                        "mp38",
                        "mp39",
                        "mp40",
                        "mp41",
                        "mp42",
                        "mp43",
                        "mp44",
                        "mp45",
                        "mp46",
                        "mp47",
                        "mp48",
                        "mp49",
                        "mp50",
                        "mp51",
                        "mp52",
                        "mp53",
                        "mp54",
                        "mp55",
                        "mp56",
                        "mp57",
                        "mp58",
                        "mp59",
                        "mp60",
                        "mp61",
                        "mp62",
                        "mp63",
                        "mp64",
                        "mp65",
                        "mp66",
                        "mp67",
                        "mp68",
                        "mp69",
                        "mp70",
                        "mp71",
                        "mp72",
                        "mp73",
                        "mp74",
                        "mp75",
                        "mp76",
                        "mp77",
                        "mp78",
                        "mp79",
                        "mp80",
                        "mp81",
                        "mp82",
                        "mp83",
                        "mp84",
                        "mp85",
                        "mp86",
                        "mp87",
                        "mp88",
                        "mp89",
                        "mp90",
                        "mp91",
                        "mp92",
                        "mp93",
                        "mp94",
                        "mp95",
                        "mp96",
                        "mp97",
                        "mp98",
                        "mp99",
                        "mp100",
                        "mp101",
                        "mp102",
                        "mp103",
                        "mp104",
                        "mp105",
                        "mp106",
                        "mp107",
                        "mp108",
                        "mp109",
                        "mp110",
                        "mp111",
                        "mp112",
                        "mp113",
                        "mp114",
                        "mp115",
                        "mp116",
                        "mp117",
                        "mp118",
                        "mp119",
                        "mp120",
                        "mp121",
                        "mp122",
                        "mp123",
                        "mp124",
                        "mp125",
                        "mp126",
                        "mp127",
                        "mp128",
                        "mp129",
                        "mp130",
                        "mp131",
                        "mp132",
                        "mp133",
                        "mp134",
                        "mp135",
                        "mp136",
                        "mp137",
                        "mp138",
                        "mp139",
                        "mp140",
                        "mp141",
                        "mp142",
                        "mp143",
                        "mp144",
                        "mp145",
                        "mp146",
                        "mp147",
                        "mp148",
                        "mp149",
                        "mp150",
                        "mp151",
                        "mp152",
                        "mp153",
                        "mp154",
                        "mp155",
                        "mp156",
                        "mp157",
                        "mp158",
                        "mp159",
                        "mp160",
                        "mp161",
                        "mp162",
                        "mp163",
                        "mp164",
                        "mp165",
                        "mp166",
                        "mp167",
                        "mp168",
                        "mp169",
                        "mp170",
                        "mp171",
                        "mp172",
                        "mp173",
                        "mp174",
                        "mp175",
                        "mp176",
                        "mp177",
                        "mp178",
                        "mp179",
                        "mp180",
                        "mp181",
                        "mp182",
                        "mp183",
                        "mp184",
                        "mp185",
                        "mp186",
                        "mp187",
                        "mp188",
                        "mp189",
                        "mp190",
                        "mp191",
                        "mp192",
                        "mp193",
                        "mp194",
                        "mp195",
                        "mp196",
                        "mp197",
                        "mp198",
                        "mp199",
                        "mp200",
                        "mp201",
                        "mp202",
                        "mp203",
                        "mp204",
                        "mp205",
                        "mp206",
                        "mp207",
                        "mp208",
                        "mp209",
                        "mp210",
                        "mp211",
                        "mp212",
                        "mp213",
                        "mp214",
                        "mp215",
                        "mp216",
                        "mp217",
                        "mp218",
                        "mp219",
                        "mp220",
                        "mp221",
                        "mp222",
                        "mp223",
                        "mp224",
                        "mp225",
                        "mp226",
                        "mp227",
                        "mp228",
                        "mp229",
                        "mp230",
                        "mp231",
                        "mp232",
                        "mp233",
                        "mp234",
                        "mp235",
                        "mp236",
                        "mp237",
                        "mp238",
                        "mp239",
                        "mp240",
                        "mp241",
                        "mp242",
                        "mp243",
                        "mp244",
                        "mp245",
                        "mp246",
                        "mp247",
                        "mp248",
                        "mp249",
                        "mp250",
                        "mp251",
                        "mp252",
                        "mp253",
                        "mp254",
                        "mp255",
                        "unused0",
                        "unused1",
                        "unused2",
                        "unused3",
                        "unused4",
                        "unused5",
                        "unused6",
                        "unused7",
                        "unused8",
                        "unused9",
                        "unused10",
                        "unused11",
                        "unused12",
                        "unused13",
                        "unused14",
                        "unused15",
                        "unused16",
                        "unused17",
                        "unused18",
                        "unused19",
                        "unused20",
                        "unused21",
                        "unused22",
                        "unused23",
                        "unused24",
                        "unused25",
                        "unused26",
                        "unused27",
                        "unused28",
                        "unused29",
                        "unused30",
                        "unused31",
                        "unused32",
                        "unused33",
                        "unused34",
                        "unused35",
                        "unused36",
                        "unused37",
                        "unused38",
                        "unused39",
                        "unused40",
                        "unused41",
                        "unused42",
                        "unused43",
                        "unused44",
                        "unused45",
                        "unused46",
                        "unused47",
                        "unused48",
                        "unused49",
                        "unused50",
                        "unused51",
                        "unused52",
                        "unused53",
                        "unused54",
                        "unused55",
                        "unused56",
                        "unused57",
                        "unused58",
                        "unused59",
                        "unused60",
                        "unused61",
                        "unused62",
                        "unused63",
                        "unused64",
                        "unused65",
                        "unused66",
                        "unused67",
                        "unused68",
                        "unused69",
                        "unused70",
                        "unused71",
                        "unused72",
                        "unused73",
                        "unused74",
                        "unused75",
                        "unused76",
                        "unused77",
                        "unused78",
                        "unused79",
                        "unused80",
                        "unused81",
                        "unused82",
                        "unused83",
                        "unused84",
                        "unused85",
                        "unused86",
                        "unused87",
                        "unused88",
                        "unused89",
                        "unused90",
                        "unused91",
                        "unused92",
                        "unused93",
                        "unused94",
                        "unused95",
                        "unused96",
                        "unused97",
                        "unused98",
                        "unused99",
                        "unused100",
                        "unused101",
                        "unused102",
                        "unused103",
                        "unused104",
                        "unused105",
                        "unused106",
                        "unused107",
                        "unused108",
                        "unused109",
                        "unused110",
                        "unused111",
                        "unused112",
                        "unused113",
                        "unused114",
                        "unused115",
                        "unused116",
                        "unused117",
                        "unused118",
                        "unused119",
                        "unused120",
                        "unused121",
                        "unused122",
                        "unused123",
                        "unused124",
                        "unused125",
                        "unused126",
                        "unused127",
                        "unused128",
                        "unused129",
                        "unused130",
                        "unused131",
                        "unused132",
                        "unused133",
                        "unused134",
                        "unused135",
                        "unused136",
                        "unused137",
                        "unused138",
                        "unused139",
                        "unused140",
                        "unused141",
                        "unused142",
                        "unused143",
                        "unused144",
                        "unused145",
                        "unused146",
                        "unused147",
                        "unused148",
                        "unused149",
                        "unused150",
                        "unused151",
                        "unused152",
                        "unused153",
                        "unused154",
                        "unused155",
                        "unused156",
                        "unused157",
                        "unused158",
                        "unused159",
                        "unused160",
                        "unused161",
                        "unused162",
                        "unused163",
                        "unused164",
                        "unused165",
                        "unused166",
                        "unused167",
                        "unused168",
                        "unused169",
                        "unused170",
                        "unused171",
                        "unused172",
                        "unused173",
                        "unused174",
                        "unused175",
                        "unused176",
                        "unused177",
                        "unused178",
                        "unused179",
                        "unused180",
                        "unused181",
                        "unused182",
                        "unused183",
                        "unused184",
                        "unused185",
                        "unused186",
                        "unused187",
                        "unused188",
                        "unused189",
                        "unused190",
                        "unused191",
                        "unused192",
                        "unused193",
                        "unused194",
                        "unused195",
                        "unused196",
                        "unused197",
                        "unused198",
                        "unused199",
                        "unused200",
                        "unused201",
                        "unused202",
                        "unused203",
                        "unused204",
                        "unused205",
                        "unused206",
                        "unused207",
                        "unused208",
                        "unused209",
                        "unused210",
                        "unused211",
                        "unused212",
                        "unused213",
                        "unused214",
                        "unused215",
                        "unused216",
                        "unused217",
                        "unused218",
                        "unused219",
                        "unused220",
                        "unused221",
                        "unused222",
                        "unused223",
                        "unused224",
                        "unused225",
                        "unused226",
                        "unused227",
                        "unused228",
                        "unused229",
                        "unused230",
                        "unused231",
                        "unused232",
                        "unused233",
                        "unused234",
                        "unused235",
                        "unused236",
                        "unused237",
                        "unused238",
                        "unused239",
                        "unused240",
                        "unused241",
                        "unused242",
                        "unused243",
                        "unused244",
                        "unused245",
                        "unused246",
                        "unused247",
                        "unused248",
                        "unused249",
                        "unused250",
                        "unused251",
                        "unused252",
                        "unused253",
                        "unused254",
                        "unused255"
                    ]
                },
                "volume": {
                    "type": "string",
                    "description": "Volume which will be moved.",
                    "enum": [
                        "rootfs",
                        "mp0",
                        "mp1",
                        "mp2",
                        "mp3",
                        "mp4",
                        "mp5",
                        "mp6",
                        "mp7",
                        "mp8",
                        "mp9",
                        "mp10",
                        "mp11",
                        "mp12",
                        "mp13",
                        "mp14",
                        "mp15",
                        "mp16",
                        "mp17",
                        "mp18",
                        "mp19",
                        "mp20",
                        "mp21",
                        "mp22",
                        "mp23",
                        "mp24",
                        "mp25",
                        "mp26",
                        "mp27",
                        "mp28",
                        "mp29",
                        "mp30",
                        "mp31",
                        "mp32",
                        "mp33",
                        "mp34",
                        "mp35",
                        "mp36",
                        "mp37",
                        "mp38",
                        "mp39",
                        "mp40",
                        "mp41",
                        "mp42",
                        "mp43",
                        "mp44",
                        "mp45",
                        "mp46",
                        "mp47",
                        "mp48",
                        "mp49",
                        "mp50",
                        "mp51",
                        "mp52",
                        "mp53",
                        "mp54",
                        "mp55",
                        "mp56",
                        "mp57",
                        "mp58",
                        "mp59",
                        "mp60",
                        "mp61",
                        "mp62",
                        "mp63",
                        "mp64",
                        "mp65",
                        "mp66",
                        "mp67",
                        "mp68",
                        "mp69",
                        "mp70",
                        "mp71",
                        "mp72",
                        "mp73",
                        "mp74",
                        "mp75",
                        "mp76",
                        "mp77",
                        "mp78",
                        "mp79",
                        "mp80",
                        "mp81",
                        "mp82",
                        "mp83",
                        "mp84",
                        "mp85",
                        "mp86",
                        "mp87",
                        "mp88",
                        "mp89",
                        "mp90",
                        "mp91",
                        "mp92",
                        "mp93",
                        "mp94",
                        "mp95",
                        "mp96",
                        "mp97",
                        "mp98",
                        "mp99",
                        "mp100",
                        "mp101",
                        "mp102",
                        "mp103",
                        "mp104",
                        "mp105",
                        "mp106",
                        "mp107",
                        "mp108",
                        "mp109",
                        "mp110",
                        "mp111",
                        "mp112",
                        "mp113",
                        "mp114",
                        "mp115",
                        "mp116",
                        "mp117",
                        "mp118",
                        "mp119",
                        "mp120",
                        "mp121",
                        "mp122",
                        "mp123",
                        "mp124",
                        "mp125",
                        "mp126",
                        "mp127",
                        "mp128",
                        "mp129",
                        "mp130",
                        "mp131",
                        "mp132",
                        "mp133",
                        "mp134",
                        "mp135",
                        "mp136",
                        "mp137",
                        "mp138",
                        "mp139",
                        "mp140",
                        "mp141",
                        "mp142",
                        "mp143",
                        "mp144",
                        "mp145",
                        "mp146",
                        "mp147",
                        "mp148",
                        "mp149",
                        "mp150",
                        "mp151",
                        "mp152",
                        "mp153",
                        "mp154",
                        "mp155",
                        "mp156",
                        "mp157",
                        "mp158",
                        "mp159",
                        "mp160",
                        "mp161",
                        "mp162",
                        "mp163",
                        "mp164",
                        "mp165",
                        "mp166",
                        "mp167",
                        "mp168",
                        "mp169",
                        "mp170",
                        "mp171",
                        "mp172",
                        "mp173",
                        "mp174",
                        "mp175",
                        "mp176",
                        "mp177",
                        "mp178",
                        "mp179",
                        "mp180",
                        "mp181",
                        "mp182",
                        "mp183",
                        "mp184",
                        "mp185",
                        "mp186",
                        "mp187",
                        "mp188",
                        "mp189",
                        "mp190",
                        "mp191",
                        "mp192",
                        "mp193",
                        "mp194",
                        "mp195",
                        "mp196",
                        "mp197",
                        "mp198",
                        "mp199",
                        "mp200",
                        "mp201",
                        "mp202",
                        "mp203",
                        "mp204",
                        "mp205",
                        "mp206",
                        "mp207",
                        "mp208",
                        "mp209",
                        "mp210",
                        "mp211",
                        "mp212",
                        "mp213",
                        "mp214",
                        "mp215",
                        "mp216",
                        "mp217",
                        "mp218",
                        "mp219",
                        "mp220",
                        "mp221",
                        "mp222",
                        "mp223",
                        "mp224",
                        "mp225",
                        "mp226",
                        "mp227",
                        "mp228",
                        "mp229",
                        "mp230",
                        "mp231",
                        "mp232",
                        "mp233",
                        "mp234",
                        "mp235",
                        "mp236",
                        "mp237",
                        "mp238",
                        "mp239",
                        "mp240",
                        "mp241",
                        "mp242",
                        "mp243",
                        "mp244",
                        "mp245",
                        "mp246",
                        "mp247",
                        "mp248",
                        "mp249",
                        "mp250",
                        "mp251",
                        "mp252",
                        "mp253",
                        "mp254",
                        "mp255",
                        "unused0",
                        "unused1",
                        "unused2",
                        "unused3",
                        "unused4",
                        "unused5",
                        "unused6",
                        "unused7",
                        "unused8",
                        "unused9",
                        "unused10",
                        "unused11",
                        "unused12",
                        "unused13",
                        "unused14",
                        "unused15",
                        "unused16",
                        "unused17",
                        "unused18",
                        "unused19",
                        "unused20",
                        "unused21",
                        "unused22",
                        "unused23",
                        "unused24",
                        "unused25",
                        "unused26",
                        "unused27",
                        "unused28",
                        "unused29",
                        "unused30",
                        "unused31",
                        "unused32",
                        "unused33",
                        "unused34",
                        "unused35",
                        "unused36",
                        "unused37",
                        "unused38",
                        "unused39",
                        "unused40",
                        "unused41",
                        "unused42",
                        "unused43",
                        "unused44",
                        "unused45",
                        "unused46",
                        "unused47",
                        "unused48",
                        "unused49",
                        "unused50",
                        "unused51",
                        "unused52",
                        "unused53",
                        "unused54",
                        "unused55",
                        "unused56",
                        "unused57",
                        "unused58",
                        "unused59",
                        "unused60",
                        "unused61",
                        "unused62",
                        "unused63",
                        "unused64",
                        "unused65",
                        "unused66",
                        "unused67",
                        "unused68",
                        "unused69",
                        "unused70",
                        "unused71",
                        "unused72",
                        "unused73",
                        "unused74",
                        "unused75",
                        "unused76",
                        "unused77",
                        "unused78",
                        "unused79",
                        "unused80",
                        "unused81",
                        "unused82",
                        "unused83",
                        "unused84",
                        "unused85",
                        "unused86",
                        "unused87",
                        "unused88",
                        "unused89",
                        "unused90",
                        "unused91",
                        "unused92",
                        "unused93",
                        "unused94",
                        "unused95",
                        "unused96",
                        "unused97",
                        "unused98",
                        "unused99",
                        "unused100",
                        "unused101",
                        "unused102",
                        "unused103",
                        "unused104",
                        "unused105",
                        "unused106",
                        "unused107",
                        "unused108",
                        "unused109",
                        "unused110",
                        "unused111",
                        "unused112",
                        "unused113",
                        "unused114",
                        "unused115",
                        "unused116",
                        "unused117",
                        "unused118",
                        "unused119",
                        "unused120",
                        "unused121",
                        "unused122",
                        "unused123",
                        "unused124",
                        "unused125",
                        "unused126",
                        "unused127",
                        "unused128",
                        "unused129",
                        "unused130",
                        "unused131",
                        "unused132",
                        "unused133",
                        "unused134",
                        "unused135",
                        "unused136",
                        "unused137",
                        "unused138",
                        "unused139",
                        "unused140",
                        "unused141",
                        "unused142",
                        "unused143",
                        "unused144",
                        "unused145",
                        "unused146",
                        "unused147",
                        "unused148",
                        "unused149",
                        "unused150",
                        "unused151",
                        "unused152",
                        "unused153",
                        "unused154",
                        "unused155",
                        "unused156",
                        "unused157",
                        "unused158",
                        "unused159",
                        "unused160",
                        "unused161",
                        "unused162",
                        "unused163",
                        "unused164",
                        "unused165",
                        "unused166",
                        "unused167",
                        "unused168",
                        "unused169",
                        "unused170",
                        "unused171",
                        "unused172",
                        "unused173",
                        "unused174",
                        "unused175",
                        "unused176",
                        "unused177",
                        "unused178",
                        "unused179",
                        "unused180",
                        "unused181",
                        "unused182",
                        "unused183",
                        "unused184",
                        "unused185",
                        "unused186",
                        "unused187",
                        "unused188",
                        "unused189",
                        "unused190",
                        "unused191",
                        "unused192",
                        "unused193",
                        "unused194",
                        "unused195",
                        "unused196",
                        "unused197",
                        "unused198",
                        "unused199",
                        "unused200",
                        "unused201",
                        "unused202",
                        "unused203",
                        "unused204",
                        "unused205",
                        "unused206",
                        "unused207",
                        "unused208",
                        "unused209",
                        "unused210",
                        "unused211",
                        "unused212",
                        "unused213",
                        "unused214",
                        "unused215",
                        "unused216",
                        "unused217",
                        "unused218",
                        "unused219",
                        "unused220",
                        "unused221",
                        "unused222",
                        "unused223",
                        "unused224",
                        "unused225",
                        "unused226",
                        "unused227",
                        "unused228",
                        "unused229",
                        "unused230",
                        "unused231",
                        "unused232",
                        "unused233",
                        "unused234",
                        "unused235",
                        "unused236",
                        "unused237",
                        "unused238",
                        "unused239",
                        "unused240",
                        "unused241",
                        "unused242",
                        "unused243",
                        "unused244",
                        "unused245",
                        "unused246",
                        "unused247",
                        "unused248",
                        "unused249",
                        "unused250",
                        "unused251",
                        "unused252",
                        "unused253",
                        "unused254",
                        "unused255"
                    ]
                }
            },
            "required": [
                "node",
                "vmid",
                "volume"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/move_volume",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_pending",
        "description": "Get container configuration, including pending changes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/pending",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_lxc_interfaces",
        "description": "Get IP addresses of the specified container interface.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/interfaces",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_lxc_mtunnel",
        "description": "Migration tunnel endpoint - only for internal use by CT migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "bridges": {
                    "type": "string",
                    "description": "List of network bridges to check availability. Will be checked again for actually used bridges during migration."
                },
                "storages": {
                    "type": "string",
                    "description": "List of storages to check permission and availability. Will be checked again for all actually used storages during migration."
                }
            },
            "required": [
                "node",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/mtunnel",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_lxc_mtunnelwebsocket",
        "description": "Migration tunnel endpoint for websocket upgrade - only for internal use by VM migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vmid": {
                    "type": "string",
                    "description": "Path parameter: vmid"
                },
                "socket": {
                    "type": "string",
                    "description": "unix socket to forward to"
                },
                "ticket": {
                    "type": "string",
                    "description": "ticket return by initial 'mtunnel' API call, or retrieved via 'ticket' tunnel command"
                }
            },
            "required": [
                "node",
                "vmid",
                "socket",
                "ticket"
            ]
        },
        "path": "/nodes/{node}/lxc/{vmid}/mtunnelwebsocket",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_cfg",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/cfg",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_cfg_raw",
        "description": "Get the Ceph configuration file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/cfg/raw",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_cfg_db",
        "description": "Get the Ceph configuration database.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/cfg/db",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_cfg_value",
        "description": "Get configured values from either the config file or config DB.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "config-keys": {
                    "type": "string",
                    "description": "List of <section>:<config key> items."
                }
            },
            "required": [
                "node",
                "config-keys"
            ]
        },
        "path": "/nodes/{node}/ceph/cfg/value",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_osd_osd",
        "description": "Get Ceph osd list/tree.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/osd",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_osd",
        "description": "Create OSD",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "crush-device-class": {
                    "type": "string",
                    "description": "Set the device class of the OSD in crush."
                },
                "db_dev": {
                    "type": "string",
                    "description": "Block device name for block.db."
                },
                "db_dev_size": {
                    "type": "number",
                    "description": "Size in GiB for block.db.",
                    "default": "bluestore_block_db_size or 10% of OSD size"
                },
                "dev": {
                    "type": "string",
                    "description": "Block device name."
                },
                "encrypted": {
                    "type": "boolean",
                    "description": "Enables encryption of the OSD.",
                    "default": 0
                },
                "osds-per-device": {
                    "type": "number",
                    "description": "OSD services per physical device. Only useful for fast NVMe devices\"\n\t\t    .\" to utilize their performance better."
                },
                "wal_dev": {
                    "type": "string",
                    "description": "Block device name for block.wal."
                },
                "wal_dev_size": {
                    "type": "number",
                    "description": "Size in GiB for block.wal.",
                    "default": "bluestore_block_wal_size or 1% of OSD size"
                }
            },
            "required": [
                "node",
                "dev"
            ]
        },
        "path": "/nodes/{node}/ceph/osd",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_ceph_osd_osd",
        "description": "OSD index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_ceph_osd",
        "description": "Destroy OSD",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                },
                "cleanup": {
                    "type": "boolean",
                    "description": "If set, we remove partition table entries.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_ceph_osd_metadata",
        "description": "Get OSD details",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}/metadata",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_osd_lv-info",
        "description": "Get OSD volume details",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                },
                "type": {
                    "type": "string",
                    "description": "OSD device type",
                    "enum": [
                        "block",
                        "db",
                        "wal"
                    ],
                    "default": "block"
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}/lv-info",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_osd_in",
        "description": "ceph osd in",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}/in",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_ceph_osd_out",
        "description": "ceph osd out",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}/out",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_ceph_osd_scrub",
        "description": "Instruct the OSD to scrub.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "osdid": {
                    "type": "string",
                    "description": "Path parameter: osdid"
                },
                "deep": {
                    "type": "boolean",
                    "description": "If set, instructs a deep scrub instead of a normal one.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "osdid"
            ]
        },
        "path": "/nodes/{node}/ceph/osd/{osdid}/scrub",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_ceph_mds",
        "description": "MDS directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/mds",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_mds",
        "description": "Create Ceph Metadata Server (MDS)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "hotstandby": {
                    "type": "boolean",
                    "description": "Determines whether a ceph-mds daemon should poll and replay the log of an active MDS. Faster switch on MDS failure, but needs more idle resources.",
                    "default": "0"
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/mds/{name}",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_ceph_mds",
        "description": "Destroy Ceph Metadata Server",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/mds/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_ceph_mgr",
        "description": "MGR directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/mgr",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_mgr",
        "description": "Create Ceph Manager",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/ceph/mgr/{id}",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_ceph_mgr",
        "description": "Destroy Ceph Manager.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/ceph/mgr/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_ceph_mon",
        "description": "Get Ceph monitor list.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/mon",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_mon",
        "description": "Create Ceph Monitor and Manager",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "monid": {
                    "type": "string",
                    "description": "Path parameter: monid"
                },
                "mon-address": {
                    "type": "string",
                    "description": "Overwrites autodetected monitor IP address(es). Must be in the public network(s) of Ceph."
                }
            },
            "required": [
                "node",
                "monid"
            ]
        },
        "path": "/nodes/{node}/ceph/mon/{monid}",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_ceph_mon",
        "description": "Destroy Ceph Monitor and Manager.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "monid": {
                    "type": "string",
                    "description": "Path parameter: monid"
                }
            },
            "required": [
                "node",
                "monid"
            ]
        },
        "path": "/nodes/{node}/ceph/mon/{monid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_ceph_fs",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/fs",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_fs",
        "description": "Create a Ceph filesystem",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "add-storage": {
                    "type": "boolean",
                    "description": "Configure the created CephFS as storage for this cluster.",
                    "default": 0
                },
                "pg_num": {
                    "type": "number",
                    "description": "Number of placement groups for the backing data pool. The metadata pool will use a quarter of this.",
                    "default": 128
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/fs/{name}",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_ceph_pool_pool",
        "description": "List all pools and their settings (which are settable by the POST/PUT endpoints).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/pool",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_pool",
        "description": "Create Ceph pool",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "add_storages": {
                    "type": "boolean",
                    "description": "Configure VM and CT storage using the new pool.",
                    "default": "0; for erasure coded pools: 1"
                },
                "application": {
                    "type": "string",
                    "description": "The application of the pool.",
                    "enum": [
                        "rbd",
                        "cephfs",
                        "rgw"
                    ],
                    "default": "rbd"
                },
                "crush_rule": {
                    "type": "string",
                    "description": "The rule to use for mapping object placement in the cluster."
                },
                "erasure-coding": {
                    "type": "string",
                    "description": "Create an erasure coded pool for RBD with an accompaning replicated pool for metadata storage. With EC, the common ceph options 'size', 'min_size' and 'crush_rule' parameters will be applied to the metadata pool."
                },
                "min_size": {
                    "type": "number",
                    "description": "Minimum number of replicas per object",
                    "default": 2
                },
                "name": {
                    "type": "string",
                    "description": "The name of the pool. It must be unique."
                },
                "pg_autoscale_mode": {
                    "type": "string",
                    "description": "The automatic PG scaling mode of the pool.",
                    "enum": [
                        "on",
                        "off",
                        "warn"
                    ],
                    "default": "warn"
                },
                "pg_num": {
                    "type": "number",
                    "description": "Number of placement groups.",
                    "default": 128
                },
                "pg_num_min": {
                    "type": "number",
                    "description": "Minimal number of placement groups."
                },
                "size": {
                    "type": "number",
                    "description": "Number of replicas per object",
                    "default": 3
                },
                "target_size": {
                    "type": "string",
                    "description": "The estimated target size of the pool for the PG autoscaler."
                },
                "target_size_ratio": {
                    "type": "number",
                    "description": "The estimated target ratio of the pool for the PG autoscaler."
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/pool",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_ceph_pool_pool",
        "description": "Pool index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/pool/{name}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_ceph_pool",
        "description": "Change POOL settings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "application": {
                    "type": "string",
                    "description": "The application of the pool.",
                    "enum": [
                        "rbd",
                        "cephfs",
                        "rgw"
                    ]
                },
                "crush_rule": {
                    "type": "string",
                    "description": "The rule to use for mapping object placement in the cluster."
                },
                "min_size": {
                    "type": "number",
                    "description": "Minimum number of replicas per object"
                },
                "pg_autoscale_mode": {
                    "type": "string",
                    "description": "The automatic PG scaling mode of the pool.",
                    "enum": [
                        "on",
                        "off",
                        "warn"
                    ]
                },
                "pg_num": {
                    "type": "number",
                    "description": "Number of placement groups."
                },
                "pg_num_min": {
                    "type": "number",
                    "description": "Minimal number of placement groups."
                },
                "size": {
                    "type": "number",
                    "description": "Number of replicas per object"
                },
                "target_size": {
                    "type": "string",
                    "description": "The estimated target size of the pool for the PG autoscaler."
                },
                "target_size_ratio": {
                    "type": "number",
                    "description": "The estimated target ratio of the pool for the PG autoscaler."
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/pool/{name}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_ceph_pool",
        "description": "Destroy pool",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "force": {
                    "type": "boolean",
                    "description": "If true, destroys pool even if in use",
                    "default": 0
                },
                "remove_ecprofile": {
                    "type": "boolean",
                    "description": "Remove the erasure code profile. Defaults to true, if applicable.",
                    "default": 1
                },
                "remove_storages": {
                    "type": "boolean",
                    "description": "Remove all pveceph-managed storages configured for this pool",
                    "default": 0
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/pool/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_ceph_pool_status",
        "description": "Show the current pool status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "verbose": {
                    "type": "boolean",
                    "description": "If enabled, will display additional data(eg. statistics).",
                    "default": 0
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/ceph/pool/{name}/status",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_ceph_init",
        "description": "Create initial ceph default configuration and setup symlinks.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cluster-network": {
                    "type": "string",
                    "description": "Declare a separate cluster network, OSDs will routeheartbeat, object replication and recovery traffic over it"
                },
                "disable_cephx": {
                    "type": "boolean",
                    "description": "Disable cephx authentication.\n\nWARNING: cephx is a security feature protecting against man-in-the-middle attacks. Only consider disabling cephx if your network is private!",
                    "default": 0
                },
                "min_size": {
                    "type": "number",
                    "description": "Minimum number of available replicas per object to allow I/O",
                    "default": 2
                },
                "network": {
                    "type": "string",
                    "description": "Use specific network for all ceph related traffic"
                },
                "pg_bits": {
                    "type": "number",
                    "description": "Placement group bits, used to specify the default number of placement groups.\n\nDepreacted. This setting was deprecated in recent Ceph versions.",
                    "default": 6
                },
                "size": {
                    "type": "number",
                    "description": "Targeted number of replicas per object",
                    "default": 3
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/init",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_ceph_stop",
        "description": "Stop ceph services.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Ceph service name.",
                    "default": "ceph.target"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/stop",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_ceph_start",
        "description": "Start ceph services.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Ceph service name.",
                    "default": "ceph.target"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/start",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_ceph_restart",
        "description": "Restart ceph services.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Ceph service name.",
                    "default": "ceph.target"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/restart",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_ceph_status",
        "description": "Get ceph status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_crush",
        "description": "Get OSD crush map",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/crush",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_log",
        "description": "Read ceph log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "start": {
                    "type": "number",
                    "description": "start"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/log",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_rules",
        "description": "List ceph rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/ceph/rules",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_ceph_cmd-safety",
        "description": "Heuristical check if it is safe to perform an action.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "action": {
                    "type": "string",
                    "description": "Action to check",
                    "enum": [
                        "stop",
                        "destroy"
                    ]
                },
                "id": {
                    "type": "string",
                    "description": "ID of the service"
                },
                "service": {
                    "type": "string",
                    "description": "Service type",
                    "enum": [
                        "osd",
                        "mon",
                        "mds"
                    ]
                }
            },
            "required": [
                "node",
                "action",
                "id",
                "service"
            ]
        },
        "path": "/nodes/{node}/ceph/cmd-safety",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_vzdump",
        "description": "Create backup.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "all": {
                    "type": "boolean",
                    "description": "Backup all known guest systems on this host.",
                    "default": 0
                },
                "bwlimit": {
                    "type": "number",
                    "description": "Limit I/O bandwidth (in KiB/s).",
                    "default": 0
                },
                "compress": {
                    "type": "string",
                    "description": "Compress dump file.",
                    "enum": [
                        "0",
                        "1",
                        "gzip",
                        "lzo",
                        "zstd"
                    ],
                    "default": "0"
                },
                "dumpdir": {
                    "type": "string",
                    "description": "Store resulting files to specified directory."
                },
                "exclude": {
                    "type": "string",
                    "description": "Exclude specified guest systems (assumes --all)"
                },
                "exclude-path": {
                    "type": "array",
                    "description": "Exclude certain files/directories (shell globs). Paths starting with '/' are anchored to the container's root, other paths match relative to each subdirectory."
                },
                "fleecing": {
                    "type": "string",
                    "description": "Options for backup fleecing (VM only)."
                },
                "ionice": {
                    "type": "number",
                    "description": "Set IO priority when using the BFQ scheduler. For snapshot and suspend mode backups of VMs, this only affects the compressor. A value of 8 means the idle priority is used, otherwise the best-effort priority is used with the specified value.",
                    "default": 7
                },
                "job-id": {
                    "type": "string",
                    "description": "The ID of the backup job. If set, the 'backup-job' metadata field of the backup notification will be set to this value. Only root@pam can set this parameter."
                },
                "lockwait": {
                    "type": "number",
                    "description": "Maximal time to wait for the global lock (minutes).",
                    "default": 180
                },
                "mailnotification": {
                    "type": "string",
                    "description": "Deprecated: use notification targets/matchers instead. Specify when to send a notification mail",
                    "enum": [
                        "always",
                        "failure"
                    ],
                    "default": "always"
                },
                "mailto": {
                    "type": "string",
                    "description": "Deprecated: Use notification targets/matchers instead. Comma-separated list of email addresses or users that should receive email notifications."
                },
                "maxfiles": {
                    "type": "number",
                    "description": "Deprecated: use 'prune-backups' instead. Maximal number of backup files per guest system."
                },
                "mode": {
                    "type": "string",
                    "description": "Backup mode.",
                    "enum": [
                        "snapshot",
                        "suspend",
                        "stop"
                    ],
                    "default": "snapshot"
                },
                "notes-template": {
                    "type": "string",
                    "description": "Template string for generating notes for the backup(s). It can contain variables which will be replaced by their values. Currently supported are {{cluster}}, {{guestname}}, {{node}}, and {{vmid}}, but more might be added in the future. Needs to be a single line, newline and backslash need to be esca"
                },
                "notification-mode": {
                    "type": "string",
                    "description": "Determine which notification system to use. If set to 'legacy-sendmail', vzdump will consider the mailto/mailnotification parameters and send emails to the specified address(es) via the 'sendmail' command. If set to 'notification-system', a notification will be sent via PVE's notification system, an",
                    "enum": [
                        "auto",
                        "legacy-sendmail",
                        "notification-system"
                    ],
                    "default": "auto"
                },
                "pbs-change-detection-mode": {
                    "type": "string",
                    "description": "PBS mode used to detect file changes and switch encoding format for container backups.",
                    "enum": [
                        "legacy",
                        "data",
                        "metadata"
                    ]
                },
                "performance": {
                    "type": "string",
                    "description": "Other performance-related settings."
                },
                "pigz": {
                    "type": "number",
                    "description": "Use pigz instead of gzip when N>0. N=1 uses half of cores, N>1 uses N as thread count.",
                    "default": 0
                },
                "pool": {
                    "type": "string",
                    "description": "Backup all known guest systems included in the specified pool."
                },
                "protected": {
                    "type": "boolean",
                    "description": "If true, mark backup(s) as protected."
                },
                "prune-backups": {
                    "type": "string",
                    "description": "Use these retention options instead of those from the storage configuration.",
                    "default": "keep-all=1"
                },
                "quiet": {
                    "type": "boolean",
                    "description": "Be quiet.",
                    "default": 0
                },
                "remove": {
                    "type": "boolean",
                    "description": "Prune older backups according to 'prune-backups'.",
                    "default": 1
                },
                "script": {
                    "type": "string",
                    "description": "Use specified hook script."
                },
                "stdexcludes": {
                    "type": "boolean",
                    "description": "Exclude temporary files and logs.",
                    "default": 1
                },
                "stdout": {
                    "type": "boolean",
                    "description": "Write tar to stdout, not to a file."
                },
                "stop": {
                    "type": "boolean",
                    "description": "Stop running backup jobs on this host.",
                    "default": 0
                },
                "stopwait": {
                    "type": "number",
                    "description": "Maximal time to wait until a guest system is stopped (minutes).",
                    "default": 10
                },
                "storage": {
                    "type": "string",
                    "description": "Store resulting file to this storage."
                },
                "tmpdir": {
                    "type": "string",
                    "description": "Store temporary files to specified directory."
                },
                "vmid": {
                    "type": "string",
                    "description": "The ID of the guest system you want to backup."
                },
                "zstd": {
                    "type": "number",
                    "description": "Zstd threads. N=0 uses half of the available cores, if N is set to a value bigger than 0, N is used as thread count.",
                    "default": 1
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/vzdump",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_vzdump_defaults",
        "description": "Get the currently configured vzdump defaults.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "The storage identifier."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/vzdump/defaults",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_vzdump_extractconfig",
        "description": "Extract configuration from vzdump backup archive.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "volume": {
                    "type": "string",
                    "description": "Volume identifier"
                }
            },
            "required": [
                "node",
                "volume"
            ]
        },
        "path": "/nodes/{node}/vzdump/extractconfig",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_services_services",
        "description": "Service list.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/services",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_services_services",
        "description": "Directory index",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_services_state",
        "description": "Read service properties",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}/state",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_services_start",
        "description": "Start service.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}/start",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_services_stop",
        "description": "Stop service.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}/stop",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_services_restart",
        "description": "Hard restart service. Use reload if you want to reduce interruptions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}/restart",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_services_reload",
        "description": "Reload service. Falls back to restart if service cannot be reloaded.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "service": {
                    "type": "string",
                    "description": "Path parameter: service"
                }
            },
            "required": [
                "node",
                "service"
            ]
        },
        "path": "/nodes/{node}/services/{service}/reload",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_subscription",
        "description": "Read subscription info.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/subscription",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_subscription",
        "description": "Update subscription info.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "force": {
                    "type": "boolean",
                    "description": "Always connect to server, even if local cache is still valid.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/subscription",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_subscription",
        "description": "Set subscription key.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "key": {
                    "type": "string",
                    "description": "Proxmox VE subscription key"
                }
            },
            "required": [
                "node",
                "key"
            ]
        },
        "path": "/nodes/{node}/subscription",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_subscription",
        "description": "Delete subscription key of this node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/subscription",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_network_network",
        "description": "List available networks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "type": {
                    "type": "string",
                    "description": "Only list specific interface types.",
                    "enum": [
                        "bridge",
                        "bond",
                        "eth",
                        "alias",
                        "vlan",
                        "fabric",
                        "OVSBridge",
                        "OVSBond",
                        "OVSPort",
                        "OVSIntPort",
                        "vnet",
                        "any_bridge",
                        "any_local_bridge",
                        "include_sdn"
                    ]
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/network",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_network",
        "description": "Create network device configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "address": {
                    "type": "string",
                    "description": "IP address."
                },
                "address6": {
                    "type": "string",
                    "description": "IP address."
                },
                "autostart": {
                    "type": "boolean",
                    "description": "Automatically start interface on boot."
                },
                "bond-primary": {
                    "type": "string",
                    "description": "Specify the primary interface for active-backup bond."
                },
                "bond_mode": {
                    "type": "string",
                    "description": "Bonding mode.",
                    "enum": [
                        "balance-rr",
                        "active-backup",
                        "balance-xor",
                        "broadcast",
                        "802.3ad",
                        "balance-tlb",
                        "balance-alb",
                        "balance-slb",
                        "lacp-balance-slb",
                        "lacp-balance-tcp"
                    ]
                },
                "bond_xmit_hash_policy": {
                    "type": "string",
                    "description": "Selects the transmit hash policy to use for slave selection in balance-xor and 802.3ad modes.",
                    "enum": [
                        "layer2",
                        "layer2+3",
                        "layer3+4"
                    ]
                },
                "bridge_ports": {
                    "type": "string",
                    "description": "Specify the interfaces you want to add to your bridge."
                },
                "bridge_vids": {
                    "type": "string",
                    "description": "Specify the allowed VLANs. For example: '2 4 100-200'. Only used if the bridge is VLAN aware."
                },
                "bridge_vlan_aware": {
                    "type": "boolean",
                    "description": "Enable bridge vlan support."
                },
                "cidr": {
                    "type": "string",
                    "description": "IPv4 CIDR."
                },
                "cidr6": {
                    "type": "string",
                    "description": "IPv6 CIDR."
                },
                "comments": {
                    "type": "string",
                    "description": "Comments"
                },
                "comments6": {
                    "type": "string",
                    "description": "Comments"
                },
                "gateway": {
                    "type": "string",
                    "description": "Default gateway address."
                },
                "gateway6": {
                    "type": "string",
                    "description": "Default ipv6 gateway address."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name."
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU."
                },
                "netmask": {
                    "type": "string",
                    "description": "Network mask."
                },
                "netmask6": {
                    "type": "number",
                    "description": "Network mask."
                },
                "ovs_bonds": {
                    "type": "string",
                    "description": "Specify the interfaces used by the bonding device."
                },
                "ovs_bridge": {
                    "type": "string",
                    "description": "The OVS bridge associated with a OVS port. This is required when you create an OVS port."
                },
                "ovs_options": {
                    "type": "string",
                    "description": "OVS interface options."
                },
                "ovs_ports": {
                    "type": "string",
                    "description": "Specify the interfaces you want to add to your bridge."
                },
                "ovs_tag": {
                    "type": "number",
                    "description": "Specify a VLan tag (used by OVSPort, OVSIntPort, OVSBond)"
                },
                "slaves": {
                    "type": "string",
                    "description": "Specify the interfaces used by the bonding device."
                },
                "type": {
                    "type": "string",
                    "description": "Network interface type",
                    "enum": [
                        "bridge",
                        "bond",
                        "eth",
                        "alias",
                        "vlan",
                        "fabric",
                        "OVSBridge",
                        "OVSBond",
                        "OVSPort",
                        "OVSIntPort",
                        "vnet",
                        "unknown"
                    ]
                },
                "vlan-id": {
                    "type": "number",
                    "description": "vlan-id for a custom named vlan interface (ifupdown2 only)."
                },
                "vlan-raw-device": {
                    "type": "string",
                    "description": "Specify the raw interface for the vlan interface."
                }
            },
            "required": [
                "node",
                "iface",
                "type"
            ]
        },
        "path": "/nodes/{node}/network",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_network_network",
        "description": "Reload network configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "regenerate-frr": {
                    "type": "boolean",
                    "description": "Whether FRR config generation should get skipped or not.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/network",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_network_network",
        "description": "Revert network configuration changes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/network",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_network_network",
        "description": "Read network device configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "iface": {
                    "type": "string",
                    "description": "Path parameter: iface"
                }
            },
            "required": [
                "node",
                "iface"
            ]
        },
        "path": "/nodes/{node}/network/{iface}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_network_network",
        "description": "Update network device configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "iface": {
                    "type": "string",
                    "description": "Path parameter: iface"
                },
                "address": {
                    "type": "string",
                    "description": "IP address."
                },
                "address6": {
                    "type": "string",
                    "description": "IP address."
                },
                "autostart": {
                    "type": "boolean",
                    "description": "Automatically start interface on boot."
                },
                "bond-primary": {
                    "type": "string",
                    "description": "Specify the primary interface for active-backup bond."
                },
                "bond_mode": {
                    "type": "string",
                    "description": "Bonding mode.",
                    "enum": [
                        "balance-rr",
                        "active-backup",
                        "balance-xor",
                        "broadcast",
                        "802.3ad",
                        "balance-tlb",
                        "balance-alb",
                        "balance-slb",
                        "lacp-balance-slb",
                        "lacp-balance-tcp"
                    ]
                },
                "bond_xmit_hash_policy": {
                    "type": "string",
                    "description": "Selects the transmit hash policy to use for slave selection in balance-xor and 802.3ad modes.",
                    "enum": [
                        "layer2",
                        "layer2+3",
                        "layer3+4"
                    ]
                },
                "bridge_ports": {
                    "type": "string",
                    "description": "Specify the interfaces you want to add to your bridge."
                },
                "bridge_vids": {
                    "type": "string",
                    "description": "Specify the allowed VLANs. For example: '2 4 100-200'. Only used if the bridge is VLAN aware."
                },
                "bridge_vlan_aware": {
                    "type": "boolean",
                    "description": "Enable bridge vlan support."
                },
                "cidr": {
                    "type": "string",
                    "description": "IPv4 CIDR."
                },
                "cidr6": {
                    "type": "string",
                    "description": "IPv6 CIDR."
                },
                "comments": {
                    "type": "string",
                    "description": "Comments"
                },
                "comments6": {
                    "type": "string",
                    "description": "Comments"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "gateway": {
                    "type": "string",
                    "description": "Default gateway address."
                },
                "gateway6": {
                    "type": "string",
                    "description": "Default ipv6 gateway address."
                },
                "mtu": {
                    "type": "number",
                    "description": "MTU."
                },
                "netmask": {
                    "type": "string",
                    "description": "Network mask."
                },
                "netmask6": {
                    "type": "number",
                    "description": "Network mask."
                },
                "ovs_bonds": {
                    "type": "string",
                    "description": "Specify the interfaces used by the bonding device."
                },
                "ovs_bridge": {
                    "type": "string",
                    "description": "The OVS bridge associated with a OVS port. This is required when you create an OVS port."
                },
                "ovs_options": {
                    "type": "string",
                    "description": "OVS interface options."
                },
                "ovs_ports": {
                    "type": "string",
                    "description": "Specify the interfaces you want to add to your bridge."
                },
                "ovs_tag": {
                    "type": "number",
                    "description": "Specify a VLan tag (used by OVSPort, OVSIntPort, OVSBond)"
                },
                "slaves": {
                    "type": "string",
                    "description": "Specify the interfaces used by the bonding device."
                },
                "type": {
                    "type": "string",
                    "description": "Network interface type",
                    "enum": [
                        "bridge",
                        "bond",
                        "eth",
                        "alias",
                        "vlan",
                        "fabric",
                        "OVSBridge",
                        "OVSBond",
                        "OVSPort",
                        "OVSIntPort",
                        "vnet",
                        "unknown"
                    ]
                },
                "vlan-id": {
                    "type": "number",
                    "description": "vlan-id for a custom named vlan interface (ifupdown2 only)."
                },
                "vlan-raw-device": {
                    "type": "string",
                    "description": "Specify the raw interface for the vlan interface."
                }
            },
            "required": [
                "node",
                "iface",
                "type"
            ]
        },
        "path": "/nodes/{node}/network/{iface}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_network_network",
        "description": "Delete network device configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "iface": {
                    "type": "string",
                    "description": "Path parameter: iface"
                }
            },
            "required": [
                "node",
                "iface"
            ]
        },
        "path": "/nodes/{node}/network/{iface}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_tasks_tasks",
        "description": "Read task list for one node (finished tasks).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "errors": {
                    "type": "boolean",
                    "description": "Only list tasks with a status of ERROR.",
                    "default": 0
                },
                "limit": {
                    "type": "number",
                    "description": "Only list this number of tasks.",
                    "default": 50
                },
                "since": {
                    "type": "number",
                    "description": "Only list tasks since this UNIX epoch."
                },
                "source": {
                    "type": "string",
                    "description": "List archived, active or all tasks.",
                    "enum": [
                        "archive",
                        "active",
                        "all"
                    ],
                    "default": "archive"
                },
                "start": {
                    "type": "number",
                    "description": "List tasks beginning from this offset.",
                    "default": 0
                },
                "statusfilter": {
                    "type": "string",
                    "description": "List of Task States that should be returned."
                },
                "typefilter": {
                    "type": "string",
                    "description": "Only list tasks of this type (e.g., vzstart, vzdump)."
                },
                "until": {
                    "type": "number",
                    "description": "Only list tasks until this UNIX epoch."
                },
                "userfilter": {
                    "type": "string",
                    "description": "Only list tasks from this user."
                },
                "vmid": {
                    "type": "number",
                    "description": "Only list tasks for this VM."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/tasks",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_tasks_tasks",
        "description": "",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "upid": {
                    "type": "string",
                    "description": "Path parameter: upid"
                }
            },
            "required": [
                "node",
                "upid"
            ]
        },
        "path": "/nodes/{node}/tasks/{upid}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_tasks",
        "description": "Stop a task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "upid": {
                    "type": "string",
                    "description": "Path parameter: upid"
                }
            },
            "required": [
                "node",
                "upid"
            ]
        },
        "path": "/nodes/{node}/tasks/{upid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_tasks_log",
        "description": "Read task log.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "upid": {
                    "type": "string",
                    "description": "Path parameter: upid"
                },
                "download": {
                    "type": "boolean",
                    "description": "Whether the tasklog file should be downloaded. This parameter can't be used in conjunction with other parameters"
                },
                "limit": {
                    "type": "number",
                    "description": "The number of lines to read from the tasklog.",
                    "default": 50
                },
                "start": {
                    "type": "number",
                    "description": "Start at this line when reading the tasklog",
                    "default": 0
                }
            },
            "required": [
                "node",
                "upid"
            ]
        },
        "path": "/nodes/{node}/tasks/{upid}/log",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_tasks_status",
        "description": "Read task status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "upid": {
                    "type": "string",
                    "description": "Path parameter: upid"
                }
            },
            "required": [
                "node",
                "upid"
            ]
        },
        "path": "/nodes/{node}/tasks/{upid}/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan",
        "description": "Index of available scan methods",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/scan",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_nfs",
        "description": "Scan remote NFS server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "server": {
                    "type": "string",
                    "description": "The server address (name or IP)."
                }
            },
            "required": [
                "node",
                "server"
            ]
        },
        "path": "/nodes/{node}/scan/nfs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_cifs",
        "description": "Scan remote CIFS server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "domain": {
                    "type": "string",
                    "description": "SMB domain (Workgroup)."
                },
                "password": {
                    "type": "string",
                    "description": "User password."
                },
                "server": {
                    "type": "string",
                    "description": "The server address (name or IP)."
                },
                "username": {
                    "type": "string",
                    "description": "User name."
                }
            },
            "required": [
                "node",
                "server"
            ]
        },
        "path": "/nodes/{node}/scan/cifs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_pbs",
        "description": "Scan remote Proxmox Backup Server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "password": {
                    "type": "string",
                    "description": "User password or API token secret."
                },
                "port": {
                    "type": "number",
                    "description": "Optional port.",
                    "default": 8007
                },
                "server": {
                    "type": "string",
                    "description": "The server address (name or IP)."
                },
                "username": {
                    "type": "string",
                    "description": "User-name or API token-ID."
                }
            },
            "required": [
                "node",
                "password",
                "server",
                "username"
            ]
        },
        "path": "/nodes/{node}/scan/pbs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_iscsi",
        "description": "Scan remote iSCSI server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "portal": {
                    "type": "string",
                    "description": "The iSCSI portal (IP or DNS name with optional port)."
                }
            },
            "required": [
                "node",
                "portal"
            ]
        },
        "path": "/nodes/{node}/scan/iscsi",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_lvm",
        "description": "List local LVM volume groups.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/scan/lvm",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_lvmthin",
        "description": "List local LVM Thin Pools.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vg": {
                    "type": "string",
                    "description": "vg"
                }
            },
            "required": [
                "node",
                "vg"
            ]
        },
        "path": "/nodes/{node}/scan/lvmthin",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_scan_zfs",
        "description": "Scan zfs pool list on local node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/scan/zfs",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_hardware",
        "description": "Index of hardware types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/hardware",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_hardware_pci_pci",
        "description": "List local PCI devices.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pci-class-blacklist": {
                    "type": "string",
                    "description": "A list of blacklisted PCI classes, which will not be returned. Following are filtered by default: Memory Controller (05), Bridge (06) and Processor (0b).",
                    "default": "05;06;0b"
                },
                "verbose": {
                    "type": "boolean",
                    "description": "If disabled, does only print the PCI IDs. Otherwise, additional information like vendor and device will be returned.",
                    "default": 1
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/hardware/pci",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_hardware_pci_pci",
        "description": "Index of available pci methods",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pci-id-or-mapping": {
                    "type": "string",
                    "description": "Path parameter: pci-id-or-mapping"
                }
            },
            "required": [
                "node",
                "pci-id-or-mapping"
            ]
        },
        "path": "/nodes/{node}/hardware/pci/{pci-id-or-mapping}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_hardware_pci_mdev",
        "description": "List mediated device types for given PCI device.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pci-id-or-mapping": {
                    "type": "string",
                    "description": "Path parameter: pci-id-or-mapping"
                }
            },
            "required": [
                "node",
                "pci-id-or-mapping"
            ]
        },
        "path": "/nodes/{node}/hardware/pci/{pci-id-or-mapping}/mdev",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_hardware_usb",
        "description": "List local USB devices.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/hardware/usb",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities",
        "description": "Node capabilities index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities_qemu",
        "description": "QEMU capabilities index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities/qemu",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities_qemu_cpu",
        "description": "List all custom and default CPU models.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities/qemu/cpu",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities_qemu_cpu-flags",
        "description": "List of available VM-specific CPU flags.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities/qemu/cpu-flags",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities_qemu_machines",
        "description": "Get available QEMU/KVM machine types.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities/qemu/machines",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_capabilities_qemu_migration",
        "description": "Get node-specific QEMU migration capabilities of the node. Requires the 'Sys.Audit' permission on '/nodes/<node>'.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/capabilities/qemu/migration",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_storage",
        "description": "Get status for all datastores.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "content": {
                    "type": "string",
                    "description": "Only list stores which support this content type."
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Only list stores which are enabled (not disabled in config).",
                    "default": 0
                },
                "format": {
                    "type": "boolean",
                    "description": "Include information about formats",
                    "default": 0
                },
                "storage": {
                    "type": "string",
                    "description": "Only list status for  specified storage"
                },
                "target": {
                    "type": "string",
                    "description": "If target is different to 'node', we only lists shared storages which content is accessible on this 'node' and the specified 'target' node."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/storage",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_storage",
        "description": "",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                }
            },
            "required": [
                "node",
                "storage"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_prunebackups",
        "description": "Get prune information for backups. NOTE: this is only a preview and might not be what a subsequent prune call does if backups are removed/added in the meantime.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "prune-backups": {
                    "type": "string",
                    "description": "Use these retention options instead of those from the storage configuration."
                },
                "type": {
                    "type": "string",
                    "description": "Either 'qemu' or 'lxc'. Only consider backups for guests of this type.",
                    "enum": [
                        "qemu",
                        "lxc"
                    ]
                },
                "vmid": {
                    "type": "number",
                    "description": "Only consider backups for this guest."
                }
            },
            "required": [
                "node",
                "storage"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/prunebackups",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_storage_prunebackups",
        "description": "Prune backups. Only those using the standard naming scheme are considered.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "prune-backups": {
                    "type": "string",
                    "description": "Use these retention options instead of those from the storage configuration."
                },
                "type": {
                    "type": "string",
                    "description": "Either 'qemu' or 'lxc'. Only consider backups for guests of this type.",
                    "enum": [
                        "qemu",
                        "lxc"
                    ]
                },
                "vmid": {
                    "type": "number",
                    "description": "Only prune backups for this VM."
                }
            },
            "required": [
                "node",
                "storage"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/prunebackups",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_storage_content_content",
        "description": "List storage content.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "content": {
                    "type": "string",
                    "description": "Only list content of this type."
                },
                "vmid": {
                    "type": "number",
                    "description": "Only list images for this VM"
                }
            },
            "required": [
                "node",
                "storage"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_storage_content_content",
        "description": "Allocate disk images.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "filename": {
                    "type": "string",
                    "description": "The name of the file to create."
                },
                "format": {
                    "type": "string",
                    "description": "Format of the image.",
                    "enum": [
                        "raw",
                        "qcow2",
                        "subvol",
                        "vmdk"
                    ]
                },
                "size": {
                    "type": "string",
                    "description": "Size in kilobyte (1024 bytes). Optional suffixes 'M' (megabyte, 1024K) and 'G' (gigabyte, 1024M)"
                },
                "vmid": {
                    "type": "number",
                    "description": "Specify owner VM"
                }
            },
            "required": [
                "node",
                "storage",
                "filename",
                "size",
                "vmid"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_storage_content_content",
        "description": "Get volume attributes",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "volume": {
                    "type": "string",
                    "description": "Path parameter: volume"
                }
            },
            "required": [
                "node",
                "storage",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content/{volume}",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_storage_content_content",
        "description": "Copy a volume. This is experimental code - do not use.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "volume": {
                    "type": "string",
                    "description": "Path parameter: volume"
                },
                "target": {
                    "type": "string",
                    "description": "Target volume identifier"
                },
                "target_node": {
                    "type": "string",
                    "description": "Target node. Default is local node."
                }
            },
            "required": [
                "node",
                "storage",
                "volume",
                "target"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content/{volume}",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_storage_content",
        "description": "Update volume attributes",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "volume": {
                    "type": "string",
                    "description": "Path parameter: volume"
                },
                "notes": {
                    "type": "string",
                    "description": "The new notes."
                },
                "protected": {
                    "type": "boolean",
                    "description": "Protection status. Currently only supported for backups."
                }
            },
            "required": [
                "node",
                "storage",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content/{volume}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_storage_content",
        "description": "Delete volume",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "volume": {
                    "type": "string",
                    "description": "Path parameter: volume"
                },
                "delay": {
                    "type": "number",
                    "description": "Time to wait for the task to finish. We return 'null' if the task finish within that time."
                }
            },
            "required": [
                "node",
                "storage",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/content/{volume}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_storage_file-restore_list",
        "description": "List files and directories for single file restore under the given path.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "filepath": {
                    "type": "string",
                    "description": "base64-path to the directory or file being listed, or \"/\"."
                },
                "volume": {
                    "type": "string",
                    "description": "Backup volume ID or name. Currently only PBS snapshots are supported."
                }
            },
            "required": [
                "node",
                "storage",
                "filepath",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/file-restore/list",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_file-restore_download",
        "description": "Extract a file or directory (as zip archive) from a PBS backup.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "filepath": {
                    "type": "string",
                    "description": "base64-path to the directory or file to download."
                },
                "tar": {
                    "type": "boolean",
                    "description": "Download dirs as 'tar.zst' instead of 'zip'.",
                    "default": 0
                },
                "volume": {
                    "type": "string",
                    "description": "Backup volume ID or name. Currently only PBS snapshots are supported."
                }
            },
            "required": [
                "node",
                "storage",
                "filepath",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/file-restore/download",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_status",
        "description": "Read storage status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                }
            },
            "required": [
                "node",
                "storage"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_rrd",
        "description": "Read storage RRD statistics (returns PNG).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "ds": {
                    "type": "string",
                    "description": "The list of datasources you want to display."
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "storage",
                "ds",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/rrd",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_storage_rrddata",
        "description": "Read storage RRD statistics.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year"
                    ]
                }
            },
            "required": [
                "node",
                "storage",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/rrddata",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_storage_upload",
        "description": "Upload templates, ISO images, OVAs and VM images.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "checksum": {
                    "type": "string",
                    "description": "The expected checksum of the file."
                },
                "checksum-algorithm": {
                    "type": "string",
                    "description": "The algorithm to calculate the checksum of the file.",
                    "enum": [
                        "md5",
                        "sha1",
                        "sha224",
                        "sha256",
                        "sha384",
                        "sha512"
                    ]
                },
                "content": {
                    "type": "string",
                    "description": "Content type.",
                    "enum": [
                        "iso",
                        "vztmpl",
                        "import"
                    ]
                },
                "filename": {
                    "type": "string",
                    "description": "The name of the file to create. Caution: This will be normalized!"
                },
                "tmpfilename": {
                    "type": "string",
                    "description": "The source file name. This parameter is usually set by the REST handler. You can only overwrite it when connecting to the trusted port on localhost."
                }
            },
            "required": [
                "node",
                "storage",
                "content",
                "filename"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/upload",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_storage_download-url",
        "description": "Download templates, ISO images, OVAs and VM images by using an URL.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "checksum": {
                    "type": "string",
                    "description": "The expected checksum of the file."
                },
                "checksum-algorithm": {
                    "type": "string",
                    "description": "The algorithm to calculate the checksum of the file.",
                    "enum": [
                        "md5",
                        "sha1",
                        "sha224",
                        "sha256",
                        "sha384",
                        "sha512"
                    ]
                },
                "compression": {
                    "type": "string",
                    "description": "Decompress the downloaded file using the specified compression algorithm."
                },
                "content": {
                    "type": "string",
                    "description": "Content type.",
                    "enum": [
                        "iso",
                        "vztmpl",
                        "import"
                    ]
                },
                "filename": {
                    "type": "string",
                    "description": "The name of the file to create. Caution: This will be normalized!"
                },
                "url": {
                    "type": "string",
                    "description": "The URL to download the file from."
                },
                "verify-certificates": {
                    "type": "boolean",
                    "description": "If false, no SSL/TLS certificates will be verified.",
                    "default": 1
                }
            },
            "required": [
                "node",
                "storage",
                "content",
                "filename",
                "url"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/download-url",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_storage_oci-registry-pull",
        "description": "Pull an OCI image from a registry.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "filename": {
                    "type": "string",
                    "description": "Custom destination file name of the OCI image. Caution: This will be normalized!"
                },
                "reference": {
                    "type": "string",
                    "description": "The reference to the OCI image to download."
                }
            },
            "required": [
                "node",
                "storage",
                "reference"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/oci-registry-pull",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_storage_import-metadata",
        "description": "Get the base parameters for creating a guest which imports data from a foreign importable guest, like an ESXi VM",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "volume": {
                    "type": "string",
                    "description": "Volume identifier for the guest archive/entry."
                }
            },
            "required": [
                "node",
                "storage",
                "volume"
            ]
        },
        "path": "/nodes/{node}/storage/{storage}/import-metadata",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_disks",
        "description": "Node index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_disks_lvm",
        "description": "List LVM Volume Groups",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks/lvm",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_disks_lvm",
        "description": "Create an LVM Volume Group",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "add_storage": {
                    "type": "boolean",
                    "description": "Configure storage using the Volume Group",
                    "default": 0
                },
                "device": {
                    "type": "string",
                    "description": "The block device you want to create the volume group on"
                },
                "name": {
                    "type": "string",
                    "description": "The storage identifier."
                }
            },
            "required": [
                "node",
                "device",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/lvm",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_disks_lvm",
        "description": "Remove an LVM Volume Group.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cleanup-config": {
                    "type": "boolean",
                    "description": "Marks associated storage(s) as not available on this node anymore or removes them from the configuration (if configured for this node only).",
                    "default": 0
                },
                "cleanup-disks": {
                    "type": "boolean",
                    "description": "Also wipe disks so they can be repurposed afterwards.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/lvm/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_disks_lvmthin",
        "description": "List LVM thinpools",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks/lvmthin",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_disks_lvmthin",
        "description": "Create an LVM thinpool",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "add_storage": {
                    "type": "boolean",
                    "description": "Configure storage using the thinpool.",
                    "default": 0
                },
                "device": {
                    "type": "string",
                    "description": "The block device you want to create the thinpool on."
                },
                "name": {
                    "type": "string",
                    "description": "The storage identifier."
                }
            },
            "required": [
                "node",
                "device",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/lvmthin",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_disks_lvmthin",
        "description": "Remove an LVM thin pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cleanup-config": {
                    "type": "boolean",
                    "description": "Marks associated storage(s) as not available on this node anymore or removes them from the configuration (if configured for this node only).",
                    "default": 0
                },
                "cleanup-disks": {
                    "type": "boolean",
                    "description": "Also wipe disks so they can be repurposed afterwards.",
                    "default": 0
                },
                "volume-group": {
                    "type": "string",
                    "description": "The storage identifier."
                }
            },
            "required": [
                "node",
                "name",
                "volume-group"
            ]
        },
        "path": "/nodes/{node}/disks/lvmthin/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_disks_directory",
        "description": "PVE Managed Directory storages.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks/directory",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_disks_directory",
        "description": "Create a Filesystem on an unused disk. Will be mounted under '/mnt/pve/NAME'.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "add_storage": {
                    "type": "boolean",
                    "description": "Configure storage using the directory.",
                    "default": 0
                },
                "device": {
                    "type": "string",
                    "description": "The block device you want to create the filesystem on."
                },
                "filesystem": {
                    "type": "string",
                    "description": "The desired filesystem.",
                    "enum": [
                        "ext4",
                        "xfs"
                    ],
                    "default": "ext4"
                },
                "name": {
                    "type": "string",
                    "description": "The storage identifier."
                }
            },
            "required": [
                "node",
                "device",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/directory",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_disks_directory",
        "description": "Unmounts the storage and removes the mount unit.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cleanup-config": {
                    "type": "boolean",
                    "description": "Marks associated storage(s) as not available on this node anymore or removes them from the configuration (if configured for this node only).",
                    "default": 0
                },
                "cleanup-disks": {
                    "type": "boolean",
                    "description": "Also wipe disk so it can be repurposed afterwards.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/directory/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_disks_zfs_zfs",
        "description": "List Zpools.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks/zfs",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_disks_zfs",
        "description": "Create a ZFS pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "add_storage": {
                    "type": "boolean",
                    "description": "Configure storage using the zpool.",
                    "default": 0
                },
                "ashift": {
                    "type": "number",
                    "description": "Pool sector size exponent.",
                    "default": 12
                },
                "compression": {
                    "type": "string",
                    "description": "The compression algorithm to use.",
                    "enum": [
                        "on",
                        "off",
                        "gzip",
                        "lz4",
                        "lzjb",
                        "zle",
                        "zstd"
                    ],
                    "default": "on"
                },
                "devices": {
                    "type": "string",
                    "description": "The block devices you want to create the zpool on."
                },
                "draid-config": {
                    "type": "string",
                    "description": "draid-config"
                },
                "name": {
                    "type": "string",
                    "description": "The storage identifier."
                },
                "raidlevel": {
                    "type": "string",
                    "description": "The RAID level to use.",
                    "enum": [
                        "single",
                        "mirror",
                        "raid10",
                        "raidz",
                        "raidz2",
                        "raidz3",
                        "draid",
                        "draid2",
                        "draid3"
                    ]
                }
            },
            "required": [
                "node",
                "devices",
                "name",
                "raidlevel"
            ]
        },
        "path": "/nodes/{node}/disks/zfs",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_disks_zfs_zfs",
        "description": "Get details about a zpool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/zfs/{name}",
        "method": "GET"
    },
    {
        "name": "pve_delete_nodes_disks_zfs",
        "description": "Destroy a ZFS pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Path parameter: name"
                },
                "cleanup-config": {
                    "type": "boolean",
                    "description": "Marks associated storage(s) as not available on this node anymore or removes them from the configuration (if configured for this node only).",
                    "default": 0
                },
                "cleanup-disks": {
                    "type": "boolean",
                    "description": "Also wipe disks so they can be repurposed afterwards.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/disks/zfs/{name}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_disks_list",
        "description": "List local disks.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "include-partitions": {
                    "type": "boolean",
                    "description": "Also include partitions.",
                    "default": 0
                },
                "skipsmart": {
                    "type": "boolean",
                    "description": "Skip smart checks.",
                    "default": 0
                },
                "type": {
                    "type": "string",
                    "description": "Only list specific types of disks.",
                    "enum": [
                        "unused",
                        "journal_disks"
                    ]
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/disks/list",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_disks_smart",
        "description": "Get SMART Health of a disk.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "disk": {
                    "type": "string",
                    "description": "Block device name"
                },
                "healthonly": {
                    "type": "boolean",
                    "description": "If true returns only the health status"
                }
            },
            "required": [
                "node",
                "disk"
            ]
        },
        "path": "/nodes/{node}/disks/smart",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_disks_initgpt",
        "description": "Initialize Disk with GPT",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "disk": {
                    "type": "string",
                    "description": "Block device name"
                },
                "uuid": {
                    "type": "string",
                    "description": "UUID for the GPT table"
                }
            },
            "required": [
                "node",
                "disk"
            ]
        },
        "path": "/nodes/{node}/disks/initgpt",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_disks_wipedisk",
        "description": "Wipe a disk or partition.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "disk": {
                    "type": "string",
                    "description": "Block device name"
                }
            },
            "required": [
                "node",
                "disk"
            ]
        },
        "path": "/nodes/{node}/disks/wipedisk",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_apt",
        "description": "Directory index for apt (Advanced Package Tool).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/apt",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_apt_update",
        "description": "List available updates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/apt/update",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_apt_update",
        "description": "This is used to resynchronize the package index files from their sources (apt-get update).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "notify": {
                    "type": "boolean",
                    "description": "Send notification about new packages.",
                    "default": 0
                },
                "quiet": {
                    "type": "boolean",
                    "description": "Only produces output suitable for logging, omitting progress indicators.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/apt/update",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_apt_changelog",
        "description": "Get package changelogs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "name": {
                    "type": "string",
                    "description": "Package name."
                },
                "version": {
                    "type": "string",
                    "description": "Package version."
                }
            },
            "required": [
                "node",
                "name"
            ]
        },
        "path": "/nodes/{node}/apt/changelog",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_apt_repositories",
        "description": "Get APT repository information.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/apt/repositories",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_apt_repositories",
        "description": "Change the properties of a repository. Currently only allows enabling/disabling.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "digest": {
                    "type": "string",
                    "description": "Digest to detect modifications."
                },
                "enabled": {
                    "type": "boolean",
                    "description": "Whether the repository should be enabled or not."
                },
                "index": {
                    "type": "number",
                    "description": "Index within the file (starting from 0)."
                },
                "path": {
                    "type": "string",
                    "description": "Path to the containing file."
                }
            },
            "required": [
                "node",
                "index",
                "path"
            ]
        },
        "path": "/nodes/{node}/apt/repositories",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_apt_repositories",
        "description": "Add a standard repository to the configuration",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "digest": {
                    "type": "string",
                    "description": "Digest to detect modifications."
                },
                "handle": {
                    "type": "string",
                    "description": "Handle that identifies a repository."
                }
            },
            "required": [
                "node",
                "handle"
            ]
        },
        "path": "/nodes/{node}/apt/repositories",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_apt_versions",
        "description": "Get package information for important Proxmox packages.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/apt/versions",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_firewall",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/firewall",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_firewall_rules_rules",
        "description": "List rules.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/firewall/rules",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_firewall_rules",
        "description": "Create new rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "pos": {
                    "type": "number",
                    "description": "Update rule at position <pos>."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "action",
                "type"
            ]
        },
        "path": "/nodes/{node}/firewall/rules",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_firewall_rules_rules",
        "description": "Get single rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                }
            },
            "required": [
                "node",
                "pos"
            ]
        },
        "path": "/nodes/{node}/firewall/rules/{pos}",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_firewall_rules",
        "description": "Modify rule data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "action": {
                    "type": "string",
                    "description": "Rule action ('ACCEPT', 'DROP', 'REJECT') or security group name."
                },
                "comment": {
                    "type": "string",
                    "description": "Descriptive comment."
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "dest": {
                    "type": "string",
                    "description": "Restrict packet destination address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and I"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "dport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP destination port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "enable": {
                    "type": "number",
                    "description": "Flag to enable/disable a rule."
                },
                "icmp-type": {
                    "type": "string",
                    "description": "Specify icmp-type. Only valid if proto equals 'icmp' or 'icmpv6'/'ipv6-icmp'."
                },
                "iface": {
                    "type": "string",
                    "description": "Network interface name. You have to use network configuration key names for VMs and containers ('net\\d+'). Host related rules can use arbitrary strings."
                },
                "log": {
                    "type": "string",
                    "description": "Log level for firewall rule.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "macro": {
                    "type": "string",
                    "description": "Use predefined standard macro."
                },
                "moveto": {
                    "type": "number",
                    "description": "Move rule to new position <moveto>. Other arguments are ignored."
                },
                "proto": {
                    "type": "string",
                    "description": "IP protocol. You can use protocol names ('tcp'/'udp') or simple numbers, as defined in '/etc/protocols'."
                },
                "source": {
                    "type": "string",
                    "description": "Restrict packet source address. This can refer to a single IP address, an IP set ('+ipsetname') or an IP alias definition. You can also specify an address range like '20.34.101.207-201.3.9.99', or a list of IP addresses and networks (entries are separated by comma). Please do not mix IPv4 and IPv6 a"
                },
                "sport": {
                    "type": "string",
                    "description": "Restrict TCP/UDP source port. You can use service names or simple numbers (0-65535), as defined in '/etc/services'. Port ranges can be specified with '\\d+:\\d+', for example '80:85', and you can use comma separated list to match several ports or ranges."
                },
                "type": {
                    "type": "string",
                    "description": "Rule type.",
                    "enum": [
                        "in",
                        "out",
                        "forward",
                        "group"
                    ]
                }
            },
            "required": [
                "node",
                "pos"
            ]
        },
        "path": "/nodes/{node}/firewall/rules/{pos}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_firewall_rules",
        "description": "Delete rule.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "pos": {
                    "type": "string",
                    "description": "Path parameter: pos"
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "pos"
            ]
        },
        "path": "/nodes/{node}/firewall/rules/{pos}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_firewall_options",
        "description": "Get host firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/firewall/options",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_firewall_options",
        "description": "Set Firewall options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable host firewall rules.",
                    "default": 1
                },
                "log_level_forward": {
                    "type": "string",
                    "description": "Log level for forwarded traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "log_level_in": {
                    "type": "string",
                    "description": "Log level for incoming traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "log_level_out": {
                    "type": "string",
                    "description": "Log level for outgoing traffic.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "log_nf_conntrack": {
                    "type": "boolean",
                    "description": "Enable logging of conntrack information.",
                    "default": 0
                },
                "ndp": {
                    "type": "boolean",
                    "description": "Enable NDP (Neighbor Discovery Protocol).",
                    "default": 1
                },
                "nf_conntrack_allow_invalid": {
                    "type": "boolean",
                    "description": "Allow invalid packets on connection tracking.",
                    "default": 0
                },
                "nf_conntrack_helpers": {
                    "type": "string",
                    "description": "Enable conntrack helpers for specific protocols. Supported protocols: amanda, ftp, irc, netbios-ns, pptp, sane, sip, snmp, tftp",
                    "default": ""
                },
                "nf_conntrack_max": {
                    "type": "number",
                    "description": "Maximum number of tracked connections.",
                    "default": 262144
                },
                "nf_conntrack_tcp_timeout_established": {
                    "type": "number",
                    "description": "Conntrack established timeout.",
                    "default": 432000
                },
                "nf_conntrack_tcp_timeout_syn_recv": {
                    "type": "number",
                    "description": "Conntrack syn recv timeout.",
                    "default": 60
                },
                "nftables": {
                    "type": "boolean",
                    "description": "Enable nftables based firewall (tech preview)",
                    "default": 0
                },
                "nosmurfs": {
                    "type": "boolean",
                    "description": "Enable SMURFS filter."
                },
                "protection_synflood": {
                    "type": "boolean",
                    "description": "Enable synflood protection",
                    "default": 0
                },
                "protection_synflood_burst": {
                    "type": "number",
                    "description": "Synflood protection rate burst by ip src.",
                    "default": 1000
                },
                "protection_synflood_rate": {
                    "type": "number",
                    "description": "Synflood protection rate syn/sec by ip src.",
                    "default": 200
                },
                "smurf_log_level": {
                    "type": "string",
                    "description": "Log level for SMURFS filter.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "tcp_flags_log_level": {
                    "type": "string",
                    "description": "Log level for illegal tcp flags filter.",
                    "enum": [
                        "emerg",
                        "alert",
                        "crit",
                        "err",
                        "warning",
                        "notice",
                        "info",
                        "debug",
                        "nolog"
                    ]
                },
                "tcpflags": {
                    "type": "boolean",
                    "description": "Filter illegal combinations of TCP flags.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/firewall/options",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_firewall_log",
        "description": "Read firewall log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "since": {
                    "type": "number",
                    "description": "Display log since this UNIX epoch."
                },
                "start": {
                    "type": "number",
                    "description": "start"
                },
                "until": {
                    "type": "number",
                    "description": "Display log until this UNIX epoch."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/firewall/log",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_replication_replication",
        "description": "List status of all replication jobs on this node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "guest": {
                    "type": "number",
                    "description": "Only list replication jobs for this guest."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/replication",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_replication_replication",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/replication/{id}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_replication_status",
        "description": "Get replication job status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/replication/{id}/status",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_replication_log",
        "description": "Read replication job log.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "start": {
                    "type": "number",
                    "description": "start"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/replication/{id}/log",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_replication_schedule_now",
        "description": "Schedule replication job to start as soon as possible.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "node",
                "id"
            ]
        },
        "path": "/nodes/{node}/replication/{id}/schedule_now",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_certificates",
        "description": "Node index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_certificates_acme",
        "description": "ACME index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/acme",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_certificates_acme_certificate",
        "description": "Order a new certificate from ACME-compatible CA.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "force": {
                    "type": "boolean",
                    "description": "Overwrite existing custom certificate.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/acme/certificate",
        "method": "POST"
    },
    {
        "name": "pve_update_nodes_certificates_acme_certificate",
        "description": "Renew existing certificate from CA.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "force": {
                    "type": "boolean",
                    "description": "Force renewal even if expiry is more than 30 days away.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/acme/certificate",
        "method": "PUT"
    },
    {
        "name": "pve_delete_nodes_certificates_acme_certificate",
        "description": "Revoke existing certificate from CA.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/acme/certificate",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_certificates_info",
        "description": "Get information about node's certificates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/info",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_certificates_custom",
        "description": "Upload or update custom certificate chain and key.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "certificates": {
                    "type": "string",
                    "description": "PEM encoded certificate (chain)."
                },
                "force": {
                    "type": "boolean",
                    "description": "Overwrite existing custom or ACME certificate files.",
                    "default": 0
                },
                "key": {
                    "type": "string",
                    "description": "PEM encoded private key."
                },
                "restart": {
                    "type": "boolean",
                    "description": "Restart pveproxy.",
                    "default": 0
                }
            },
            "required": [
                "node",
                "certificates"
            ]
        },
        "path": "/nodes/{node}/certificates/custom",
        "method": "POST"
    },
    {
        "name": "pve_delete_nodes_certificates_custom",
        "description": "DELETE custom certificate chain and key.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "restart": {
                    "type": "boolean",
                    "description": "Restart pveproxy.",
                    "default": 0
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/certificates/custom",
        "method": "DELETE"
    },
    {
        "name": "pve_get_nodes_config",
        "description": "Get node configuration options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "property": {
                    "type": "string",
                    "description": "Return only a specific property from the node configuration.",
                    "enum": [
                        "acme",
                        "acmedomain0",
                        "acmedomain1",
                        "acmedomain2",
                        "acmedomain3",
                        "acmedomain4",
                        "acmedomain5",
                        "ballooning-target",
                        "description",
                        "startall-onboot-delay",
                        "wakeonlan"
                    ],
                    "default": "all"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/config",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_config",
        "description": "Set node configuration options.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "acme": {
                    "type": "string",
                    "description": "Node specific ACME settings."
                },
                "acmedomain[n]": {
                    "type": "string",
                    "description": "ACME domain and validation plugin"
                },
                "ballooning-target": {
                    "type": "number",
                    "description": "RAM usage target for ballooning (in percent of total memory)",
                    "default": 80
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "description": {
                    "type": "string",
                    "description": "Description for the Node. Shown in the web-interface node notes panel. This is saved as comment inside the configuration file."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has different SHA1 digest. This can be used to prevent concurrent modifications."
                },
                "startall-onboot-delay": {
                    "type": "number",
                    "description": "Initial delay in seconds, before starting all the Virtual Guests with on-boot enabled.",
                    "default": 0
                },
                "wakeonlan": {
                    "type": "string",
                    "description": "Node specific wake on LAN settings."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/config",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_sdn",
        "description": "SDN index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/sdn",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_fabrics",
        "description": "Directory index for SDN fabric status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "fabric": {
                    "type": "string",
                    "description": "Path parameter: fabric"
                }
            },
            "required": [
                "node",
                "fabric"
            ]
        },
        "path": "/nodes/{node}/sdn/fabrics/{fabric}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_fabrics_routes",
        "description": "Get all routes for a fabric.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "fabric": {
                    "type": "string",
                    "description": "Path parameter: fabric"
                }
            },
            "required": [
                "node",
                "fabric"
            ]
        },
        "path": "/nodes/{node}/sdn/fabrics/{fabric}/routes",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_fabrics_neighbors",
        "description": "Get all neighbors for a fabric.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "fabric": {
                    "type": "string",
                    "description": "Path parameter: fabric"
                }
            },
            "required": [
                "node",
                "fabric"
            ]
        },
        "path": "/nodes/{node}/sdn/fabrics/{fabric}/neighbors",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_fabrics_interfaces",
        "description": "Get all interfaces for a fabric.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "fabric": {
                    "type": "string",
                    "description": "Path parameter: fabric"
                }
            },
            "required": [
                "node",
                "fabric"
            ]
        },
        "path": "/nodes/{node}/sdn/fabrics/{fabric}/interfaces",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_zones_zones",
        "description": "Get status for all zones.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/sdn/zones",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_zones_zones",
        "description": "Directory index for SDN zone status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                }
            },
            "required": [
                "node",
                "zone"
            ]
        },
        "path": "/nodes/{node}/sdn/zones/{zone}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_zones_content",
        "description": "List zone content.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                }
            },
            "required": [
                "node",
                "zone"
            ]
        },
        "path": "/nodes/{node}/sdn/zones/{zone}/content",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_zones_bridges",
        "description": "Get a list of all bridges (vnets) that are part of a zone, as well as the ports that are members of that bridge.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                }
            },
            "required": [
                "node",
                "zone"
            ]
        },
        "path": "/nodes/{node}/sdn/zones/{zone}/bridges",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_zones_ip-vrf",
        "description": "Get the IP VRF of an EVPN zone.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "zone": {
                    "type": "string",
                    "description": "Path parameter: zone"
                }
            },
            "required": [
                "node",
                "zone"
            ]
        },
        "path": "/nodes/{node}/sdn/zones/{zone}/ip-vrf",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_vnets",
        "description": "",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                }
            },
            "required": [
                "node",
                "vnet"
            ]
        },
        "path": "/nodes/{node}/sdn/vnets/{vnet}",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_sdn_vnets_mac-vrf",
        "description": "Get the MAC VRF for a VNet in an EVPN zone.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vnet": {
                    "type": "string",
                    "description": "Path parameter: vnet"
                }
            },
            "required": [
                "node",
                "vnet"
            ]
        },
        "path": "/nodes/{node}/sdn/vnets/{vnet}/mac-vrf",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_version",
        "description": "API version details",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/version",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_status",
        "description": "Read node status",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/status",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_status",
        "description": "Reboot or shutdown a node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "command": {
                    "type": "string",
                    "description": "Specify the command.",
                    "enum": [
                        "reboot",
                        "shutdown"
                    ]
                }
            },
            "required": [
                "node",
                "command"
            ]
        },
        "path": "/nodes/{node}/status",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_netstat",
        "description": "Read tap/vm network device interface counters",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/netstat",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_execute",
        "description": "Execute multiple commands in order, root only.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "commands": {
                    "type": "string",
                    "description": "JSON encoded array of commands."
                }
            },
            "required": [
                "node",
                "commands"
            ]
        },
        "path": "/nodes/{node}/execute",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_wakeonlan",
        "description": "Try to wake a node via 'wake on LAN' network packet.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/wakeonlan",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_rrd",
        "description": "Read node RRD statistics (returns PNG)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "ds": {
                    "type": "string",
                    "description": "The list of datasources you want to display."
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year",
                        "decade"
                    ]
                }
            },
            "required": [
                "node",
                "ds",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/rrd",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_rrddata",
        "description": "Read node RRD statistics",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cf": {
                    "type": "string",
                    "description": "The RRD consolidation function",
                    "enum": [
                        "AVERAGE",
                        "MAX"
                    ]
                },
                "timeframe": {
                    "type": "string",
                    "description": "Specify the time frame you are interested in.",
                    "enum": [
                        "hour",
                        "day",
                        "week",
                        "month",
                        "year",
                        "decade"
                    ]
                }
            },
            "required": [
                "node",
                "timeframe"
            ]
        },
        "path": "/nodes/{node}/rrddata",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_syslog",
        "description": "Read system log",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "limit": {
                    "type": "number",
                    "description": "limit"
                },
                "service": {
                    "type": "string",
                    "description": "Service ID"
                },
                "since": {
                    "type": "string",
                    "description": "Display all log since this date-time string."
                },
                "start": {
                    "type": "number",
                    "description": "start"
                },
                "until": {
                    "type": "string",
                    "description": "Display all log until this date-time string."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/syslog",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_journal",
        "description": "Read Journal",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "endcursor": {
                    "type": "string",
                    "description": "End before the given Cursor. Conflicts with 'until'"
                },
                "lastentries": {
                    "type": "number",
                    "description": "Limit to the last X lines. Conflicts with a range."
                },
                "since": {
                    "type": "number",
                    "description": "Display all log since this UNIX epoch. Conflicts with 'startcursor'."
                },
                "startcursor": {
                    "type": "string",
                    "description": "Start after the given Cursor. Conflicts with 'since'"
                },
                "until": {
                    "type": "number",
                    "description": "Display all log until this UNIX epoch. Conflicts with 'endcursor'."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/journal",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_vncshell",
        "description": "Creates a VNC Shell proxy.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cmd": {
                    "type": "string",
                    "description": "Run specific command or default to login (requires 'root@pam')",
                    "enum": [
                        "ceph_install",
                        "login",
                        "upgrade"
                    ],
                    "default": "login"
                },
                "cmd-opts": {
                    "type": "string",
                    "description": "Add parameters to a command. Encoded as null terminated strings.",
                    "default": ""
                },
                "height": {
                    "type": "number",
                    "description": "sets the height of the console in pixels."
                },
                "websocket": {
                    "type": "boolean",
                    "description": "use websocket instead of standard vnc."
                },
                "width": {
                    "type": "number",
                    "description": "sets the width of the console in pixels."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/vncshell",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_termproxy",
        "description": "Creates a VNC Shell proxy.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cmd": {
                    "type": "string",
                    "description": "Run specific command or default to login (requires 'root@pam')",
                    "enum": [
                        "ceph_install",
                        "login",
                        "upgrade"
                    ],
                    "default": "login"
                },
                "cmd-opts": {
                    "type": "string",
                    "description": "Add parameters to a command. Encoded as null terminated strings.",
                    "default": ""
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/termproxy",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_vncwebsocket",
        "description": "Opens a websocket for VNC traffic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "port": {
                    "type": "number",
                    "description": "Port number returned by previous vncproxy call."
                },
                "vncticket": {
                    "type": "string",
                    "description": "Ticket from previous call to vncproxy."
                }
            },
            "required": [
                "node",
                "port",
                "vncticket"
            ]
        },
        "path": "/nodes/{node}/vncwebsocket",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_spiceshell",
        "description": "Creates a SPICE shell.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "cmd": {
                    "type": "string",
                    "description": "Run specific command or default to login (requires 'root@pam')",
                    "enum": [
                        "ceph_install",
                        "login",
                        "upgrade"
                    ],
                    "default": "login"
                },
                "cmd-opts": {
                    "type": "string",
                    "description": "Add parameters to a command. Encoded as null terminated strings.",
                    "default": ""
                },
                "proxy": {
                    "type": "string",
                    "description": "SPICE proxy server. This can be used by the client to specify the proxy server. All nodes in a cluster runs 'spiceproxy', so it is up to the client to choose one. By default, we return the node where the VM is currently running. As reasonable setting is to use same node you use to connect to the API"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/spiceshell",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_dns",
        "description": "Read DNS settings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/dns",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_dns",
        "description": "Write DNS settings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "dns1": {
                    "type": "string",
                    "description": "First name server IP address."
                },
                "dns2": {
                    "type": "string",
                    "description": "Second name server IP address."
                },
                "dns3": {
                    "type": "string",
                    "description": "Third name server IP address."
                },
                "search": {
                    "type": "string",
                    "description": "Search domain for host-name lookup."
                }
            },
            "required": [
                "node",
                "search"
            ]
        },
        "path": "/nodes/{node}/dns",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_time",
        "description": "Read server time and time zone settings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/time",
        "method": "GET"
    },
    {
        "name": "pve_update_nodes_time",
        "description": "Set time zone.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "timezone": {
                    "type": "string",
                    "description": "Time zone. The file '/usr/share/zoneinfo/zone.tab' contains the list of valid names."
                }
            },
            "required": [
                "node",
                "timezone"
            ]
        },
        "path": "/nodes/{node}/time",
        "method": "PUT"
    },
    {
        "name": "pve_get_nodes_aplinfo",
        "description": "Get list of appliances.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/aplinfo",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_aplinfo",
        "description": "Download appliance templates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "storage": {
                    "type": "string",
                    "description": "The storage where the template will be stored"
                },
                "template": {
                    "type": "string",
                    "description": "The template which will downloaded"
                }
            },
            "required": [
                "node",
                "storage",
                "template"
            ]
        },
        "path": "/nodes/{node}/aplinfo",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_query-oci-repo-tags",
        "description": "List all tags for an OCI repository reference.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "reference": {
                    "type": "string",
                    "description": "The reference to the repository to query tags from."
                }
            },
            "required": [
                "node",
                "reference"
            ]
        },
        "path": "/nodes/{node}/query-oci-repo-tags",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_query-url-metadata",
        "description": "Query metadata of an URL: file size, file name and mime type.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "url": {
                    "type": "string",
                    "description": "The URL to query the metadata from."
                },
                "verify-certificates": {
                    "type": "boolean",
                    "description": "If false, no SSL/TLS certificates will be verified.",
                    "default": 1
                }
            },
            "required": [
                "node",
                "url"
            ]
        },
        "path": "/nodes/{node}/query-url-metadata",
        "method": "GET"
    },
    {
        "name": "pve_get_nodes_report",
        "description": "Gather various systems information about a node",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/report",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_startall",
        "description": "Start all VMs and containers located on this node (by default only those with onboot=1).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "force": {
                    "type": "boolean",
                    "description": "Issue start command even if virtual guest have 'onboot' not set or set to off.",
                    "default": "off"
                },
                "vms": {
                    "type": "string",
                    "description": "Only consider guests from this comma separated list of VMIDs."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/startall",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_stopall",
        "description": "Stop all VMs and Containers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "force-stop": {
                    "type": "boolean",
                    "description": "Force a hard-stop after the timeout.",
                    "default": 1
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout for each guest shutdown task. Depending on `force-stop`, the shutdown gets then simply aborted or a hard-stop is forced.",
                    "default": 180
                },
                "vms": {
                    "type": "string",
                    "description": "Only consider Guests with these IDs."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/stopall",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_suspendall",
        "description": "Suspend all VMs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "vms": {
                    "type": "string",
                    "description": "Only consider Guests with these IDs."
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/suspendall",
        "method": "POST"
    },
    {
        "name": "pve_create_nodes_migrateall",
        "description": "Migrate all VMs and Containers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "maxworkers": {
                    "type": "number",
                    "description": "Maximal number of parallel migration job. If not set, uses'max_workers' from datacenter.cfg. One of both must be set!"
                },
                "target": {
                    "type": "string",
                    "description": "Target node."
                },
                "vms": {
                    "type": "string",
                    "description": "Only consider Guests with these IDs."
                },
                "with-local-disks": {
                    "type": "boolean",
                    "description": "Enable live storage migration for local disk"
                }
            },
            "required": [
                "node",
                "target"
            ]
        },
        "path": "/nodes/{node}/migrateall",
        "method": "POST"
    },
    {
        "name": "pve_get_nodes_hosts",
        "description": "Get the content of /etc/hosts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                }
            },
            "required": [
                "node"
            ]
        },
        "path": "/nodes/{node}/hosts",
        "method": "GET"
    },
    {
        "name": "pve_create_nodes_hosts",
        "description": "Write /etc/hosts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {
                    "type": "string",
                    "description": "Path parameter: node"
                },
                "data": {
                    "type": "string",
                    "description": "The target content of /etc/hosts."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                }
            },
            "required": [
                "node",
                "data"
            ]
        },
        "path": "/nodes/{node}/hosts",
        "method": "POST"
    },
    {
        "name": "pve_list_storage",
        "description": "Storage index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "Only list storage of specific type",
                    "enum": [
                        "btrfs",
                        "cephfs",
                        "cifs",
                        "dir",
                        "esxi",
                        "iscsi",
                        "iscsidirect",
                        "lvm",
                        "lvmthin",
                        "nfs",
                        "pbs",
                        "rbd",
                        "zfs",
                        "zfspool"
                    ]
                }
            },
            "required": []
        },
        "path": "/storage",
        "method": "GET"
    },
    {
        "name": "pve_create_storage",
        "description": "Create a new storage.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "authsupported": {
                    "type": "string",
                    "description": "Authsupported."
                },
                "base": {
                    "type": "string",
                    "description": "Base volume. This volume is automatically activated."
                },
                "blocksize": {
                    "type": "string",
                    "description": "block size"
                },
                "bwlimit": {
                    "type": "string",
                    "description": "Set I/O bandwidth limit for various operations (in KiB/s)."
                },
                "comstar_hg": {
                    "type": "string",
                    "description": "host group for comstar views"
                },
                "comstar_tg": {
                    "type": "string",
                    "description": "target group for comstar views"
                },
                "content": {
                    "type": "string",
                    "description": "Allowed content types.\n\nNOTE: the value 'rootdir' is used for Containers, and value 'images' for VMs.\n"
                },
                "content-dirs": {
                    "type": "string",
                    "description": "Overrides for default content type directories."
                },
                "create-base-path": {
                    "type": "boolean",
                    "description": "Create the base directory if it doesn't exist.",
                    "default": "yes"
                },
                "create-subdirs": {
                    "type": "boolean",
                    "description": "Populate the directory with the default structure.",
                    "default": "yes"
                },
                "data-pool": {
                    "type": "string",
                    "description": "Data Pool (for erasure coding only)"
                },
                "datastore": {
                    "type": "string",
                    "description": "Proxmox Backup Server datastore name."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the storage."
                },
                "domain": {
                    "type": "string",
                    "description": "CIFS domain."
                },
                "encryption-key": {
                    "type": "string",
                    "description": "Encryption key. Use 'autogen' to generate one automatically without passphrase."
                },
                "export": {
                    "type": "string",
                    "description": "NFS export path."
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "format": {
                    "type": "string",
                    "description": "Default image format.",
                    "enum": [
                        "raw",
                        "qcow2",
                        "subvol",
                        "vmdk"
                    ]
                },
                "fs-name": {
                    "type": "string",
                    "description": "The Ceph filesystem name."
                },
                "fuse": {
                    "type": "boolean",
                    "description": "Mount CephFS through FUSE."
                },
                "is_mountpoint": {
                    "type": "string",
                    "description": "Assume the given path is an externally managed mountpoint and consider the storage offline if it is not mounted. Using a boolean (yes/no) value serves as a shortcut to using the target path in this field.",
                    "default": "no"
                },
                "iscsiprovider": {
                    "type": "string",
                    "description": "iscsi provider"
                },
                "keyring": {
                    "type": "string",
                    "description": "Client keyring contents (for external clusters)."
                },
                "krbd": {
                    "type": "boolean",
                    "description": "Always access rbd through krbd kernel module.",
                    "default": 0
                },
                "lio_tpg": {
                    "type": "string",
                    "description": "target portal group for Linux LIO targets"
                },
                "master-pubkey": {
                    "type": "string",
                    "description": "Base64-encoded, PEM-formatted public RSA key. Used to encrypt a copy of the encryption-key which will be added to each encrypted backup."
                },
                "max-protected-backups": {
                    "type": "number",
                    "description": "Maximal number of protected backups per guest. Use '-1' for unlimited.",
                    "default": "Unlimited for users with Datastore.Allocate privilege, 5 for other users"
                },
                "mkdir": {
                    "type": "boolean",
                    "description": "Create the directory if it doesn't exist and populate it with default sub-dirs. NOTE: Deprecated, use the 'create-base-path' and 'create-subdirs' options instead.",
                    "default": "yes"
                },
                "monhost": {
                    "type": "string",
                    "description": "IP addresses of monitors (for external clusters)."
                },
                "mountpoint": {
                    "type": "string",
                    "description": "mount point"
                },
                "namespace": {
                    "type": "string",
                    "description": "Namespace."
                },
                "nocow": {
                    "type": "boolean",
                    "description": "Set the NOCOW flag on files. Disables data checksumming and causes data errors to be unrecoverable from while allowing direct I/O. Only use this if data does not need to be any more safe than on a single ext4 formatted disk with no underlying raid system.",
                    "default": 0
                },
                "nodes": {
                    "type": "string",
                    "description": "List of nodes for which the storage configuration applies."
                },
                "nowritecache": {
                    "type": "boolean",
                    "description": "disable write caching on the target"
                },
                "options": {
                    "type": "string",
                    "description": "NFS/CIFS mount options (see 'man nfs' or 'man mount.cifs')"
                },
                "password": {
                    "type": "string",
                    "description": "Password for accessing the share/datastore."
                },
                "path": {
                    "type": "string",
                    "description": "File system path."
                },
                "pool": {
                    "type": "string",
                    "description": "Pool."
                },
                "port": {
                    "type": "number",
                    "description": "Use this port to connect to the storage instead of the default one (for example, with PBS or ESXi). For NFS and CIFS, use the 'options' option to configure the port via the mount options."
                },
                "portal": {
                    "type": "string",
                    "description": "iSCSI portal (IP or DNS name with optional port)."
                },
                "preallocation": {
                    "type": "string",
                    "description": "Preallocation mode for raw and qcow2 images. Using 'metadata' on raw images results in preallocation=off.",
                    "enum": [
                        "off",
                        "metadata",
                        "falloc",
                        "full"
                    ],
                    "default": "metadata"
                },
                "prune-backups": {
                    "type": "string",
                    "description": "The retention options with shorter intervals are processed first with --keep-last being the very first one. Each option covers a specific period of time. We say that backups within this period are covered by this option. The next option does not take care of already covered backups and only consider"
                },
                "saferemove": {
                    "type": "boolean",
                    "description": "Zero-out data when removing LVs."
                },
                "saferemove-stepsize": {
                    "type": "number",
                    "description": "Wipe step size in MiB. It will be capped to the maximum supported by the storage.",
                    "enum": [
                        "1",
                        "2",
                        "4",
                        "8",
                        "16",
                        "32"
                    ],
                    "default": 32
                },
                "saferemove_throughput": {
                    "type": "string",
                    "description": "Wipe throughput (cstream -t parameter value)."
                },
                "server": {
                    "type": "string",
                    "description": "Server IP or DNS name."
                },
                "share": {
                    "type": "string",
                    "description": "CIFS share."
                },
                "shared": {
                    "type": "boolean",
                    "description": "Indicate that this is a single storage with the same contents on all nodes (or all listed in the 'nodes' option). It will not make the contents of a local storage automatically accessible to other nodes, it just marks an already shared storage as such!"
                },
                "skip-cert-verification": {
                    "type": "boolean",
                    "description": "Disable TLS certificate verification, only enable on fully trusted networks!",
                    "default": "false"
                },
                "smbversion": {
                    "type": "string",
                    "description": "SMB protocol version. 'default' if not set, negotiates the highest SMB2+ version supported by both the client and server.",
                    "enum": [
                        "default",
                        "2.0",
                        "2.1",
                        "3",
                        "3.0",
                        "3.11"
                    ],
                    "default": "default"
                },
                "snapshot-as-volume-chain": {
                    "type": "boolean",
                    "description": "Enable support for creating storage-vendor agnostic snapshot through volume backing-chains.",
                    "default": 0
                },
                "sparse": {
                    "type": "boolean",
                    "description": "use sparse volumes"
                },
                "storage": {
                    "type": "string",
                    "description": "The storage identifier."
                },
                "subdir": {
                    "type": "string",
                    "description": "Subdir to mount."
                },
                "tagged_only": {
                    "type": "boolean",
                    "description": "Only use logical volumes tagged with 'pve-vm-ID'."
                },
                "target": {
                    "type": "string",
                    "description": "iSCSI target."
                },
                "thinpool": {
                    "type": "string",
                    "description": "LVM thin pool LV name."
                },
                "type": {
                    "type": "string",
                    "description": "Storage type.",
                    "enum": [
                        "btrfs",
                        "cephfs",
                        "cifs",
                        "dir",
                        "esxi",
                        "iscsi",
                        "iscsidirect",
                        "lvm",
                        "lvmthin",
                        "nfs",
                        "pbs",
                        "rbd",
                        "zfs",
                        "zfspool"
                    ]
                },
                "username": {
                    "type": "string",
                    "description": "RBD Id."
                },
                "vgname": {
                    "type": "string",
                    "description": "Volume group name."
                },
                "zfs-base-path": {
                    "type": "string",
                    "description": "Base path where to look for the created ZFS block devices. Set automatically during creation if not specified. Usually '/dev/zvol'."
                }
            },
            "required": [
                "storage",
                "type"
            ]
        },
        "path": "/storage",
        "method": "POST"
    },
    {
        "name": "pve_get_storage",
        "description": "Read storage configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                }
            },
            "required": [
                "storage"
            ]
        },
        "path": "/storage/{storage}",
        "method": "GET"
    },
    {
        "name": "pve_update_storage",
        "description": "Update storage configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                },
                "blocksize": {
                    "type": "string",
                    "description": "block size"
                },
                "bwlimit": {
                    "type": "string",
                    "description": "Set I/O bandwidth limit for various operations (in KiB/s)."
                },
                "comstar_hg": {
                    "type": "string",
                    "description": "host group for comstar views"
                },
                "comstar_tg": {
                    "type": "string",
                    "description": "target group for comstar views"
                },
                "content": {
                    "type": "string",
                    "description": "Allowed content types.\n\nNOTE: the value 'rootdir' is used for Containers, and value 'images' for VMs.\n"
                },
                "content-dirs": {
                    "type": "string",
                    "description": "Overrides for default content type directories."
                },
                "create-base-path": {
                    "type": "boolean",
                    "description": "Create the base directory if it doesn't exist.",
                    "default": "yes"
                },
                "create-subdirs": {
                    "type": "boolean",
                    "description": "Populate the directory with the default structure.",
                    "default": "yes"
                },
                "data-pool": {
                    "type": "string",
                    "description": "Data Pool (for erasure coding only)"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "disable": {
                    "type": "boolean",
                    "description": "Flag to disable the storage."
                },
                "domain": {
                    "type": "string",
                    "description": "CIFS domain."
                },
                "encryption-key": {
                    "type": "string",
                    "description": "Encryption key. Use 'autogen' to generate one automatically without passphrase."
                },
                "fingerprint": {
                    "type": "string",
                    "description": "Certificate SHA 256 fingerprint."
                },
                "format": {
                    "type": "string",
                    "description": "Default image format.",
                    "enum": [
                        "raw",
                        "qcow2",
                        "subvol",
                        "vmdk"
                    ]
                },
                "fs-name": {
                    "type": "string",
                    "description": "The Ceph filesystem name."
                },
                "fuse": {
                    "type": "boolean",
                    "description": "Mount CephFS through FUSE."
                },
                "is_mountpoint": {
                    "type": "string",
                    "description": "Assume the given path is an externally managed mountpoint and consider the storage offline if it is not mounted. Using a boolean (yes/no) value serves as a shortcut to using the target path in this field.",
                    "default": "no"
                },
                "keyring": {
                    "type": "string",
                    "description": "Client keyring contents (for external clusters)."
                },
                "krbd": {
                    "type": "boolean",
                    "description": "Always access rbd through krbd kernel module.",
                    "default": 0
                },
                "lio_tpg": {
                    "type": "string",
                    "description": "target portal group for Linux LIO targets"
                },
                "master-pubkey": {
                    "type": "string",
                    "description": "Base64-encoded, PEM-formatted public RSA key. Used to encrypt a copy of the encryption-key which will be added to each encrypted backup."
                },
                "max-protected-backups": {
                    "type": "number",
                    "description": "Maximal number of protected backups per guest. Use '-1' for unlimited.",
                    "default": "Unlimited for users with Datastore.Allocate privilege, 5 for other users"
                },
                "mkdir": {
                    "type": "boolean",
                    "description": "Create the directory if it doesn't exist and populate it with default sub-dirs. NOTE: Deprecated, use the 'create-base-path' and 'create-subdirs' options instead.",
                    "default": "yes"
                },
                "monhost": {
                    "type": "string",
                    "description": "IP addresses of monitors (for external clusters)."
                },
                "mountpoint": {
                    "type": "string",
                    "description": "mount point"
                },
                "namespace": {
                    "type": "string",
                    "description": "Namespace."
                },
                "nocow": {
                    "type": "boolean",
                    "description": "Set the NOCOW flag on files. Disables data checksumming and causes data errors to be unrecoverable from while allowing direct I/O. Only use this if data does not need to be any more safe than on a single ext4 formatted disk with no underlying raid system.",
                    "default": 0
                },
                "nodes": {
                    "type": "string",
                    "description": "List of nodes for which the storage configuration applies."
                },
                "nowritecache": {
                    "type": "boolean",
                    "description": "disable write caching on the target"
                },
                "options": {
                    "type": "string",
                    "description": "NFS/CIFS mount options (see 'man nfs' or 'man mount.cifs')"
                },
                "password": {
                    "type": "string",
                    "description": "Password for accessing the share/datastore."
                },
                "pool": {
                    "type": "string",
                    "description": "Pool."
                },
                "port": {
                    "type": "number",
                    "description": "Use this port to connect to the storage instead of the default one (for example, with PBS or ESXi). For NFS and CIFS, use the 'options' option to configure the port via the mount options."
                },
                "preallocation": {
                    "type": "string",
                    "description": "Preallocation mode for raw and qcow2 images. Using 'metadata' on raw images results in preallocation=off.",
                    "enum": [
                        "off",
                        "metadata",
                        "falloc",
                        "full"
                    ],
                    "default": "metadata"
                },
                "prune-backups": {
                    "type": "string",
                    "description": "The retention options with shorter intervals are processed first with --keep-last being the very first one. Each option covers a specific period of time. We say that backups within this period are covered by this option. The next option does not take care of already covered backups and only consider"
                },
                "saferemove": {
                    "type": "boolean",
                    "description": "Zero-out data when removing LVs."
                },
                "saferemove-stepsize": {
                    "type": "number",
                    "description": "Wipe step size in MiB. It will be capped to the maximum supported by the storage.",
                    "enum": [
                        "1",
                        "2",
                        "4",
                        "8",
                        "16",
                        "32"
                    ],
                    "default": 32
                },
                "saferemove_throughput": {
                    "type": "string",
                    "description": "Wipe throughput (cstream -t parameter value)."
                },
                "server": {
                    "type": "string",
                    "description": "Server IP or DNS name."
                },
                "shared": {
                    "type": "boolean",
                    "description": "Indicate that this is a single storage with the same contents on all nodes (or all listed in the 'nodes' option). It will not make the contents of a local storage automatically accessible to other nodes, it just marks an already shared storage as such!"
                },
                "skip-cert-verification": {
                    "type": "boolean",
                    "description": "Disable TLS certificate verification, only enable on fully trusted networks!",
                    "default": "false"
                },
                "smbversion": {
                    "type": "string",
                    "description": "SMB protocol version. 'default' if not set, negotiates the highest SMB2+ version supported by both the client and server.",
                    "enum": [
                        "default",
                        "2.0",
                        "2.1",
                        "3",
                        "3.0",
                        "3.11"
                    ],
                    "default": "default"
                },
                "snapshot-as-volume-chain": {
                    "type": "boolean",
                    "description": "Enable support for creating storage-vendor agnostic snapshot through volume backing-chains.",
                    "default": 0
                },
                "sparse": {
                    "type": "boolean",
                    "description": "use sparse volumes"
                },
                "subdir": {
                    "type": "string",
                    "description": "Subdir to mount."
                },
                "tagged_only": {
                    "type": "boolean",
                    "description": "Only use logical volumes tagged with 'pve-vm-ID'."
                },
                "username": {
                    "type": "string",
                    "description": "RBD Id."
                },
                "zfs-base-path": {
                    "type": "string",
                    "description": "Base path where to look for the created ZFS block devices. Set automatically during creation if not specified. Usually '/dev/zvol'."
                }
            },
            "required": [
                "storage"
            ]
        },
        "path": "/storage/{storage}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_storage",
        "description": "Delete storage configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "storage": {
                    "type": "string",
                    "description": "Path parameter: storage"
                }
            },
            "required": [
                "storage"
            ]
        },
        "path": "/storage/{storage}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_access",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access",
        "method": "GET"
    },
    {
        "name": "pve_list_access_users",
        "description": "User index.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "enabled": {
                    "type": "boolean",
                    "description": "Optional filter for enable property."
                },
                "full": {
                    "type": "boolean",
                    "description": "Include group and token information.",
                    "default": 0
                }
            },
            "required": []
        },
        "path": "/access/users",
        "method": "GET"
    },
    {
        "name": "pve_create_access_users",
        "description": "Create new user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "email": {
                    "type": "string",
                    "description": "email"
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable the account (default). You can set this to '0' to disable the account",
                    "default": 1
                },
                "expire": {
                    "type": "number",
                    "description": "Account expiration date (seconds since epoch). '0' means no expiration date."
                },
                "firstname": {
                    "type": "string",
                    "description": "firstname"
                },
                "groups": {
                    "type": "string",
                    "description": "groups"
                },
                "keys": {
                    "type": "string",
                    "description": "Keys for two factor auth (yubico)."
                },
                "lastname": {
                    "type": "string",
                    "description": "lastname"
                },
                "password": {
                    "type": "string",
                    "description": "Initial password."
                },
                "userid": {
                    "type": "string",
                    "description": "Full User ID, in the `name@realm` format."
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users",
        "method": "POST"
    },
    {
        "name": "pve_get_access_users",
        "description": "Get user configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}",
        "method": "GET"
    },
    {
        "name": "pve_update_access_users",
        "description": "Update user configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "append": {
                    "type": "boolean",
                    "description": "append"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "email": {
                    "type": "string",
                    "description": "email"
                },
                "enable": {
                    "type": "boolean",
                    "description": "Enable the account (default). You can set this to '0' to disable the account",
                    "default": 1
                },
                "expire": {
                    "type": "number",
                    "description": "Account expiration date (seconds since epoch). '0' means no expiration date."
                },
                "firstname": {
                    "type": "string",
                    "description": "firstname"
                },
                "groups": {
                    "type": "string",
                    "description": "groups"
                },
                "keys": {
                    "type": "string",
                    "description": "Keys for two factor auth (yubico)."
                },
                "lastname": {
                    "type": "string",
                    "description": "lastname"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_users",
        "description": "Delete user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}",
        "method": "DELETE"
    },
    {
        "name": "pve_get_access_users_tfa",
        "description": "Get user TFA types (Personal and Realm).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "multiple": {
                    "type": "boolean",
                    "description": "Request all entries as an array.",
                    "default": 0
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}/tfa",
        "method": "GET"
    },
    {
        "name": "pve_update_access_users_unlock-tfa",
        "description": "Unlock a user's TFA authentication.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}/unlock-tfa",
        "method": "PUT"
    },
    {
        "name": "pve_get_access_users_token_token",
        "description": "Get user API tokens.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/users/{userid}/token",
        "method": "GET"
    },
    {
        "name": "pve_get_access_users_token_token",
        "description": "Get specific API token information.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "tokenid": {
                    "type": "string",
                    "description": "Path parameter: tokenid"
                }
            },
            "required": [
                "userid",
                "tokenid"
            ]
        },
        "path": "/access/users/{userid}/token/{tokenid}",
        "method": "GET"
    },
    {
        "name": "pve_create_access_users_token",
        "description": "Generate a new API token for a specific user. NOTE: returns API token value, which needs to be stored as it cannot be retrieved afterwards!",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "tokenid": {
                    "type": "string",
                    "description": "Path parameter: tokenid"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "expire": {
                    "type": "number",
                    "description": "API token expiration date (seconds since epoch). '0' means no expiration date.",
                    "default": "same as user"
                },
                "privsep": {
                    "type": "boolean",
                    "description": "Restrict API token privileges with separate ACLs (default), or give full privileges of corresponding user.",
                    "default": 1
                }
            },
            "required": [
                "userid",
                "tokenid"
            ]
        },
        "path": "/access/users/{userid}/token/{tokenid}",
        "method": "POST"
    },
    {
        "name": "pve_update_access_users_token",
        "description": "Update API token for a specific user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "tokenid": {
                    "type": "string",
                    "description": "Path parameter: tokenid"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "expire": {
                    "type": "number",
                    "description": "API token expiration date (seconds since epoch). '0' means no expiration date.",
                    "default": "same as user"
                },
                "privsep": {
                    "type": "boolean",
                    "description": "Restrict API token privileges with separate ACLs (default), or give full privileges of corresponding user.",
                    "default": 1
                }
            },
            "required": [
                "userid",
                "tokenid"
            ]
        },
        "path": "/access/users/{userid}/token/{tokenid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_users_token",
        "description": "Remove API token for a specific user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "tokenid": {
                    "type": "string",
                    "description": "Path parameter: tokenid"
                }
            },
            "required": [
                "userid",
                "tokenid"
            ]
        },
        "path": "/access/users/{userid}/token/{tokenid}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_access_groups",
        "description": "Group index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/groups",
        "method": "GET"
    },
    {
        "name": "pve_create_access_groups",
        "description": "Create new group.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "groupid": {
                    "type": "string",
                    "description": "groupid"
                }
            },
            "required": [
                "groupid"
            ]
        },
        "path": "/access/groups",
        "method": "POST"
    },
    {
        "name": "pve_get_access_groups",
        "description": "Get group configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "groupid": {
                    "type": "string",
                    "description": "Path parameter: groupid"
                }
            },
            "required": [
                "groupid"
            ]
        },
        "path": "/access/groups/{groupid}",
        "method": "GET"
    },
    {
        "name": "pve_update_access_groups",
        "description": "Update group data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "groupid": {
                    "type": "string",
                    "description": "Path parameter: groupid"
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                }
            },
            "required": [
                "groupid"
            ]
        },
        "path": "/access/groups/{groupid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_groups",
        "description": "Delete group.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "groupid": {
                    "type": "string",
                    "description": "Path parameter: groupid"
                }
            },
            "required": [
                "groupid"
            ]
        },
        "path": "/access/groups/{groupid}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_access_roles",
        "description": "Role index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/roles",
        "method": "GET"
    },
    {
        "name": "pve_create_access_roles",
        "description": "Create new role.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "privs": {
                    "type": "string",
                    "description": "privs"
                },
                "roleid": {
                    "type": "string",
                    "description": "roleid"
                }
            },
            "required": [
                "roleid"
            ]
        },
        "path": "/access/roles",
        "method": "POST"
    },
    {
        "name": "pve_get_access_roles",
        "description": "Get role configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "roleid": {
                    "type": "string",
                    "description": "Path parameter: roleid"
                }
            },
            "required": [
                "roleid"
            ]
        },
        "path": "/access/roles/{roleid}",
        "method": "GET"
    },
    {
        "name": "pve_update_access_roles",
        "description": "Update an existing role.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "roleid": {
                    "type": "string",
                    "description": "Path parameter: roleid"
                },
                "append": {
                    "type": "boolean",
                    "description": "append"
                },
                "privs": {
                    "type": "string",
                    "description": "privs"
                }
            },
            "required": [
                "roleid"
            ]
        },
        "path": "/access/roles/{roleid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_roles",
        "description": "Delete role.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "roleid": {
                    "type": "string",
                    "description": "Path parameter: roleid"
                }
            },
            "required": [
                "roleid"
            ]
        },
        "path": "/access/roles/{roleid}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_access_acl",
        "description": "Get Access Control List (ACLs).",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/acl",
        "method": "GET"
    },
    {
        "name": "pve_update_access_acl",
        "description": "Update Access Control List (add or remove permissions).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "delete": {
                    "type": "boolean",
                    "description": "Remove permissions (instead of adding it)."
                },
                "groups": {
                    "type": "string",
                    "description": "List of groups."
                },
                "path": {
                    "type": "string",
                    "description": "Access control path"
                },
                "propagate": {
                    "type": "boolean",
                    "description": "Allow to propagate (inherit) permissions.",
                    "default": 1
                },
                "roles": {
                    "type": "string",
                    "description": "List of roles."
                },
                "tokens": {
                    "type": "string",
                    "description": "List of API tokens."
                },
                "users": {
                    "type": "string",
                    "description": "List of users."
                }
            },
            "required": [
                "path",
                "roles"
            ]
        },
        "path": "/access/acl",
        "method": "PUT"
    },
    {
        "name": "pve_list_access_domains",
        "description": "Authentication domain index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/domains",
        "method": "GET"
    },
    {
        "name": "pve_create_access_domains",
        "description": "Add an authentication server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "acr-values": {
                    "type": "string",
                    "description": "Specifies the Authentication Context Class Reference values that theAuthorization Server is being requested to use for the Auth Request."
                },
                "autocreate": {
                    "type": "boolean",
                    "description": "Automatically create users if they do not exist.",
                    "default": 0
                },
                "base_dn": {
                    "type": "string",
                    "description": "LDAP base domain name"
                },
                "bind_dn": {
                    "type": "string",
                    "description": "LDAP bind domain name"
                },
                "capath": {
                    "type": "string",
                    "description": "Path to the CA certificate store",
                    "default": "/etc/ssl/certs"
                },
                "case-sensitive": {
                    "type": "boolean",
                    "description": "username is case-sensitive",
                    "default": 1
                },
                "cert": {
                    "type": "string",
                    "description": "Path to the client certificate"
                },
                "certkey": {
                    "type": "string",
                    "description": "Path to the client certificate key"
                },
                "check-connection": {
                    "type": "boolean",
                    "description": "Check bind connection to the server.",
                    "default": 0
                },
                "client-id": {
                    "type": "string",
                    "description": "OpenID Client ID"
                },
                "client-key": {
                    "type": "string",
                    "description": "OpenID Client Key"
                },
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "default": {
                    "type": "boolean",
                    "description": "Use this as default realm"
                },
                "domain": {
                    "type": "string",
                    "description": "AD domain name"
                },
                "filter": {
                    "type": "string",
                    "description": "LDAP filter for user sync."
                },
                "group_classes": {
                    "type": "string",
                    "description": "The objectclasses for groups.",
                    "default": "groupOfNames, group, univentionGroup, ipausergroup"
                },
                "group_dn": {
                    "type": "string",
                    "description": "LDAP base domain name for group sync. If not set, the base_dn will be used."
                },
                "group_filter": {
                    "type": "string",
                    "description": "LDAP filter for group sync."
                },
                "group_name_attr": {
                    "type": "string",
                    "description": "LDAP attribute representing a groups name. If not set or found, the first value of the DN will be used as name."
                },
                "groups-autocreate": {
                    "type": "boolean",
                    "description": "Automatically create groups if they do not exist.",
                    "default": 0
                },
                "groups-claim": {
                    "type": "string",
                    "description": "OpenID claim used to retrieve groups with."
                },
                "groups-overwrite": {
                    "type": "boolean",
                    "description": "All groups will be overwritten for the user on login.",
                    "default": 0
                },
                "issuer-url": {
                    "type": "string",
                    "description": "OpenID Issuer Url"
                },
                "mode": {
                    "type": "string",
                    "description": "LDAP protocol mode.",
                    "enum": [
                        "ldap",
                        "ldaps",
                        "ldap+starttls"
                    ],
                    "default": "ldap"
                },
                "password": {
                    "type": "string",
                    "description": "LDAP bind password. Will be stored in '/etc/pve/priv/realm/<REALM>.pw'."
                },
                "port": {
                    "type": "number",
                    "description": "Server port."
                },
                "prompt": {
                    "type": "string",
                    "description": "Specifies whether the Authorization Server prompts the End-User for reauthentication and consent."
                },
                "query-userinfo": {
                    "type": "boolean",
                    "description": "Enables querying the userinfo endpoint for claims values.",
                    "default": 1
                },
                "realm": {
                    "type": "string",
                    "description": "Authentication domain ID"
                },
                "scopes": {
                    "type": "string",
                    "description": "Specifies the scopes (user details) that should be authorized and returned, for example 'email' or 'profile'.",
                    "default": "email profile"
                },
                "secure": {
                    "type": "boolean",
                    "description": "Use secure LDAPS protocol. DEPRECATED: use 'mode' instead."
                },
                "server1": {
                    "type": "string",
                    "description": "Server IP address (or DNS name)"
                },
                "server2": {
                    "type": "string",
                    "description": "Fallback Server IP address (or DNS name)"
                },
                "sslversion": {
                    "type": "string",
                    "description": "LDAPS TLS/SSL version. It's not recommended to use version older than 1.2!",
                    "enum": [
                        "tlsv1",
                        "tlsv1_1",
                        "tlsv1_2",
                        "tlsv1_3"
                    ]
                },
                "sync-defaults-options": {
                    "type": "string",
                    "description": "The default options for behavior of synchronizations."
                },
                "sync_attributes": {
                    "type": "string",
                    "description": "Comma separated list of key=value pairs for specifying which LDAP attributes map to which PVE user field. For example, to map the LDAP attribute 'mail' to PVEs 'email', write  'email=mail'. By default, each PVE user field is represented  by an LDAP attribute of the same name."
                },
                "tfa": {
                    "type": "string",
                    "description": "Use Two-factor authentication."
                },
                "type": {
                    "type": "string",
                    "description": "Realm type.",
                    "enum": [
                        "ad",
                        "ldap",
                        "openid",
                        "pam",
                        "pve"
                    ]
                },
                "user_attr": {
                    "type": "string",
                    "description": "LDAP user attribute name"
                },
                "user_classes": {
                    "type": "string",
                    "description": "The objectclasses for users.",
                    "default": "inetorgperson, posixaccount, person, user"
                },
                "username-claim": {
                    "type": "string",
                    "description": "OpenID claim used to generate the unique username."
                },
                "verify": {
                    "type": "boolean",
                    "description": "Verify the server's SSL certificate",
                    "default": 0
                }
            },
            "required": [
                "realm",
                "type"
            ]
        },
        "path": "/access/domains",
        "method": "POST"
    },
    {
        "name": "pve_get_access_domains",
        "description": "Get auth server configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "realm": {
                    "type": "string",
                    "description": "Path parameter: realm"
                }
            },
            "required": [
                "realm"
            ]
        },
        "path": "/access/domains/{realm}",
        "method": "GET"
    },
    {
        "name": "pve_update_access_domains",
        "description": "Update authentication server settings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "realm": {
                    "type": "string",
                    "description": "Path parameter: realm"
                },
                "acr-values": {
                    "type": "string",
                    "description": "Specifies the Authentication Context Class Reference values that theAuthorization Server is being requested to use for the Auth Request."
                },
                "autocreate": {
                    "type": "boolean",
                    "description": "Automatically create users if they do not exist.",
                    "default": 0
                },
                "base_dn": {
                    "type": "string",
                    "description": "LDAP base domain name"
                },
                "bind_dn": {
                    "type": "string",
                    "description": "LDAP bind domain name"
                },
                "capath": {
                    "type": "string",
                    "description": "Path to the CA certificate store",
                    "default": "/etc/ssl/certs"
                },
                "case-sensitive": {
                    "type": "boolean",
                    "description": "username is case-sensitive",
                    "default": 1
                },
                "cert": {
                    "type": "string",
                    "description": "Path to the client certificate"
                },
                "certkey": {
                    "type": "string",
                    "description": "Path to the client certificate key"
                },
                "check-connection": {
                    "type": "boolean",
                    "description": "Check bind connection to the server.",
                    "default": 0
                },
                "client-id": {
                    "type": "string",
                    "description": "OpenID Client ID"
                },
                "client-key": {
                    "type": "string",
                    "description": "OpenID Client Key"
                },
                "comment": {
                    "type": "string",
                    "description": "Description."
                },
                "default": {
                    "type": "boolean",
                    "description": "Use this as default realm"
                },
                "delete": {
                    "type": "string",
                    "description": "A list of settings you want to delete."
                },
                "digest": {
                    "type": "string",
                    "description": "Prevent changes if current configuration file has a different digest. This can be used to prevent concurrent modifications."
                },
                "domain": {
                    "type": "string",
                    "description": "AD domain name"
                },
                "filter": {
                    "type": "string",
                    "description": "LDAP filter for user sync."
                },
                "group_classes": {
                    "type": "string",
                    "description": "The objectclasses for groups.",
                    "default": "groupOfNames, group, univentionGroup, ipausergroup"
                },
                "group_dn": {
                    "type": "string",
                    "description": "LDAP base domain name for group sync. If not set, the base_dn will be used."
                },
                "group_filter": {
                    "type": "string",
                    "description": "LDAP filter for group sync."
                },
                "group_name_attr": {
                    "type": "string",
                    "description": "LDAP attribute representing a groups name. If not set or found, the first value of the DN will be used as name."
                },
                "groups-autocreate": {
                    "type": "boolean",
                    "description": "Automatically create groups if they do not exist.",
                    "default": 0
                },
                "groups-claim": {
                    "type": "string",
                    "description": "OpenID claim used to retrieve groups with."
                },
                "groups-overwrite": {
                    "type": "boolean",
                    "description": "All groups will be overwritten for the user on login.",
                    "default": 0
                },
                "issuer-url": {
                    "type": "string",
                    "description": "OpenID Issuer Url"
                },
                "mode": {
                    "type": "string",
                    "description": "LDAP protocol mode.",
                    "enum": [
                        "ldap",
                        "ldaps",
                        "ldap+starttls"
                    ],
                    "default": "ldap"
                },
                "password": {
                    "type": "string",
                    "description": "LDAP bind password. Will be stored in '/etc/pve/priv/realm/<REALM>.pw'."
                },
                "port": {
                    "type": "number",
                    "description": "Server port."
                },
                "prompt": {
                    "type": "string",
                    "description": "Specifies whether the Authorization Server prompts the End-User for reauthentication and consent."
                },
                "query-userinfo": {
                    "type": "boolean",
                    "description": "Enables querying the userinfo endpoint for claims values.",
                    "default": 1
                },
                "scopes": {
                    "type": "string",
                    "description": "Specifies the scopes (user details) that should be authorized and returned, for example 'email' or 'profile'.",
                    "default": "email profile"
                },
                "secure": {
                    "type": "boolean",
                    "description": "Use secure LDAPS protocol. DEPRECATED: use 'mode' instead."
                },
                "server1": {
                    "type": "string",
                    "description": "Server IP address (or DNS name)"
                },
                "server2": {
                    "type": "string",
                    "description": "Fallback Server IP address (or DNS name)"
                },
                "sslversion": {
                    "type": "string",
                    "description": "LDAPS TLS/SSL version. It's not recommended to use version older than 1.2!",
                    "enum": [
                        "tlsv1",
                        "tlsv1_1",
                        "tlsv1_2",
                        "tlsv1_3"
                    ]
                },
                "sync-defaults-options": {
                    "type": "string",
                    "description": "The default options for behavior of synchronizations."
                },
                "sync_attributes": {
                    "type": "string",
                    "description": "Comma separated list of key=value pairs for specifying which LDAP attributes map to which PVE user field. For example, to map the LDAP attribute 'mail' to PVEs 'email', write  'email=mail'. By default, each PVE user field is represented  by an LDAP attribute of the same name."
                },
                "tfa": {
                    "type": "string",
                    "description": "Use Two-factor authentication."
                },
                "user_attr": {
                    "type": "string",
                    "description": "LDAP user attribute name"
                },
                "user_classes": {
                    "type": "string",
                    "description": "The objectclasses for users.",
                    "default": "inetorgperson, posixaccount, person, user"
                },
                "verify": {
                    "type": "boolean",
                    "description": "Verify the server's SSL certificate",
                    "default": 0
                }
            },
            "required": [
                "realm"
            ]
        },
        "path": "/access/domains/{realm}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_domains",
        "description": "Delete an authentication server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "realm": {
                    "type": "string",
                    "description": "Path parameter: realm"
                }
            },
            "required": [
                "realm"
            ]
        },
        "path": "/access/domains/{realm}",
        "method": "DELETE"
    },
    {
        "name": "pve_create_access_domains_sync",
        "description": "Syncs users and/or groups from the configured LDAP to user.cfg. NOTE: Synced groups will have the name 'name-$realm', so make sure those groups do not exist to prevent overwriting.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "realm": {
                    "type": "string",
                    "description": "Path parameter: realm"
                },
                "dry-run": {
                    "type": "boolean",
                    "description": "If set, does not write anything.",
                    "default": 0
                },
                "enable-new": {
                    "type": "boolean",
                    "description": "Enable newly synced users immediately.",
                    "default": "1"
                },
                "full": {
                    "type": "boolean",
                    "description": "DEPRECATED: use 'remove-vanished' instead. If set, uses the LDAP Directory as source of truth, deleting users or groups not returned from the sync and removing all locally modified properties of synced users. If not set, only syncs information which is present in the synced data, and does not delete"
                },
                "purge": {
                    "type": "boolean",
                    "description": "DEPRECATED: use 'remove-vanished' instead. Remove ACLs for users or groups which were removed from the config during a sync."
                },
                "remove-vanished": {
                    "type": "string",
                    "description": "A semicolon-separated list of things to remove when they or the user vanishes during a sync. The following values are possible: 'entry' removes the user/group when not returned from the sync. 'properties' removes the set properties on existing user/group that do not appear in the source (even custom",
                    "default": "none"
                },
                "scope": {
                    "type": "string",
                    "description": "Select what to sync.",
                    "enum": [
                        "users",
                        "groups",
                        "both"
                    ]
                }
            },
            "required": [
                "realm",
                "enable-new",
                "full",
                "purge",
                "remove-vanished",
                "scope"
            ]
        },
        "path": "/access/domains/{realm}/sync",
        "method": "POST"
    },
    {
        "name": "pve_list_access_openid",
        "description": "Directory index.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/openid",
        "method": "GET"
    },
    {
        "name": "pve_create_access_openid_auth-url",
        "description": "Get the OpenId Authorization Url for the specified realm.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "realm": {
                    "type": "string",
                    "description": "Authentication domain ID"
                },
                "redirect-url": {
                    "type": "string",
                    "description": "Redirection Url. The client should set this to the used server url (location.origin)."
                }
            },
            "required": [
                "realm",
                "redirect-url"
            ]
        },
        "path": "/access/openid/auth-url",
        "method": "POST"
    },
    {
        "name": "pve_create_access_openid_login",
        "description": " Verify OpenID authorization code and create a ticket.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "OpenId authorization code."
                },
                "redirect-url": {
                    "type": "string",
                    "description": "Redirection Url. The client should set this to the used server url (location.origin)."
                },
                "state": {
                    "type": "string",
                    "description": "OpenId state."
                }
            },
            "required": [
                "code",
                "redirect-url",
                "state"
            ]
        },
        "path": "/access/openid/login",
        "method": "POST"
    },
    {
        "name": "pve_list_access_tfa",
        "description": "List TFA configurations of users.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/tfa",
        "method": "GET"
    },
    {
        "name": "pve_get_access_tfa_tfa",
        "description": "List TFA configurations of users.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                }
            },
            "required": [
                "userid"
            ]
        },
        "path": "/access/tfa/{userid}",
        "method": "GET"
    },
    {
        "name": "pve_create_access_tfa",
        "description": "Add a TFA entry for a user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "challenge": {
                    "type": "string",
                    "description": "When responding to a u2f challenge: the original challenge string"
                },
                "description": {
                    "type": "string",
                    "description": "A description to distinguish multiple entries from one another"
                },
                "password": {
                    "type": "string",
                    "description": "The current password of the user performing the change."
                },
                "totp": {
                    "type": "string",
                    "description": "A totp URI."
                },
                "type": {
                    "type": "string",
                    "description": "TFA Entry Type.",
                    "enum": [
                        "totp",
                        "u2f",
                        "webauthn",
                        "recovery",
                        "yubico"
                    ]
                },
                "value": {
                    "type": "string",
                    "description": "The current value for the provided totp URI, or a Webauthn/U2F challenge response"
                }
            },
            "required": [
                "userid",
                "type"
            ]
        },
        "path": "/access/tfa/{userid}",
        "method": "POST"
    },
    {
        "name": "pve_get_access_tfa_tfa",
        "description": "Fetch a requested TFA entry if present.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                }
            },
            "required": [
                "userid",
                "id"
            ]
        },
        "path": "/access/tfa/{userid}/{id}",
        "method": "GET"
    },
    {
        "name": "pve_update_access_tfa",
        "description": "Add a TFA entry for a user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "description": {
                    "type": "string",
                    "description": "A description to distinguish multiple entries from one another"
                },
                "enable": {
                    "type": "boolean",
                    "description": "Whether the entry should be enabled for login."
                },
                "password": {
                    "type": "string",
                    "description": "The current password of the user performing the change."
                }
            },
            "required": [
                "userid",
                "id"
            ]
        },
        "path": "/access/tfa/{userid}/{id}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_access_tfa",
        "description": "Delete a TFA entry by ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userid": {
                    "type": "string",
                    "description": "Path parameter: userid"
                },
                "id": {
                    "type": "string",
                    "description": "Path parameter: id"
                },
                "password": {
                    "type": "string",
                    "description": "The current password of the user performing the change."
                }
            },
            "required": [
                "userid",
                "id"
            ]
        },
        "path": "/access/tfa/{userid}/{id}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_access_ticket",
        "description": "Dummy. Useful for formatters which want to provide a login page.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/access/ticket",
        "method": "GET"
    },
    {
        "name": "pve_create_access_ticket",
        "description": "Create or verify authentication ticket.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "new-format": {
                    "type": "boolean",
                    "description": "This parameter is now ignored and assumed to be 1.",
                    "default": 1
                },
                "otp": {
                    "type": "string",
                    "description": "One-time password for Two-factor authentication."
                },
                "password": {
                    "type": "string",
                    "description": "The secret password. This can also be a valid ticket."
                },
                "path": {
                    "type": "string",
                    "description": "Verify ticket, and check if user have access 'privs' on 'path'"
                },
                "privs": {
                    "type": "string",
                    "description": "Verify ticket, and check if user have access 'privs' on 'path'"
                },
                "realm": {
                    "type": "string",
                    "description": "You can optionally pass the realm using this parameter. Normally the realm is simply added to the username <username>@<realm>."
                },
                "tfa-challenge": {
                    "type": "string",
                    "description": "The signed TFA challenge string the user wants to respond to."
                },
                "username": {
                    "type": "string",
                    "description": "User name"
                }
            },
            "required": [
                "password",
                "username"
            ]
        },
        "path": "/access/ticket",
        "method": "POST"
    },
    {
        "name": "pve_create_access_vncticket",
        "description": "verify VNC authentication ticket.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "authid": {
                    "type": "string",
                    "description": "UserId or token"
                },
                "path": {
                    "type": "string",
                    "description": "Verify ticket, and check if user have access 'privs' on 'path'"
                },
                "privs": {
                    "type": "string",
                    "description": "Verify ticket, and check if user have access 'privs' on 'path'"
                },
                "vncticket": {
                    "type": "string",
                    "description": "The VNC ticket."
                }
            },
            "required": [
                "authid",
                "path",
                "privs",
                "vncticket"
            ]
        },
        "path": "/access/vncticket",
        "method": "POST"
    },
    {
        "name": "pve_update_access_password",
        "description": "Change user password.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "confirmation-password": {
                    "type": "string",
                    "description": "The current password of the user performing the change."
                },
                "password": {
                    "type": "string",
                    "description": "The new password."
                },
                "userid": {
                    "type": "string",
                    "description": "Full User ID, in the `name@realm` format."
                }
            },
            "required": [
                "password",
                "userid"
            ]
        },
        "path": "/access/password",
        "method": "PUT"
    },
    {
        "name": "pve_list_access_permissions",
        "description": "Retrieve effective permissions of given user/token.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Only dump this specific path, not the whole tree."
                },
                "userid": {
                    "type": "string",
                    "description": "User ID or full API token ID"
                }
            },
            "required": []
        },
        "path": "/access/permissions",
        "method": "GET"
    },
    {
        "name": "pve_list_pools",
        "description": "List pools or get pool configuration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "poolid": {
                    "type": "string",
                    "description": "poolid"
                },
                "type": {
                    "type": "string",
                    "description": "type",
                    "enum": [
                        "qemu",
                        "lxc",
                        "storage"
                    ]
                }
            },
            "required": []
        },
        "path": "/pools",
        "method": "GET"
    },
    {
        "name": "pve_create_pools",
        "description": "Create new pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "poolid": {
                    "type": "string",
                    "description": "poolid"
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools",
        "method": "POST"
    },
    {
        "name": "pve_update_pools_pools",
        "description": "Update pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "allow-move": {
                    "type": "boolean",
                    "description": "Allow adding a guest even if already in another pool. The guest will be removed from its current pool and added to this one.",
                    "default": 0
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Remove the passed VMIDs and/or storage IDs instead of adding them.",
                    "default": 0
                },
                "poolid": {
                    "type": "string",
                    "description": "poolid"
                },
                "storage": {
                    "type": "string",
                    "description": "List of storage IDs to add or remove from this pool."
                },
                "vms": {
                    "type": "string",
                    "description": "List of guest VMIDs to add or remove from this pool."
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools",
        "method": "PUT"
    },
    {
        "name": "pve_delete_pools_pools",
        "description": "Delete pool.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "poolid": {
                    "type": "string",
                    "description": "poolid"
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools",
        "method": "DELETE"
    },
    {
        "name": "pve_get_pools",
        "description": "Get pool configuration (deprecated, no support for nested pools, use 'GET /pools/?poolid={poolid}').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "poolid": {
                    "type": "string",
                    "description": "Path parameter: poolid"
                },
                "type": {
                    "type": "string",
                    "description": "type",
                    "enum": [
                        "qemu",
                        "lxc",
                        "storage"
                    ]
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools/{poolid}",
        "method": "GET"
    },
    {
        "name": "pve_update_pools_pools",
        "description": "Update pool data (deprecated, no support for nested pools - use 'PUT /pools/?poolid={poolid}' instead).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "poolid": {
                    "type": "string",
                    "description": "Path parameter: poolid"
                },
                "allow-move": {
                    "type": "boolean",
                    "description": "Allow adding a guest even if already in another pool. The guest will be removed from its current pool and added to this one.",
                    "default": 0
                },
                "comment": {
                    "type": "string",
                    "description": "comment"
                },
                "delete": {
                    "type": "boolean",
                    "description": "Remove the passed VMIDs and/or storage IDs instead of adding them.",
                    "default": 0
                },
                "storage": {
                    "type": "string",
                    "description": "List of storage IDs to add or remove from this pool."
                },
                "vms": {
                    "type": "string",
                    "description": "List of guest VMIDs to add or remove from this pool."
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools/{poolid}",
        "method": "PUT"
    },
    {
        "name": "pve_delete_pools_pools",
        "description": "Delete pool (deprecated, no support for nested pools, use 'DELETE /pools/?poolid={poolid}').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "poolid": {
                    "type": "string",
                    "description": "Path parameter: poolid"
                }
            },
            "required": [
                "poolid"
            ]
        },
        "path": "/pools/{poolid}",
        "method": "DELETE"
    },
    {
        "name": "pve_list_version",
        "description": "API version details, including some parts of the global datacenter config.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        },
        "path": "/version",
        "method": "GET"
    }
];
// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
    })),
}));
// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolDefinitions.find(t => t.name === name);
    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
    }
    try {
        // Build the endpoint path by replacing path parameters
        let endpoint = tool.path;
        const bodyParams = {};
        for (const [key, value] of Object.entries(args || {})) {
            if (endpoint.includes(`{${key}}`)) {
                endpoint = endpoint.replace(`{${key}}`, encodeURIComponent(String(value)));
            }
            else {
                bodyParams[key] = value;
            }
        }
        const result = await proxmoxRequest(endpoint, tool.method, Object.keys(bodyParams).length > 0 ? bodyParams : undefined);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{
                    type: "text",
                    text: `Error: ${message}`
                }],
            isError: true
        };
    }
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Proxmox MCP Server running on stdio (646 tools available)");
}
main().catch(console.error);
