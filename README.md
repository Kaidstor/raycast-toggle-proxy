# Toggle Proxy Raycast Extension

This extension allows you to easily toggle SOCKS proxy settings on macOS through the menu bar and generate Xray configurations from VLESS URLs.

## Features

### 1. Menu Bar Proxy Toggle
Toggle SOCKS proxy settings directly from the macOS menu bar.

### 2. VLESS to Xray Config Generator
Convert VLESS URLs to Xray JSON configurations with:
- **Automatic saving to specified directory**
- **Custom routing rules**
- **Support for additional countries, domains, and IPs**
- **Integration with proxy settings**

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

## Using the Config Generator

1. Open the "Vless URL To Json" command
2. Paste your VLESS URL in the text area
3. Optionally customize:
   - **File name** for the config (default: config.json)
   - **Routing mode** (default or custom)
   - **Additional countries** (e.g., us,uk,de)
   - **Additional domains** (e.g., example.com,test.org)
   - **Additional IPs** (e.g., 192.168.1.0/24,10.0.0.0/8)
4. Click "Generate and Save Config"

The config will be automatically saved to your specified directory (creates the directory if it doesn't exist) and displayed with options to:
- Copy the config to clipboard
- Copy the file path
- Open the containing folder
- Create a new config

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

### Checking logs

If you encounter issues, you can check the logs in the Raycast support directory:

```
~/Library/Application Support/com.raycast.macos/extensions/toggle-proxy/logs/
```

The logs include:
- `tmux-errors.log` - Errors related to tmux execution
- `tmux-check.log` - Logs from checking if tmux is installed
- `proxy-errors.log` - Errors related to proxy setup

## Support

If you encounter any issues, please check the logs and ensure that tmux is correctly installed and accessible from your PATH.