import { ActionPanel, Action, Form, Detail, showToast, Toast } from "@raycast/api";
import { useState } from "react";

export default function GenerateXrayConfig() {
  const [vlessConfig, setVlessConfig] = useState<string>("");
  const [xrayConfig, setXrayConfig] = useState<string | null>(null);

  function generateXrayConfig(vlessConfig: string) {
    try {
      const url = new URL(vlessConfig);
      // const protocol = url.protocol.replace(":", ""); // vless
      const uuid = url.username;
      const address = url.hostname;
      const port = url.port;
      const params = Object.fromEntries(url.searchParams.entries());
      // const tag = url.hash ? decodeURIComponent(url.hash.replace("#", "")) : "";


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
                "geoip:private",
                "10.0.0.0/8",
                "94.198.218.43",
                "188.245.60.246",
                "212.192.220.11",
                "157.90.243.83",
                "49.13.56.86",
                "188.225.76.52",
                "85.15.188.99",
                "109.68.212.83",
                "84.201.152.45",
                "158.160.161.15",
                "151.248.125.33",
                "185.20.226.173",
                "176.99.12.14",
                "185.182.111.128",
                "5.63.155.77",
                "213.189.201.82",
                "194.67.118.219",
                "194.67.118.219",
                "95.163.235.88",
                "134.0.116.239",
                "31.31.203.138",
                "95.163.236.131",
                "51.250.40.221",
                "51.250.40.221",
                "80.90.182.105"
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
      showToast(Toast.Style.Success, "Конфигурация успешно сгенерирована!");
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