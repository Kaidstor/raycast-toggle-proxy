import { ActionPanel, Action, Form, Detail, showToast, Toast } from "@raycast/api";
import { useState } from "react";

export default function GenerateXrayConfig() {
  const [vlessConfig, setVlessConfig] = useState<string>("");
  const [xrayConfig, setXrayConfig] = useState<string | null>(null);

  function generateXrayConfig(vlessConfig: string) {
    try {
      const url = new URL(vlessConfig);
      const uuid = url.username;
      const address = url.hostname;
      const port = url.port;
      const params = Object.fromEntries(url.searchParams.entries());


      return {
        "log": {
          "loglevel": "debug"
        },
        "inbounds": [
          {
            "listen": "127.0.0.1",
            "port": 1080,
            "protocol": "socks",
            "settings": {
              "auth": "noauth",
              "udp": true
            },
            "sniffing": {
              "destOverride": [
                "http",
                "tls",
                "quic",
                "fakedns"
              ],
              "enabled": false,
              "routeOnly": true
            },
            "tag": "socks"
          }
        ],
        "outbounds": [

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
                      flow: params.flow || ""
                    }
                  ]
                }
              ]
            },
            streamSettings: {
              network: params.type || "tcp",
              realitySettings: params.security === "reality" ? {
                fingerprint: params.fp || "chrome",
                publicKey: params.pbk || "",
                serverName: params.sni || ""
              } : undefined,
              security: params.security || "none",
              tcpSettings: {}
            },
            tag: "proxy"
          },
          {
            "protocol": "freedom",
            "tag": "direct"
          },
          {
            "protocol": "blackhole",
            "tag": "block"
          }
        ],
        "routing": {
          "rules": [
            {
              "type": "field",
              "domain": [
                "regexp:.*\\.ru$",
                "findlerbot.com",
                "regexp:.*\\.findlerbot\\.com$",
                "regexp:.*\\.ubuntu\\.com$",
                "regexp:.*\\.npmjs\\.com$"
              ],
              "outboundTag": "direct"
            },
            {
              "type": "field",
              "port": "22",
              "outboundTag": "direct"
            },
            {
              "type": "field",
              "ip": [
                "geoip:ru",
                "geoip:private"
              ],
              "outboundTag": "direct"
            }]
        }
      }
    } catch (error) {
      throw new Error("Неверный формат VLESS-конфига.");
    }
  }

  function handleGenerate() {
    try {
      const config = generateXrayConfig(vlessConfig);
      setXrayConfig(JSON.stringify(config, null, 2));
      showToast(Toast.Style.Success, "Конфигурация успешно сгенерирована и сохранена в папке расширения");
    } catch (error) {
      showToast(Toast.Style.Failure, (error as Error).message);
    }
  }

  return (
    <>
      {!xrayConfig ? (
        <Form
          actions={
            <ActionPanel>
              <Action title="Сгенерировать Конфиг" onAction={handleGenerate} />
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
        </Form>
      ) : (
        <Detail
          markdown={`\`\`\`json\n${xrayConfig}\n\`\`\``}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Скопировать Конфиг" content={xrayConfig} />
              <Action
                title="Создать Новый Конфиг"
                onAction={() => {
                  setXrayConfig(null);
                  setVlessConfig("");
                }}
              />
            </ActionPanel>
          }
        />
      )}
    </>
  );
}