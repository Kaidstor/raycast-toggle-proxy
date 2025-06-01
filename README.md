# Toggle Proxy Raycast Extension

This extension allows you to easily toggle SOCKS proxy settings on macOS through the menu bar and manage Xray configurations.

## Features

### 1. Menu Bar Proxy Toggle
Toggle SOCKS proxy settings directly from the macOS menu bar with:
- **Multiple config selection** - Choose which config to run
- **Improved startup logic** - Better handling of tmux sessions  
- **Current config display** - See which config is currently running
- **Automatic session management** - Stops old sessions when starting new ones

### 2. VLESS to Xray Config Generator
Convert VLESS URLs to Xray JSON configurations with:
- **Automatic saving to specified directory**
- **Custom routing rules**
- **Support for additional countries, domains, and IPs**
- **Integration with proxy settings**

### 3. Config Manager
Comprehensive config management with:
- **View all configs** - See all JSON files in your Xray directory
- **Edit configs** - Built-in editor for quick changes
- **Config details** - File size, modification date, and content preview
- **Delete configs** - Safe deletion with confirmation
- **Open in external editor** - Integration with your preferred editor

## Prerequisites

This extension requires `tmux` to be installed on your system. If you don't have tmux installed, you can install it using one of the following methods:

### Installing tmux

#### Using Homebrew (recommended)
```bash
brew install tmux
```

#### Using MacPorts
```bash
sudo port install tmux
```

### Verifying tmux installation
After installation, verify that tmux is correctly installed by running:
```bash
tmux -V
```

This should display the tmux version.

## Configuration

In the Raycast preferences for this extension, you can configure:

1. **SOCKS Host** - The host address for your SOCKS proxy (default: 127.0.0.1)
2. **SOCKS Port** - The port for your SOCKS proxy (default: 1080)
3. **Xray config path** - The path to your Xray configuration directory (used for both execution and saving generated configs, default: ~/xray)
4. **Default Config** - The default config file to use (default: config.json)
5. **Saved Configs** - Comma-separated list of config names to show in menu (e.g., config.json,server1.json,server2.json)

## Using the Extension

### Menu Bar Proxy
1. The menu bar icon shows proxy status (filled = enabled, outline = disabled)
2. Hover to see current config name (if running)
3. Click to see options:
   - **Enable proxy (default)** - Start with default config
   - **Choose config** - Select from saved configs list
   - **Disable proxy** - Stop proxy and tmux sessions

### Config Generator
1. Open the "Vless URL To Json" command
2. Paste your VLESS URL in the text area
3. Optionally customize:
   - **File name** for the config (default: config.json)
   - **Routing mode** (default or custom)
   - **Additional countries** (e.g., us,uk,de)
   - **Additional domains** (e.g., example.com,test.org)
   - **Additional IPs** (e.g., 192.168.1.0/24,10.0.0.0/8)
4. Click "Generate and Save Config"

### Config Manager
1. Open the "Config Manager" command
2. View all configs with status indicators
3. Click on any config to:
   - View details and content
   - Edit in built-in editor
   - Open in external editor
   - Delete with confirmation
   - Copy path or content
4. Use keyboard shortcuts:
   - **Cmd+C** - Copy config path
   - **Cmd+O** - Open in external editor
   - **Cmd+Shift+O** - Open containing folder
   - **Cmd+R** - Refresh config list
   - **Cmd+K** - Quick delete config (with confirmation)

## Improvements in This Version

### Fixed tmux startup issues:
- **Better session detection** - Checks if tmux session actually started
- **Retry logic** - Waits up to 15 attempts for proxy to start
- **Session cleanup** - Stops old sessions before starting new ones
- **Improved error logging** - Captures tmux session output for debugging

### Enhanced config management:
- **Visual config selection** - See all available configs in menu
- **Current config tracking** - Always know which config is running
- **File existence checking** - See which configs exist vs. are just saved names
- **Integrated editor** - Edit configs without leaving Raycast
- **Smart caching** - Uses Raycast Cache API for efficient config scanning with 30-second LRU cache

## Troubleshooting

### Tmux not found

If you see an error message saying "Tmux не установлен или не найден в PATH", it means that the extension cannot find the tmux executable. This can happen for several reasons:

1. **Tmux is not installed** - Install tmux using the instructions above.
2. **Tmux is not in PATH** - The extension might not be able to find tmux in your PATH. You can check your PATH by running:
   ```bash
   echo $PATH
   ```
   
   Make sure that the directory containing tmux (usually `/usr/local/bin` or `/opt/homebrew/bin`) is in your PATH.

3. **Shell environment not loaded** - Raycast might not load your shell environment. You can create a symbolic link to tmux in a standard location:
   ```bash
   sudo ln -s $(which tmux) /usr/local/bin/tmux
   ```

### Proxy startup issues

If the proxy fails to start:
1. Check that your config file exists and is valid JSON
2. Check the logs for detailed error messages
3. Try starting xray manually to see error output
4. Ensure the port isn't already in use

### Checking logs

If you encounter issues, you can check the logs in the Raycast support directory:

```
~/Library/Application Support/com.raycast.macos/extensions/toggle-proxy/logs/
```

The logs include:
- `tmux-errors.log` - Errors related to tmux execution
- `tmux-check.log` - Logs from checking if tmux is installed
- `proxy-errors.log` - Errors related to proxy setup and tmux session output

## Support

If you encounter any issues, please check the logs and ensure that tmux is correctly installed and accessible from your PATH.