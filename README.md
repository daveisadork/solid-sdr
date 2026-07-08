# SolidSDR

<img width="3086" height="1736" alt="SolidSDR screenshot" src="https://github.com/user-attachments/assets/40bd5075-33df-4872-a00b-9f43bf92bdfe" />

SolidSDR is a web-based FlexRadio client for any radio that can run the 4.x
firmware. The goal is to make as much of your radio's functionality as
possible available to any device that can run a web browser.

## Quick start

1. Download the [latest release for your platform](../../releases/latest)
2. Extract and run `solid-sdr-server`
3. Use a web browser to navigate to <http://localhost:8080>

The server works out of the box with no configuration. For all flags and
environment variables, firewall ports, and running as a systemd service, see
[CONFIGURATION.md](CONFIGURATION.md).

## Installation Notes

The server must be run on the same network as the radio. SmartLink is not
supported. Running the server and using the app on the same machine via
<http://localhost:8080> works fine, but if you want to access the server from
another computer, it must be served over HTTPS in order to work. The easiest
way to do this is with a reverse proxy that can do automatic HTTPS, such as
[Caddy](https://caddyserver.com/). For more information, check out the wiki:

- [Secure Contexts](https://github.com/daveisadork/solid-sdr/wiki/Secure-Contexts)
- [Using Caddy with SolidSDR](https://github.com/daveisadork/solid-sdr/wiki/Using-Caddy-with-SolidSDR)

### Windows

Builds are not currently code-signed and will generate some warnings the first
time you run them. The server is a command-line application that runs in a
PowerShell window. That window must stay open for the app to be accessible at
<http://localhost:8080>.

### Linux

No special requirements. The server is a self-contained static binary. Run it
and navigate to <http://localhost:8080>.

### macOS

You can download builds from the release page, but since they are unsigned,
macOS will make you jump through some hoops to run them. To simplify that, we
provide a small script. Copy and paste the following command into Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/daveisadork/solid-sdr/main/scripts/install-macos.sh | bash
```

This will download the correct build into `~/Downloads/solid-sdr-server` and
extract it there. Open that folder and double click `solid-sdr-server` to
start the server in Terminal, then navigate to <http://localhost:8080>.

## Contributing

Want to hack on SolidSDR? [CONTRIBUTING.md](CONTRIBUTING.md) covers dev
environment setup and the development workflow.

## License

SolidSDR is licensed under the [MIT License](LICENSE).
