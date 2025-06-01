import { MenuBarExtra, getPreferenceValues, showToast, Toast, Icon, environment } from "@raycast/api";
import { useEffect, useState } from "react";
import * as execa from "execa";
import { tmux, execWithEnv } from "./utils/exec";
import * as fs from "fs";
import * as path from "path";

type Preferences = {
  xrayPath?: string;
  host: string;
  port: string;
};

export default function MenuBarProxy() {
  const prefs = getPreferenceValues<Preferences>();
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isTmuxInstalled, setIsTmuxInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    checkProxy();
    checkTmuxInstalled();
  }, []);

  async function checkTmuxInstalled() {
    try {
      // Try to execute a simple tmux command
      await tmux("has-session -t non-existent-session 2>/dev/null || true");
      setIsTmuxInstalled(true);
    } catch (error) {
      setIsTmuxInstalled(false);

      // Log the error
      const logPath = path.join(environment.supportPath, "logs");
      try {
        if (!fs.existsSync(logPath)) {
          fs.mkdirSync(logPath, { recursive: true });
        }
        fs.appendFileSync(
          path.join(logPath, "tmux-check.log"),
          `${new Date().toISOString()} - Tmux not installed or not in PATH: ${JSON.stringify(error)}\n`,
        );
      } catch (e) {
        console.error("Failed to write to log file:", e);
      }
    }
  }

  async function isPortInUse(port: string) {
    try {
      const { stdout } = await execWithEnv(`lsof -i :${port} -sTCP:LISTEN`);
      console.log({ stdout });
      return stdout.includes("(LISTEN)"); // Проверяем наличие "LISTEN"
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  async function checkProxy() {
    try {
      const { stdout } = await execa.execaCommand(`/usr/sbin/networksetup -getsocksfirewallproxy Wi-Fi`);

      setIsEnabled(stdout.includes("Yes"));
    } catch {
      setIsEnabled(false);
    }
  }

  async function toggleProxy() {
    if (isEnabled) {
      // Выключаем SOCKS
      try {
        await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi off`);

        showToast(Toast.Style.Success, "Proxy выключен");
        setIsEnabled(false);
      } catch {
        showToast(Toast.Style.Failure, "Не удалось выключить прокси");
      }
    } else {
      try {
        const xrayPath = prefs.xrayPath;
        const host = prefs.host || "127.0.0.1";
        const port = prefs.port || "1080";

        // Check if tmux is installed before trying to use it
        if (!isTmuxInstalled) {
          showToast(
            Toast.Style.Failure,
            "Tmux не установлен или не найден в PATH",
            "Установите tmux или добавьте его в PATH",
          );
          return;
        }

        const isProxyRunning = await isPortInUse(port);

        if (!isProxyRunning) {
          if (!xrayPath) {
            showToast(Toast.Style.Failure, `На порту ${port} нет запущенных прокси, и путь до Xray не указан`);
            return;
          }

          // Запускаем tmux
          const cmd = `new-session -d -s toggle-proxy-xray "cd ${xrayPath} && xray"`;
          try {
            await tmux(cmd);

            const isProxyRunning = await isPortInUse(port);

            if (isProxyRunning) {
              showToast(Toast.Style.Success, `Tmux сессия для прокси запущена через ${xrayPath}`);
            } else {
              // Log the error
              const logPath = path.join(environment.supportPath, "logs");
              const errorMessage = `Failed to start proxy on port ${port} using xray at ${xrayPath}`;
              fs.appendFileSync(
                path.join(logPath, "proxy-errors.log"),
                `${new Date().toISOString()} - ${errorMessage}\n`,
              );

              showToast(Toast.Style.Failure, "Не удалось запустить прокси. Проверьте логи в Support Path");
              return;
            }
          } catch (error) {
            // Log the error
            const logPath = path.join(environment.supportPath, "logs");
            try {
              if (!fs.existsSync(logPath)) {
                fs.mkdirSync(logPath, { recursive: true });
              }
              fs.appendFileSync(
                path.join(logPath, "proxy-errors.log"),
                `${new Date().toISOString()} - Tmux error: ${JSON.stringify(error)}\n`,
              );
            } catch (e) {
              console.error("Failed to write to log file:", e);
            }

            showToast(Toast.Style.Failure, "Ошибка запуска tmux. Проверьте, установлен ли tmux");
            return;
          }
        }

        await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxy Wi-Fi ${host} ${port}`);
        await execa.execaCommand(`/usr/sbin/networksetup -setsocksfirewallproxystate Wi-Fi on`);
        showToast(Toast.Style.Success, `Proxy ${host}:${port} включен`);
        setIsEnabled(true);
      } catch (e) {
        console.log(e);
        showToast(Toast.Style.Failure, "Не удалось включить прокси");
      }
    }
  }

  return (
    <MenuBarExtra
      isLoading={isEnabled === null}
      icon={isEnabled ? Icon.BullsEyeMissed : Icon.BullsEye}
      tooltip={isTmuxInstalled === false ? "Tmux не установлен" : undefined}
    >
      {isEnabled ? (
        <MenuBarExtra.Item title="Выключить прокси" onAction={toggleProxy} />
      ) : (
        <MenuBarExtra.Item
          title="Включить прокси"
          onAction={toggleProxy}
          tooltip={isTmuxInstalled === false ? "Требуется установить tmux" : undefined}
        />
      )}
      {isTmuxInstalled === false && (
        <MenuBarExtra.Item title="Tmux не установлен" tooltip="Установите tmux для работы прокси" />
      )}
    </MenuBarExtra>
  );
}
