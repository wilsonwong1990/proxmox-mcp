#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROXMOX_HOST = process.env.PROXMOX_HOST || "";
const PROXMOX_TOKEN_ID = process.env.PROXMOX_TOKEN_ID || "";
const PROXMOX_TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET || "";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!PROXMOX_HOST || !PROXMOX_TOKEN_ID || !PROXMOX_TOKEN_SECRET) {
  console.error("Error: PROXMOX_HOST, PROXMOX_TOKEN_ID, and PROXMOX_TOKEN_SECRET environment variables are required");
  process.exit(1);
}

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

  const data = await response.json() as { data: unknown };
  return data.data;
}

const server = new Server(
  {
    name: "proxmox-mcp",
    version: "2.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const toolDefinitions: Array<{
  name: string;
  description: string;
  inputSchema: object;
  path: string;
  method: string;
}> = [
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
        "import-working-storage": {
          "type": "string",
          "description": "A file-based storage with 'images' content-type enabled, which is used as an intermediary extraction storage during import. Defaults to the source storage."
        },
        "intel-tdx": {
          "type": "string",
          "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
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
        "numa": {
          "type": "boolean",
          "description": "Enable/disable NUMA.",
          "default": 0
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
        "vcpus": {
          "type": "number",
          "description": "Number of hotplugged vcpus.",
          "default": 0
        },
        "vga": {
          "type": "string",
          "description": "Configure the VGA hardware."
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
        },
        "net0": {
          "type": "string",
          "description": "Network config: model=virtio,bridge=vmbr0"
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
        "import-working-storage": {
          "type": "string",
          "description": "A file-based storage with 'images' content-type enabled, which is used as an intermediary extraction storage during import. Defaults to the source storage."
        },
        "intel-tdx": {
          "type": "string",
          "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
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
        "numa": {
          "type": "boolean",
          "description": "Enable/disable NUMA.",
          "default": 0
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
        "vcpus": {
          "type": "number",
          "description": "Number of hotplugged vcpus.",
          "default": 0
        },
        "vga": {
          "type": "string",
          "description": "Configure the VGA hardware."
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
        "intel-tdx": {
          "type": "string",
          "description": "Trusted Domain Extension (TDX) features by Intel CPUs"
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
        "numa": {
          "type": "boolean",
          "description": "Enable/disable NUMA.",
          "default": 0
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
        "vcpus": {
          "type": "number",
          "description": "Number of hotplugged vcpus.",
          "default": 0
        },
        "vga": {
          "type": "string",
          "description": "Configure the VGA hardware."
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
        "nameserver": {
          "type": "string",
          "description": "Sets DNS server IP address for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
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
        "vmid": {
          "type": "number",
          "description": "The (unique) ID of the VM."
        },
        "net0": {
          "type": "string",
          "description": "Network config: name=eth0,bridge=vmbr0,ip=dhcp or ip=x.x.x.x/24,gw=x.x.x.x"
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
        "nameserver": {
          "type": "string",
          "description": "Sets DNS server IP address for a container. Create will automatically use the setting from the host if you neither set searchdomain nor nameserver."
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

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = toolDefinitions.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    let endpoint = tool.path;
    const bodyParams: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(args || {})) {
      if (endpoint.includes(`{${key}}`)) {
        endpoint = endpoint.replace(`{${key}}`, encodeURIComponent(String(value)));
      } else {
        bodyParams[key] = value;
      }
    }
    
    const result = await proxmoxRequest(endpoint, tool.method, 
      Object.keys(bodyParams).length > 0 ? bodyParams : undefined);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Proxmox MCP Server running (55 tools)");
}

main().catch(console.error);

