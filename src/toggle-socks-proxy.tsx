import { ActionPanel, Action, Form, Detail, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { useState } from "react";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

type Preferences = {
  host?: string;
  port?: string;
  xrayPath?: string;
};

export default function GenerateXrayConfig() {
  const prefs = getPreferenceValues<Preferences>();
  const [vlessConfig, setVlessConfig] = useState<string>("");
  const [fileName, setFileName] = useState<string>("config.json");
  const [customCountries, setCustomCountries] = useState<string>("");
  const [customDomains, setCustomDomains] = useState<string>("");
  const [customIPs, setCustomIPs] = useState<string>("");
  const [routingMode, setRoutingMode] = useState<string>("default");
  const [xrayConfig, setXrayConfig] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  function generateXrayConfig(vlessConfig: string) {
    try {
      const url = new URL(vlessConfig);
      const uuid = url.username;
      const address = url.hostname;
      const port = url.port;
      const params = Object.fromEntries(url.searchParams.entries());

      // Base routing rules
      const baseRules = [
        {
          type: "field",
          domain: [
            "regexp:.*\\.ru$",
            "findlerbot.com",
            "regexp:.*\\.findlerbot\\.com$",
            "regexp:.*\\.ubuntu\\.com$",
            "regexp:.*\\.npmjs\\.com$",
          ],
          outboundTag: "direct",
        },
        {
          type: "field",
          port: "22",
          outboundTag: "direct",
        },
        {
          type: "field",
          ip: ["geoip:ru", "geoip:private"],
          outboundTag: "direct",
        },
      ];

      // Add custom routing rules
      if (customCountries) {
        const countries = customCountries
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c);
        if (countries.length > 0) {
          baseRules.push({
            type: "field",
            ip: countries.map((country) => `geoip:${country}`),
            outboundTag: "direct",
          });
        }
      }

      if (customDomains) {
        const domains = customDomains
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d);
        if (domains.length > 0) {
          baseRules.push({
            type: "field",
            domain: domains,
            outboundTag: "direct",
          });
        }
      }

      if (customIPs) {
        const ips = customIPs
          .split(",")
          .map((ip) => ip.trim())
          .filter((ip) => ip);
        if (ips.length > 0) {
          baseRules.push({
            type: "field",
            ip: ips,
            outboundTag: "direct",
          });
        }
      }

      const socksPort = parseInt(prefs.port || "1080", 10);
      const socksHost = prefs.host || "127.0.0.1";

      return {
        log: {
          loglevel: "debug",
        },
        inbounds: [
          {
            listen: socksHost,
            port: socksPort,
            protocol: "socks",
            settings: {
              auth: "noauth",
              udp: true,
            },
            sniffing: {
              destOverride: ["http", "tls", "quic", "fakedns"],
              enabled: false,
              routeOnly: true,
            },
            tag: "socks",
          },
        ],
        outbounds: [
          {
            protocol: "vless",
            settings: {
              vnext: [
                {
                  address,
                  port: parseInt(port, 10),
                  users: [
                    {
                      id: uuid,
                      encryption: "none",
                      flow: params.flow || "",
                    },
                  ],
                },
              ],
            },
            streamSettings: {
              network: params.type || "tcp",
              realitySettings:
                params.security === "reality"
                  ? {
                    fingerprint: params.fp || "chrome",
                    publicKey: params.pbk || "",
                    serverName: params.sni || "",
                  }
                  : undefined,
              security: params.security || "none",
              tcpSettings: {},
            },
            tag: "proxy",
          },
          {
            protocol: "freedom",
            tag: "direct",
          },
          {
            protocol: "blackhole",
            tag: "block",
          },
        ],
        routing: {
          rules: baseRules,
        },
      };
    } catch (error) {
      throw new Error("Неверный формат VLESS-конфига.");
    }
  }

  function saveConfigToFile(config: string, fileName: string): string {
    try {
      const savePath = prefs.xrayPath || "~/xray";
      const expandedPath = savePath.startsWith("~") ? path.join(os.homedir(), savePath.slice(1)) : savePath;

      // Create directory if it doesn't exist
      if (!fs.existsSync(expandedPath)) {
        fs.mkdirSync(expandedPath, { recursive: true });
      }

      const filePath = path.join(expandedPath, fileName);
      fs.writeFileSync(filePath, config, "utf8");

      return filePath;
    } catch (error) {
      throw new Error(`Ошибка сохранения файла: ${(error as Error).message}`);
    }
  }

  function handleGenerate() {
    try {
      const config = generateXrayConfig(vlessConfig);
      const configJson = JSON.stringify(config, null, 2);
      setXrayConfig(configJson);

      // Save config to file
      const savedFilePath = saveConfigToFile(configJson, fileName);
      setSavedPath(savedFilePath);

      showToast(Toast.Style.Success, `Конфигурация сохранена: ${savedFilePath}`);
    } catch (error) {
      showToast(Toast.Style.Failure, (error as Error).message);
    }
  }

  function handleReset() {
    setXrayConfig(null);
    setVlessConfig("");
    setSavedPath(null);
    setFileName("config.json");
    setCustomCountries("");
    setCustomDomains("");
    setCustomIPs("");
    setRoutingMode("default");
  }

  return (
    <>
      {!xrayConfig ? (
        <Form
          actions={
            <ActionPanel>
              <Action title="Сгенерировать и Сохранить Конфиг" onAction={handleGenerate} />
            </ActionPanel>
          }
        >
          <Form.TextArea
            id="vlessConfig"
            title="VLESS Конфиг"
            placeholder="Введите строку VLESS (например, vless://...)"
            value={vlessConfig}
            onChange={setVlessConfig}
          />

          <Form.Separator />

          <Form.TextField
            id="fileName"
            title="Имя файла"
            placeholder="config.json"
            value={fileName}
            onChange={setFileName}
          />

          <Form.Dropdown id="routingMode" title="Режим роутинга" value={routingMode} onChange={setRoutingMode}>
            <Form.Dropdown.Item value="default" title="По умолчанию" />
            <Form.Dropdown.Item value="custom" title="Кастомный" />
          </Form.Dropdown>

          {routingMode === "custom" && (
            <>
              <Form.Separator />

              <Form.TextField
                id="customCountries"
                title="Дополнительные страны"
                placeholder="us,uk,de (через запятую)"
                value={customCountries}
                onChange={setCustomCountries}
              />

              <Form.TextField
                id="customDomains"
                title="Дополнительные домены"
                placeholder="example.com,test.org (через запятую)"
                value={customDomains}
                onChange={setCustomDomains}
              />

              <Form.TextField
                id="customIPs"
                title="Дополнительные IP"
                placeholder="192.168.1.0/24,10.0.0.0/8 (через запятую)"
                value={customIPs}
                onChange={setCustomIPs}
              />
            </>
          )}

          <Form.Separator />

          <Form.Description
            title="Настройки сохранения"
            text={`Конфиг будет сохранён в: ${prefs.xrayPath || "~/xray"}`}
          />

          <Form.Description
            title="SOCKS настройки"
            text={`Прокси будет работать на: ${prefs.host || "127.0.0.1"}:${prefs.port || "1080"}`}
          />
        </Form>
      ) : (
        <Detail
          markdown={`# Конфигурация сохранена!\n\n**Путь:** \`${savedPath}\`\n\n**Конфиг:**\n\`\`\`json\n${xrayConfig}\n\`\`\``}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Скопировать Конфиг" content={xrayConfig} />
              <Action.CopyToClipboard title="Скопировать Путь к Файлу" content={savedPath || ""} />
              <Action.OpenWith title="Открыть Папку" path={path.dirname(savedPath || "")} />
              <Action title="Создать Новый Конфиг" onAction={handleReset} />
            </ActionPanel>
          }
        />
      )}
    </>
  );
}
